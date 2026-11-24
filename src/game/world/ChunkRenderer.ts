import * as THREE from "three";
import { Block, BLOCKS, isOpaque } from "./blocks";
import { tileUV } from "../textures/atlas";
import type { World } from "./World";

export const CHUNK = 16;

/**
 * Each face: outward direction, base shade, and 4 corners as [x, y, z, u, v].
 * Corners are ordered so (0,1,2) and (2,1,3) are front-facing triangles.
 */
const FACES = [
  { dir: [-1, 0, 0], shade: 0.8, corners: [[0, 1, 0, 0, 1], [0, 0, 0, 0, 0], [0, 1, 1, 1, 1], [0, 0, 1, 1, 0]] },
  { dir: [1, 0, 0], shade: 0.8, corners: [[1, 1, 1, 0, 1], [1, 0, 1, 0, 0], [1, 1, 0, 1, 1], [1, 0, 0, 1, 0]] },
  { dir: [0, -1, 0], shade: 0.55, corners: [[1, 0, 1, 1, 0], [0, 0, 1, 0, 0], [1, 0, 0, 1, 1], [0, 0, 0, 0, 1]] },
  { dir: [0, 1, 0], shade: 1, corners: [[0, 1, 1, 1, 1], [1, 1, 1, 0, 1], [0, 1, 0, 1, 0], [1, 1, 0, 0, 0]] },
  { dir: [0, 0, -1], shade: 0.68, corners: [[1, 0, 0, 0, 0], [0, 0, 0, 1, 0], [1, 1, 0, 0, 1], [0, 1, 0, 1, 1]] },
  { dir: [0, 0, 1], shade: 0.68, corners: [[0, 0, 1, 0, 0], [1, 0, 1, 1, 0], [0, 1, 1, 0, 1], [1, 1, 1, 1, 1]] },
] as const;

/** Brightness by how many neighbouring blocks crowd a corner (0 = most crowded). */
const AO = [0.48, 0.64, 0.8, 1];

class Buffers {
  pos: number[] = [];
  uv: number[] = [];
  col: number[] = [];
  ind: number[] = [];

  toGeometry(): THREE.BufferGeometry | null {
    if (!this.ind.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.ind);
    g.computeBoundingSphere();
    return g;
  }
}

/** Build the three meshes (opaque, cutout, water) for one 16×16 column of the world. */
export function buildChunk(world: World, cx: number, cz: number) {
  const out = { opaque: new Buffers(), cutout: new Buffers(), water: new Buffers() };
  const occ = (x: number, y: number, z: number) => (isOpaque(world.get(x, y, z)) ? 1 : 0);
  const e = 0.0015; // inset UVs slightly so neighbouring tiles never bleed in

  const x0 = cx * CHUNK;
  const z0 = cz * CHUNK;
  for (let y = 0; y < world.sy; y++) {
    for (let z = z0; z < Math.min(z0 + CHUNK, world.sz); z++) {
      for (let x = x0; x < Math.min(x0 + CHUNK, world.sx); x++) {
        const id = world.data[world.index(x, y, z)];
        if (id === Block.Air) continue;
        const def = BLOCKS[id];
        if (!def) continue;
        const buf = out[def.pass];
        const waterTop = def.pass === "water" && world.get(x, y + 1, z) !== Block.Water;

        for (const f of FACES) {
          const nx = x + f.dir[0];
          const ny = y + f.dir[1];
          const nz = z + f.dir[2];
          if (ny < 0) continue;
          const nb = world.get(nx, ny, nz);
          // Skip faces hidden behind a neighbour.
          if (isOpaque(nb)) continue;
          if (def.pass !== "opaque" && nb === id) continue;
          if (def.pass === "water" && BLOCKS[nb]?.pass === "cutout") continue;

          const tile = def.tiles[f.dir[1] === 1 ? 0 : f.dir[1] === -1 ? 2 : 1];
          const [u0, v0, u1, v1] = tileUV(tile);
          const n = buf.pos.length / 3;
          const ao: number[] = [];
          // The two axes running along this face, for corner occlusion lookups.
          const axis = f.dir[0] ? 0 : f.dir[1] ? 1 : 2;
          const ta = axis === 0 ? 1 : 0;
          const tb = axis === 2 ? 1 : 2;

          for (const c of f.corners) {
            let cy = y + c[1];
            if (waterTop && c[1] === 1) cy -= 0.12; // water surface sits a little lower
            buf.pos.push(x + c[0], cy, z + c[2]);
            buf.uv.push(u0 + e + c[3] * (u1 - u0 - 2 * e), v0 + e + c[4] * (v1 - v0 - 2 * e));

            let light = 1;
            if (def.pass !== "water") {
              const base = [nx, ny, nz];
              const da = [0, 0, 0];
              const db = [0, 0, 0];
              da[ta] = c[ta] ? 1 : -1;
              db[tb] = c[tb] ? 1 : -1;
              const s1 = occ(base[0] + da[0], base[1] + da[1], base[2] + da[2]);
              const s2 = occ(base[0] + db[0], base[1] + db[1], base[2] + db[2]);
              const cr = occ(base[0] + da[0] + db[0], base[1] + da[1] + db[1], base[2] + da[2] + db[2]);
              const level = s1 && s2 ? 0 : 3 - (s1 + s2 + cr);
              ao.push(level);
              light = AO[level];
            }
            const s = f.shade * light;
            buf.col.push(s, s, s);
          }
          // Flip the quad's diagonal when it makes the shading smoother.
          if (ao.length === 4 && ao[0] + ao[3] < ao[1] + ao[2]) {
            buf.ind.push(n, n + 1, n + 3, n, n + 3, n + 2);
          } else {
            buf.ind.push(n, n + 1, n + 2, n + 2, n + 1, n + 3);
          }
        }
      }
    }
  }
  return {
    opaque: out.opaque.toGeometry(),
    cutout: out.cutout.toGeometry(),
    water: out.water.toGeometry(),
  };
}

