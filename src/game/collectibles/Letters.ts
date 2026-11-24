import * as THREE from "three";
import { glyph, GLYPH_HEIGHT } from "../../fonts/pixelFont";
import type { Vec3 } from "../maps/types";

interface LetterObject { group: THREE.Group; index: number; base: Vec3 }

const PIXEL = 0.13;

/**
 * The hidden letters of the collect word: chunky pink pixel letters that spin and bob,
 * with a soft beam of light above them so they can be spotted from far away.
 */
export class Letters {
  private items: LetterObject[] = [];
  private time = 0;
  private boxGeo = new THREE.BoxGeometry(PIXEL, PIXEL, PIXEL);
  private letterMat = new THREE.MeshBasicMaterial({ color: 0xff5c9a });
  private edgeMat = new THREE.MeshBasicMaterial({ color: 0xffd6e6 });
  private beamMat = new THREE.MeshBasicMaterial({ color: 0xff8ab8, transparent: true, opacity: 0.25, depthWrite: false });
  private beamGeo = new THREE.BoxGeometry(0.18, 10, 0.18);

  constructor(private scene: THREE.Scene, word: string, spots: Vec3[], collected: ReadonlySet<number>) {
    [...word].forEach((ch, index) => {
      const spot = spots[index];
      if (!spot || collected.has(index)) return;
      const group = new THREE.Group();
      const rows = glyph(ch);
      const cells: [number, number][] = [];
      rows.forEach((row, r) => [...row].forEach((c, i) => c === "#" && cells.push([i, r])));
      const mesh = new THREE.InstancedMesh(this.boxGeo, this.letterMat, cells.length);
      const back = new THREE.InstancedMesh(this.boxGeo, this.edgeMat, cells.length);
      const m = new THREE.Matrix4();
      const w = rows[0].length;
      cells.forEach(([i, r], k) => {
        const x = (i - (w - 1) / 2) * PIXEL;
        const y = ((GLYPH_HEIGHT - 1) / 2 - r) * PIXEL;
        m.makeTranslation(x, y, 0);
        mesh.setMatrixAt(k, m);
        m.makeTranslation(x, y, -PIXEL);
        back.setMatrixAt(k, m);
      });
      group.add(mesh, back);
      const beam = new THREE.Mesh(this.beamGeo, this.beamMat);
      beam.position.y = 5.6;
      group.add(beam);
      group.position.set(spot.x, spot.y, spot.z);
      scene.add(group);
      this.items.push({ group, index, base: spot });
    });
  }

  /** Animate, and return the index of a letter the player just touched (or -1). */
  update(dt: number, player: THREE.Vector3): number {
    this.time += dt;
    for (const it of this.items) {
      it.group.rotation.y = this.time * 1.6 + it.index;
      it.group.position.y = it.base.y + Math.sin(this.time * 2 + it.index) * 0.15;
      const dx = player.x - it.base.x;
      const dy = player.y + 0.9 - it.base.y;
      const dz = player.z - it.base.z;
      if (dx * dx + dy * dy * 0.5 + dz * dz < 1.7 * 1.7) {
        it.group.removeFromParent();
        this.items = this.items.filter(x => x !== it);
        return it.index;
      }
    }
    return -1;
  }

  dispose(): void {
    for (const it of this.items) it.group.removeFromParent();
    this.boxGeo.dispose();
    this.beamGeo.dispose();
    this.letterMat.dispose();
    this.edgeMat.dispose();
    this.beamMat.dispose();
    void this.scene;
  }
}
