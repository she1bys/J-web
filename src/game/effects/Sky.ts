import * as THREE from "three";
import type { SkyPalette } from "../maps/types";

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Sky colour, fog, a pixel sun and moon, and stars, all driven by the time of day.
 * time: 0 sunrise · 0.25 noon · 0.5 sunset · 0.75 midnight.
 */
export class Sky {
  /** Brightness applied to the world, 0.3 (night) to 1 (day). */
  light = 1;
  private group = new THREE.Group();
  private sun: THREE.Mesh;
  private moon: THREE.Mesh;
  private stars: THREE.Points;
  private color = new THREE.Color();
  private day: THREE.Color;
  private night: THREE.Color;
  private dusk: THREE.Color;
  private water = new THREE.Color(0x1d4f8f);

  constructor(private scene: THREE.Scene, palette: SkyPalette, private fogRange: [number, number]) {
    this.day = new THREE.Color(palette.day);
    this.night = new THREE.Color(palette.night);
    this.dusk = new THREE.Color(palette.dusk);
    scene.background = this.color;
    scene.fog = new THREE.Fog(this.color.getHex(), fogRange[0], fogRange[1]);

    const disc = (size: number, color: number) =>
      new THREE.Mesh(
        new THREE.PlaneGeometry(size, size),
        new THREE.MeshBasicMaterial({ color, fog: false, depthWrite: false, transparent: true }),
      );
    this.sun = disc(16, 0xfff0a0);
    this.moon = disc(10, 0xe8ecf5);

    const starPos: number[] = [];
    for (let i = 0; i < 400; i++) {
      const u = Math.random() * 2 - 1;
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      starPos.push(Math.cos(a) * r * 150, Math.abs(u) * 150, Math.sin(a) * r * 150);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.Float32BufferAttribute(starPos, 3));
    this.stars = new THREE.Points(
      sg,
      new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, fog: false, transparent: true, depthWrite: false }),
    );
    for (const o of [this.sun, this.moon, this.stars]) o.renderOrder = -1;
    this.group.add(this.sun, this.moon, this.stars);
    scene.add(this.group);
  }

  update(time: number, camera: THREE.Camera, underwater: boolean): void {
    const angle = time * Math.PI * 2;
    const sunH = Math.sin(angle);
    this.light = 0.3 + 0.7 * smoothstep(-0.12, 0.22, sunH);
    const dayAmt = smoothstep(-0.2, 0.3, sunH);
    const duskAmt = Math.max(0, 1 - Math.abs(sunH) / 0.3) * 0.6;

    this.color.copy(this.night).lerp(this.day, dayAmt).lerp(this.dusk, duskAmt);
    const fog = this.scene.fog as THREE.Fog;
    if (underwater) {
      fog.color.copy(this.water).multiplyScalar(this.light);
      fog.near = 0.5;
      fog.far = 14;
      (this.scene.background as THREE.Color).copy(fog.color);
    } else {
      fog.color.copy(this.color);
      fog.near = this.fogRange[0];
      fog.far = this.fogRange[1];
    }

    // Sun and moon travel across the sky, always facing the camera.
    this.group.position.copy(camera.position);
    const dir = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0.35).normalize();
    this.sun.position.copy(dir).multiplyScalar(120);
    this.moon.position.copy(dir).multiplyScalar(-120);
    this.sun.lookAt(camera.position);
    this.moon.lookAt(camera.position);
    (this.stars.material as THREE.PointsMaterial).opacity = 1 - smoothstep(-0.25, 0.05, sunH);
    this.stars.rotation.y = angle * 0.2;
  }

  dispose(): void {
    this.group.traverse(o => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Points) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
    this.group.removeFromParent();
  }
}
