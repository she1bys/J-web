import * as THREE from "three";
import { BLOCKS } from "../world/blocks";
import { tileUV } from "../textures/atlas";
import { itemDef } from "../items/items";
import { itemIcon } from "../items/itemIcons";

/**
 * The item in your hand in first person, bottom-right of the view.
 * It bobs while walking and swings when you mine, build or eat.
 * An empty hand shows the character's own sleeve and hand.
 */
export class HeldItem {
  private group = new THREE.Group();
  private current: THREE.Object3D | null = null;
  private currentId = -2;
  private swingT = 1;
  private bobT = 0;
  private materials: THREE.Material[] = [];

  constructor(camera: THREE.Camera, private texture: THREE.Texture) {
    this.group.position.set(0.42, -0.38, -0.62);
    camera.add(this.group);
  }

  set visible(on: boolean) {
    this.group.visible = on;
  }

  /** Show the item with this id (or an empty hand for -1). */
  show(id: number): void {
    if (id === this.currentId) return;
    this.currentId = id;
    if (this.current) {
      this.group.remove(this.current);
      this.current.traverse(o => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
    }
    this.materials.forEach(m => m.dispose());
    this.materials = [];
    this.current = this.build(id);
    this.group.add(this.current);
  }

  swing(): void {
    this.swingT = 0;
  }

  update(dt: number, walking: number, light: number): void {
    this.bobT += dt * walking * 1.6;
    this.swingT = Math.min(1, this.swingT + dt * 4.5);
    const s = Math.sin(this.swingT * Math.PI);
    this.group.position.set(
      0.42 + Math.sin(this.bobT) * 0.02 - s * 0.12,
      -0.38 - Math.abs(Math.cos(this.bobT)) * 0.02 - s * 0.1,
      -0.62 - s * 0.08,
    );
    this.group.rotation.set(-s * 0.9, -0.5 + s * 0.3, 0);
    for (const m of this.materials) (m as THREE.MeshBasicMaterial).color.setScalar(light);
  }

  private mat(params: THREE.MeshBasicMaterialParameters): THREE.MeshBasicMaterial {
    // Drawn on top of the world so it never clips into nearby blocks.
    const m = new THREE.MeshBasicMaterial({ ...params, fog: false, depthTest: false, depthWrite: false });
    this.materials.push(m);
    return m;
  }

  private build(id: number): THREE.Object3D {
    const def = id >= 0 ? itemDef(id) : undefined;
    let obj: THREE.Object3D;
    if (def?.block !== undefined) {
      const g = new THREE.BoxGeometry(0.3, 0.3, 0.3);
      const tiles = BLOCKS[def.block]?.tiles ?? [0, 0, 0];
      const faceTile = [tiles[1], tiles[1], tiles[0], tiles[2], tiles[1], tiles[1]];
      const uv = g.attributes.uv;
      const shade = [0.8, 0.8, 1, 0.55, 0.68, 0.68];
      const cols: number[] = [];
      for (let f = 0; f < 6; f++) {
        const [u0, v0, u1, v1] = tileUV(faceTile[f]);
        for (let k = 0; k < 4; k++) {
          const i = f * 4 + k;
          uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
          cols.push(shade[f], shade[f], shade[f]);
        }
      }
      g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
      obj = new THREE.Mesh(g, this.mat({ map: this.texture, vertexColors: true, alphaTest: 0.5 }));
      obj.rotation.set(0.15, 0.7, 0);
    } else if (def) {
      const tex = new THREE.CanvasTexture(itemIcon(id));
      tex.magFilter = tex.minFilter = THREE.NearestFilter;
      tex.colorSpace = THREE.SRGBColorSpace;
      const m = this.mat({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide });
      obj = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), m);
      obj.rotation.set(0, 0.9, 0.3);
      obj.position.set(0.02, 0.08, 0);
    } else {
      // Empty hand: black sleeve, white hand
      const arm = new THREE.Group();
      const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.5), this.mat({ color: 0x1a1a1a }));
      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.14), this.mat({ color: 0xf6f2ee }));
      hand.position.z = -0.3;
      arm.add(sleeve, hand);
      arm.position.set(0.08, -0.08, 0.1);
      arm.rotation.set(0.25, -0.2, 0);
      obj = arm;
    }
    obj.renderOrder = 999;
    obj.traverse(o => (o.renderOrder = 999));
    return obj;
  }

  dispose(): void {
    this.show(-2);
    this.group.removeFromParent();
  }
}
