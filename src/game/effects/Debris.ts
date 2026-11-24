import * as THREE from "three";
import type { World } from "../world/World";

interface Piece { mesh: THREE.Mesh; v: THREE.Vector3; life: number }

/** Small cubes that burst out of a broken block, bounce and shrink away. */
export class Debris {
  private pieces: Piece[] = [];
  private geo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
  private materials = new Map<string, THREE.MeshBasicMaterial>();

  constructor(private scene: THREE.Scene, private world: World) {}

  burst(x: number, y: number, z: number, rgb: [number, number, number], count = 12): void {
    const key = rgb.map(c => c.toFixed(2)).join(",");
    let mat = this.materials.get(key);
    if (!mat) {
      mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(rgb[0], rgb[1], rgb[2]) });
      this.materials.set(key, mat);
    }
    for (let k = 0; k < count; k++) {
      const mesh = new THREE.Mesh(this.geo, mat);
      mesh.position.set(x + 0.2 + Math.random() * 0.6, y + 0.2 + Math.random() * 0.6, z + 0.2 + Math.random() * 0.6);
      this.scene.add(mesh);
      this.pieces.push({
        mesh,
        v: new THREE.Vector3((Math.random() - 0.5) * 3, 2 + Math.random() * 3, (Math.random() - 0.5) * 3),
        life: 0.8 + Math.random() * 0.5,
      });
    }
  }

  update(dt: number, light: number): void {
    for (const m of this.materials.values()) m.userData.base ??= m.color.clone();
    for (const m of this.materials.values()) m.color.copy(m.userData.base).multiplyScalar(light);
    for (let i = this.pieces.length - 1; i >= 0; i--) {
      const p = this.pieces[i];
      p.v.y -= 20 * dt;
      p.mesh.position.addScaledVector(p.v, dt);
      const q = p.mesh.position;
      if (p.v.y < 0 && this.world.isSolid(Math.floor(q.x), Math.floor(q.y), Math.floor(q.z))) {
        q.y = Math.floor(q.y) + 1.08;
        p.v.y *= -0.3;
        p.v.x *= 0.6;
        p.v.z *= 0.6;
      }
      p.life -= dt;
      p.mesh.scale.setScalar(Math.max(0.01, Math.min(1, p.life * 3)));
      if (p.life <= 0) {
        p.mesh.removeFromParent();
        this.pieces.splice(i, 1);
      }
    }
  }

  dispose(): void {
    for (const p of this.pieces) p.mesh.removeFromParent();
    this.geo.dispose();
    for (const m of this.materials.values()) m.dispose();
  }
}
