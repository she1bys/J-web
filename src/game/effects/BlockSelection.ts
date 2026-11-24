import * as THREE from "three";
import { Tile, type TileId } from "../world/blocks";
import { tileUV } from "../textures/atlas";

const CRACKS: readonly TileId[] = [Tile.Crack1, Tile.Crack2, Tile.Crack3, Tile.Crack4];

/** The outline around the block you're pointing at, and its crack stages while mining. */
export class BlockSelection {
  private outline: THREE.LineSegments;
  private crack: THREE.Mesh;
  private crackGeos: THREE.BufferGeometry[];

  constructor(scene: THREE.Scene, texture: THREE.Texture) {
    this.outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)),
      new THREE.LineBasicMaterial({ color: 0x000000 }),
    );
    this.crackGeos = CRACKS.map(t => {
      const g = new THREE.BoxGeometry(1.006, 1.006, 1.006);
      const [u0, v0, u1, v1] = tileUV(t);
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
      return g;
    });
    this.crack = new THREE.Mesh(
      this.crackGeos[0],
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }),
    );
    this.outline.visible = this.crack.visible = false;
    scene.add(this.outline, this.crack);
  }

  /** progress: 0 = no cracks, up to 1 = about to break. */
  show(x: number, y: number, z: number, progress: number): void {
    this.outline.visible = true;
    this.outline.position.set(x + 0.5, y + 0.5, z + 0.5);
    const stage = Math.min(3, Math.floor(progress * 4));
    this.crack.visible = progress > 0.02;
    if (this.crack.visible) {
      this.crack.geometry = this.crackGeos[stage];
      this.crack.position.copy(this.outline.position);
    }
  }

  hide(): void {
    this.outline.visible = this.crack.visible = false;
  }

  dispose(): void {
    this.outline.geometry.dispose();
    (this.outline.material as THREE.Material).dispose();
    this.crackGeos.forEach(g => g.dispose());
    (this.crack.material as THREE.Material).dispose();
    this.outline.removeFromParent();
    this.crack.removeFromParent();
  }
}
