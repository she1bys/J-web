import * as THREE from "three";

/** A box whose faces are shaded by direction, so flat colours still read as 3D. */
export function shadedBox(w: number, h: number, d: number, color: THREE.ColorRepresentation): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d);
  const n = geo.attributes.normal;
  const base = new THREE.Color(color);
  const cols: number[] = [];
  for (let i = 0; i < n.count; i++) {
    const s = n.getY(i) > 0.5 ? 1 : n.getY(i) < -0.5 ? 0.55 : Math.abs(n.getX(i)) > 0.5 ? 0.8 : 0.68;
    cols.push(base.r * s, base.g * s, base.b * s);
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true }));
}

/** The player's character: an original blocky figure in black and white with a pink heart. */
export class Character {
  readonly root = new THREE.Group();
  private legL: THREE.Group;
  private legR: THREE.Group;
  private armL: THREE.Group;
  private armR: THREE.Group;
  private phase = 0;

  constructor() {
    const ink = 0x1a1a1a;
    this.legL = this.limb(0.24, 0.72, 0.26, ink, -0.13, 0.72);
    this.legR = this.limb(0.24, 0.72, 0.26, ink, 0.13, 0.72);
    this.armL = this.limb(0.18, 0.64, 0.22, ink, -0.36, 1.36);
    this.armR = this.limb(0.18, 0.64, 0.22, ink, 0.36, 1.36);
    this.add(shadedBox(0.52, 0.66, 0.3, ink), 0, 1.05, 0);
    this.add(shadedBox(0.14, 0.12, 0.02, 0xff5c9a), 0, 1.18, -0.16); // heart on the chest
    this.add(shadedBox(0.48, 0.46, 0.48, 0xf6f2ee), 0, 1.6, 0); // head
    this.add(shadedBox(0.52, 0.12, 0.52, 0x111111), 0, 1.86, 0); // hair
    this.add(shadedBox(0.52, 0.34, 0.08, 0x111111), 0, 1.66, 0.24);
    this.add(shadedBox(0.08, 0.1, 0.02, 0x111111), -0.11, 1.62, -0.245); // eyes
    this.add(shadedBox(0.08, 0.1, 0.02, 0x111111), 0.11, 1.62, -0.245);
  }

  private limb(w: number, h: number, d: number, color: number, x: number, y: number): THREE.Group {
    const pivot = new THREE.Group();
    const m = shadedBox(w, h, d, color);
    m.position.y = -h / 2;
    pivot.add(m);
    pivot.position.set(x, y, 0);
    this.root.add(pivot);
    return pivot;
  }

  private add(m: THREE.Mesh, x: number, y: number, z: number): void {
    m.position.set(x, y, z);
    this.root.add(m);
  }

  /** Swing arms and legs in proportion to speed; arms raise while swimming or flying. */
  animate(dt: number, speed: number, airborne: boolean): void {
    const moving = speed > 0.5;
    this.phase = moving ? this.phase + dt * (4 + speed * 1.2) : this.phase * 0.85;
    const swing = Math.sin(this.phase) * Math.min(0.9, speed * 0.15);
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    const lift = airborne ? -0.6 : 0;
    this.armL.rotation.x = -swing + lift;
    this.armR.rotation.x = swing + lift;
  }

  dispose(): void {
    this.root.traverse(o => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
    this.root.removeFromParent();
  }
}
