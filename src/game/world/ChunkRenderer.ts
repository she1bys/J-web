import * as THREE from "three";
import { Block, BLOCKS, faceTile, isOpaque, type BlockDef } from "./blocks";
import { tileUV } from "../textures/atlas";
import { brightness } from "./Lighting";
import type { World } from "./World";

export { CHUNK } from "./chunk";
import { CHUNK } from "./chunk";

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
  /** Per vertex: [sky light, block light], each 0–1 */
  light: number[] = [];
  ind: number[] = [];

  toGeometry(): THREE.BufferGeometry | null {
    if (!this.ind.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute("light", new THREE.Float32BufferAttribute(this.light, 2));
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

  /** Light at a corner: average of the open cells around it (smooth lighting). */
  const cornerLight = (cells: [number, number, number][]): [number, number] => {
    let s = 0, b = 0, n = 0;
    for (const [x, y, z] of cells) {
      if (isOpaque(world.get(x, y, z))) continue;
      s += world.skyLight(x, y, z);
      b += world.blockLight(x, y, z);
      n++;
    }
    return n ? [brightness(s / n), brightness(b / n)] : [0, 0];
  };

  const x0 = cx * CHUNK;
  const z0 = cz * CHUNK;
  for (let y = 0; y < world.sy; y++) {
    for (let z = z0; z < Math.min(z0 + CHUNK, world.sz); z++) {
      for (let x = x0; x < Math.min(x0 + CHUNK, world.sx); x++) {
        const i = world.index(x, y, z);
        const id = world.data[i];
        if (id === Block.Air) continue;
        const def = BLOCKS[id];
        if (!def) continue;
        const meta = world.meta[i];
        const buf = out[def.pass];
        if (def.shape.kind === "cross") {
          crossQuads(buf, world, x, y, z, def, meta, def.shape.size, def.shape.height);
          continue;
        }
        const height = def.shape.kind === "box" ? def.shape.height : 1;
        const waterTop = def.pass === "water" && world.get(x, y + 1, z) !== Block.Water;

        for (const f of FACES) {
          const nx = x + f.dir[0];
          const ny = y + f.dir[1];
          const nz = z + f.dir[2];
          if (ny < 0) continue;
          const nb = world.get(nx, ny, nz);
          // Skip faces hidden behind a neighbour (a low box's top is never hidden).
          const fullFace = height === 1 || f.dir[1] !== 1;
          if (fullFace && isOpaque(nb)) continue;
          if (def.pass !== "opaque" && nb === id && height === 1) continue;
          if (def.pass === "water" && BLOCKS[nb]?.pass === "cutout" && BLOCKS[nb]?.shape.kind === "cube") continue;

          const tile = faceTile(def, meta, f.dir[1] === 1 ? "top" : f.dir[1] === -1 ? "bottom" : "side", f.dir as unknown as [number, number, number]);
          const [u0, v0, u1, v1] = tileUV(tile);
          const n = buf.pos.length / 3;
          const ao: number[] = [];
          // The two axes running along this face, for corner lookups.
          const axis = f.dir[0] ? 0 : f.dir[1] ? 1 : 2;
          const ta = axis === 0 ? 1 : 0;
          const tb = axis === 2 ? 1 : 2;
          // A low box's top samples light from its own cell (the cell above may be dark under a roof).
          const lx = height < 1 && f.dir[1] === 1 ? x : nx;
          const ly = height < 1 && f.dir[1] === 1 ? y : ny;
          const lz = height < 1 && f.dir[1] === 1 ? z : nz;

          for (const c of f.corners) {
            let cy = y + c[1] * height;
            if (waterTop && c[1] === 1) cy -= 0.12; // water surface sits a little lower
            buf.pos.push(x + c[0], cy, z + c[2]);
            // Side faces of a low box only show the matching part of the texture.
            const vv = f.dir[1] === 0 ? c[4] * height : c[4];
            buf.uv.push(u0 + e + c[3] * (u1 - u0 - 2 * e), v0 + e + vv * (v1 - v0 - 2 * e));

            const base: [number, number, number] = [lx, ly, lz];
            const da = [0, 0, 0];
            const db = [0, 0, 0];
            da[ta] = c[ta] ? 1 : -1;
            db[tb] = c[tb] ? 1 : -1;
            const cA: [number, number, number] = [base[0] + da[0], base[1] + da[1], base[2] + da[2]];
            const cB: [number, number, number] = [base[0] + db[0], base[1] + db[1], base[2] + db[2]];
            const cC: [number, number, number] = [base[0] + da[0] + db[0], base[1] + da[1] + db[1], base[2] + da[2] + db[2]];
            let shade = f.shade;
            if (def.pass !== "water") {
              const s1 = occ(...cA);
              const s2 = occ(...cB);
              const cr = occ(...cC);
              const level = s1 && s2 ? 0 : 3 - (s1 + s2 + cr);
              ao.push(level);
              shade *= AO[level];
              const [sl, bl] = cornerLight(s1 && s2 ? [base] : [base, cA, cB, cC]);
              buf.light.push(sl, bl);
            } else {
              buf.light.push(brightness(world.skyLight(nx, ny, nz)), brightness(world.blockLight(nx, ny, nz)));
            }
            buf.col.push(shade, shade, shade);
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

/** Two crossed quads for plants and torches, lit by their own cell. */
function crossQuads(buf: Buffers, world: World, x: number, y: number, z: number, def: BlockDef, meta: number, size: number, height: number): void {
  const [u0, v0, u1, v1] = tileUV(faceTile(def, meta, "side"));
  const sl = brightness(world.skyLight(x, y, z));
  const bl = brightness(Math.max(world.blockLight(x, y, z), def.light));
  const a = (1 - size) / 2;
  const b = 1 - a;
  const quads: [number, number, number, number][] = [
    [a, a, b, b],
    [a, b, b, a],
  ];
  // Texture coordinates: crop the tile to the drawn height (torches use their full tile).
  const vTop = v0 + (v1 - v0) * (def.light ? 1 : height);
  for (const [xa, za, xb, zb] of quads) {
    const n = buf.pos.length / 3;
    buf.pos.push(x + xa, y, z + za, x + xb, y, z + zb, x + xa, y + height, z + za, x + xb, y + height, z + zb);
    buf.uv.push(u0, v0, u1, v0, u0, vTop, u1, vTop);
    for (let k = 0; k < 4; k++) {
      buf.col.push(0.9, 0.9, 0.9);
      buf.light.push(sl, bl);
    }
    buf.ind.push(n, n + 1, n + 2, n + 2, n + 1, n + 3);
  }
}

/** Shared by every world material: how bright the sky is right now (0 night … 1 day). */
export const daylightUniform = { value: 1 };

/**
 * A MeshBasicMaterial extended to read the per-vertex light: sky light scaled by daylight,
 * block light (torches) unaffected by time and slightly warm.
 */
function litMaterial(params: THREE.MeshBasicMaterialParameters): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial(params);
  m.onBeforeCompile = shader => {
    shader.uniforms.uDaylight = daylightUniform;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec2 light;\nvarying vec2 vLight;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvLight = light;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uDaylight;\nvarying vec2 vLight;")
      .replace(
        "#include <opaque_fragment>",
        `#include <opaque_fragment>
        float skyL = vLight.x * uDaylight;
        float blkL = vLight.y;
        float lit = max(max(skyL, blkL), 0.04);
        vec3 warm = mix(vec3(1.0), vec3(1.0, 0.84, 0.62), clamp((blkL - skyL) * 1.5, 0.0, 1.0));
        gl_FragColor.rgb *= lit * warm;`,
      );
  };
  m.customProgramCacheKey = () => `voxel-lit-${params.transparent ? "t" : params.alphaTest ? "c" : "o"}`;
  return m;
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
      opaque: litMaterial({ map: texture, vertexColors: true }),
      cutout: litMaterial({ map: texture, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide }),
      water: litMaterial({ map: texture, vertexColors: true, transparent: true, opacity: 0.72, depthWrite: false, side: THREE.DoubleSide }),
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

  /** Mark whole chunks (e.g. ones whose light changed). */
  markChunks(keys: Iterable<string>): void {
    for (const k of keys) this.dirty.add(k);
  }

  /** Rebuild changed chunks right away (edits must show on the same frame). */
  flush(): void {
    for (const k of this.dirty) {
      const [cx, cz] = k.split(",").map(Number);
      if (cx >= 0 && cz >= 0 && cx < this.cx && cz < this.cz) this.rebuild(cx, cz);
    }
    this.dirty.clear();
  }

  /** How bright the sky is: 0 (night) to 1 (day). Torch light isn't affected. */
  setDaylight(level: number): void {
    daylightUniform.value = level;
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