/** Owns the meshes for every chunk and rebuilds only the ones that changed. */
export class ChunkRenderer {
  readonly materials: {
    opaque: THREE.MeshBasicMaterial;
    cutout: THREE.MeshBasicMaterial;
    water: THREE.MeshBasicMaterial;
  };
  private meshes = new Map<string, THREE.Mesh[]>();
  private dirty = new Set<string>();
  private group = new THREE.Group();
  readonly cx: number;
  readonly cz: number;

  constructor(private world: World, texture: THREE.Texture, scene: THREE.Scene) {
    this.cx = Math.ceil(world.sx / CHUNK);
    this.cz = Math.ceil(world.sz / CHUNK);
    this.materials = {
      opaque: new THREE.MeshBasicMaterial({ map: texture, vertexColors: true }),
      cutout: new THREE.MeshBasicMaterial({ map: texture, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide }),
      water: new THREE.MeshBasicMaterial({
        map: texture, vertexColors: true, transparent: true, opacity: 0.72, depthWrite: false, side: THREE.DoubleSide,
      }),
    };
    scene.add(this.group);
  }

  buildAll(): void {
    for (let cz = 0; cz < this.cz; cz++) for (let cx = 0; cx < this.cx; cx++) this.rebuild(cx, cz);
  }

  /** Mark the chunk holding (x, z) for rebuilding, plus neighbours when on a border. */
  markDirty(x: number, z: number): void {
    const cx = Math.floor(x / CHUNK);
    const cz = Math.floor(z / CHUNK);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx;
        const nz = cz + dz;
        if (nx < 0 || nz < 0 || nx >= this.cx || nz >= this.cz) continue;
        // Only neighbours that touch the changed block need rebuilding (for face culling and shading).
        const lx = x - cx * CHUNK;
        const lz = z - cz * CHUNK;
        if (dx === -1 && lx > 0) continue;
        if (dx === 1 && lx < CHUNK - 1) continue;
        if (dz === -1 && lz > 0) continue;
        if (dz === 1 && lz < CHUNK - 1) continue;
        this.dirty.add(`${nx},${nz}`);
      }
    }
  }

  /** Rebuild changed chunks right away (edits must show on the same frame). */
  flush(): void {
    for (const k of this.dirty) {
      const [cx, cz] = k.split(",").map(Number);
      this.rebuild(cx, cz);
    }
    this.dirty.clear();
  }

  /** Daylight: darken everything at night. */
  setLight(level: number): void {
    for (const m of Object.values(this.materials)) m.color.setScalar(level);
  }

  private rebuild(cx: number, cz: number): void {
    const key = `${cx},${cz}`;
    for (const m of this.meshes.get(key) ?? []) {
      this.group.remove(m);
      m.geometry.dispose();
    }
    const geos = buildChunk(this.world, cx, cz);
    const list: THREE.Mesh[] = [];
    (["opaque", "cutout", "water"] as const).forEach(pass => {
      const g = geos[pass];
      if (!g) return;
      const mesh = new THREE.Mesh(g, this.materials[pass]);
      if (pass === "water") mesh.renderOrder = 1;
      this.group.add(mesh);
      list.push(mesh);
    });
    this.meshes.set(key, list);
  }

  dispose(): void {
    for (const list of this.meshes.values()) for (const m of list) m.geometry.dispose();
    for (const m of Object.values(this.materials)) m.dispose();
    this.group.removeFromParent();
  }
}
