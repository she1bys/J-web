import * as THREE from "three";
import { BLOCKS } from "../world/blocks";
import { tileUV } from "../textures/atlas";
import { itemDef } from "../items/items";
import { itemIcon } from "../items/itemIcons";
import type { ItemStack } from "../items/Inventory";
import type { World } from "../world/World";

interface Dropped {
  stack: ItemStack;
  mesh: THREE.Object3D;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  age: number;
  /** Can't be picked up until this age (so items you throw don't come straight back). */
  pickupAfter: number;
  spin: number;
}

const LIFETIME = 300;
const SIZE = 0.26;

/**
 * Items lying in the world: they pop out of broken blocks, fall, bob and spin,
 * and fly to the player when close enough to pick up.
 */
export class ItemEntities {
  private list: Dropped[] = [];
  private blockMat: THREE.MeshBasicMaterial;
  private blockGeos = new Map<number, THREE.BufferGeometry>();
  private spriteMats = new Map<number, THREE.MeshBasicMaterial>();
  private spriteGeo = new THREE.PlaneGeometry(0.42, 0.42);

  constructor(private scene: THREE.Scene, private world: World, texture: THREE.Texture) {
    this.blockMat = new THREE.MeshBasicMaterial({ map: texture, alphaTest: 0.5 });
  }

  get count(): number {
    return this.list.length;
  }

  /** A small cube textured like the block, with the right tile on each face. */
  private blockGeo(blockId: number): THREE.BufferGeometry {
    let g = this.blockGeos.get(blockId);
    if (g) return g;
    g = new THREE.BoxGeometry(SIZE, SIZE, SIZE);
    const tiles = BLOCKS[blockId]?.tiles ?? [0, 0, 0];
    // BoxGeometry face order: +x, -x, +y, -y, +z, -z (4 vertices each)
    const faceTile = [tiles[1], tiles[1], tiles[0], tiles[2], tiles[1], tiles[1]];
    const uv = g.attributes.uv;
    for (let f = 0; f < 6; f++) {
      const [u0, v0, u1, v1] = tileUV(faceTile[f]);
      for (let k = 0; k < 4; k++) {
        const i = f * 4 + k;
        uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
      }
    }
    this.blockGeos.set(blockId, g);
    return g;
  }

  private spriteMat(id: number): THREE.MeshBasicMaterial {
    let m = this.spriteMats.get(id);
    if (m) return m;
    const tex = new THREE.CanvasTexture(itemIcon(id));
    tex.magFilter = tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    m = new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide });
    this.spriteMats.set(id, m);
    return m;
  }

  /** Drop a stack at a position, with an optional throw velocity. */
  spawn(stack: ItemStack, x: number, y: number, z: number, vel?: THREE.Vector3, pickupAfter = 0.4): void {
    const def = itemDef(stack.id);
    if (!def) return;
    const mesh = def.block !== undefined
      ? new THREE.Mesh(this.blockGeo(def.block), this.blockMat)
      : new THREE.Mesh(this.spriteGeo, this.spriteMat(stack.id));
    const pos = new THREE.Vector3(x, y, z);
    mesh.position.copy(pos);
    this.scene.add(mesh);
    this.list.push({
      stack: { ...stack },
      mesh,
      pos,
      vel: vel?.clone() ?? new THREE.Vector3((Math.random() - 0.5) * 2, 3 + Math.random() * 1.5, (Math.random() - 0.5) * 2),
      age: 0,
      pickupAfter,
      spin: Math.random() * Math.PI * 2,
    });
  }

  /**
   * Move everything and hand items to the player when they touch them.
   * `collect` returns how many it couldn't take (inventory full).
   */
  update(dt: number, player: THREE.Vector3, light: number, collect: (stack: ItemStack) => number): void {
    this.blockMat.color.setScalar(light);
    for (const m of this.spriteMats.values()) m.color.setScalar(light);
    const target = new THREE.Vector3(player.x, player.y + 0.6, player.z);

    for (let i = this.list.length - 1; i >= 0; i--) {
      const it = this.list[i];
      it.age += dt;
      if (it.age > LIFETIME) {
        this.remove(i);
        continue;
      }
      const dist = it.pos.distanceTo(target);
      if (it.age > it.pickupAfter && dist < 2.6) {
        // Pulled toward the player
        const pull = target.clone().sub(it.pos).normalize().multiplyScalar(9 * dt);
        it.pos.add(pull);
        it.vel.set(0, 0, 0);
        if (dist < 0.8) {
          const left = collect(it.stack);
          if (left <= 0) {
            this.remove(i);
            continue;
          }
          it.stack.count = left;
        }
      } else {
        it.vel.y = Math.max(-20, it.vel.y - 18 * dt);
        it.pos.addScaledVector(it.vel, dt);
        const below = Math.floor(it.pos.y - SIZE / 2);
        if (it.vel.y <= 0 && this.world.isSolid(Math.floor(it.pos.x), below, Math.floor(it.pos.z))) {
          it.pos.y = below + 1 + SIZE / 2;
          it.vel.y = 0;
          it.vel.x *= 0.8;
          it.vel.z *= 0.8;
        }
        // Pushed up if a block was placed on top of it
        if (this.world.isSolid(Math.floor(it.pos.x), Math.floor(it.pos.y), Math.floor(it.pos.z))) it.pos.y = Math.floor(it.pos.y) + 1 + SIZE / 2;
      }
      it.spin += dt * 1.8;
      it.mesh.position.set(it.pos.x, it.pos.y + 0.08 + Math.sin(it.age * 3) * 0.06, it.pos.z);
      it.mesh.rotation.y = it.spin;
    }
  }

  private remove(i: number): void {
    this.list[i].mesh.removeFromParent();
    this.list.splice(i, 1);
  }

  dispose(): void {
    for (const it of this.list) it.mesh.removeFromParent();
    this.list = [];
    this.blockGeos.forEach(g => g.dispose());
    this.spriteMats.forEach(m => {
      m.map?.dispose();
      m.dispose();
    });
    this.spriteGeo.dispose();
    this.blockMat.dispose();
  }
}
