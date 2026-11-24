import * as THREE from "three";
import { createRng } from "../../core/random";

/** Flat blocky clouds drifting slowly across the map. */
export class Clouds {
  private list: THREE.Mesh[] = [];
  private material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });

  constructor(scene: THREE.Scene, private sx: number, sz: number, height: number, seed: number) {
    const r = createRng(seed * 7 + 3);
    const count = Math.round((sx * sz) / 700);
    for (let k = 0; k < count; k++) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(4 + r() * 8, 1, 3 + r() * 6), this.material);
      c.position.set(r() * sx, height + r() * 4, r() * sz);
      scene.add(c);
      this.list.push(c);
    }
  }

  update(dt: number, light: number): void {
    this.material.color.setScalar(Math.max(0.35, light));
    for (const c of this.list) {
      c.position.x += dt * 0.6;
      if (c.position.x > this.sx + 12) c.position.x = -12;
    }
  }

  dispose(): void {
    for (const c of this.list) {
      c.geometry.dispose();
      c.removeFromParent();
    }
    this.material.dispose();
  }
}
