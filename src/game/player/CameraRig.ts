import * as THREE from "three";
import type { CameraMode } from "../../config/settings";
import type { World } from "../world/World";
import type { Player } from "./Player";

/** Places the camera in first or third person and widens the view a little when sprinting. */
export class CameraRig {
  private fov = 75;
  private dir = new THREE.Vector3();

  constructor(private camera: THREE.PerspectiveCamera, private world: World) {
    camera.rotation.order = "YXZ";
  }

  update(player: Player, mode: CameraMode, dt: number): void {
    const cam = this.camera;
    if (mode === "first") {
      cam.position.copy(player.eye);
    } else {
      // Pull back behind the head, stopping short of any block in the way.
      this.dir.set(-Math.sin(player.yaw) * Math.cos(player.pitch), Math.sin(player.pitch), -Math.cos(player.yaw) * Math.cos(player.pitch));
      const pivot = new THREE.Vector3(player.pos.x, player.pos.y + 1.5, player.pos.z);
      let dist = 0.3;
      for (; dist < 4.2; dist += 0.1) {
        const c = pivot.clone().addScaledVector(this.dir, -dist);
        if (this.world.isSolid(Math.floor(c.x), Math.floor(c.y), Math.floor(c.z))) {
          dist -= 0.25;
          break;
        }
      }
      cam.position.copy(pivot).addScaledVector(this.dir, -Math.max(0.3, dist));
    }
    cam.rotation.set(player.pitch, player.yaw, 0);

    const target = player.sprinting ? 84 : player.flying ? 80 : 75;
    this.fov += (target - this.fov) * Math.min(1, dt * 8);
    if (Math.abs(cam.fov - this.fov) > 0.01) {
      cam.fov = this.fov;
      cam.updateProjectionMatrix();
    }
  }

  /** True when the camera is under water, for the blue tint. */
  underwater(): boolean {
    const p = this.camera.position;
    return this.world.isWater(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z));
  }
}
