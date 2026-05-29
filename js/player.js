import { CELL } from "./levels.js";
import { cellCenter, moveWithCollision } from "./maze.js";

const EYE_H = 1.7;          // camera height
const RADIUS = 0.55;        // collision radius
const MOVE_SPEED = 6.5;     // units / second
const TURN_SPEED = 2.6;     // radians / second

export class Player {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.heading = 0;          // yaw, radians (0 faces +Z)
    this.pos = { x: 0, z: 0 };
    this.keys = { up: false, down: false, left: false, right: false };
  }

  // Place the player at the centre of a cell, facing into the maze.
  spawn(cellX, cellY) {
    const c = cellCenter(cellX, cellY);
    this.pos.x = c.x;
    this.pos.z = c.z;
    this.heading = 0;
    this.syncCamera();
  }

  setKey(code, down) {
    switch (code) {
      case "ArrowUp": this.keys.up = down; return true;
      case "ArrowDown": this.keys.down = down; return true;
      case "ArrowLeft": this.keys.left = down; return true;
      case "ArrowRight": this.keys.right = down; return true;
    }
    return false;
  }

  releaseAll() {
    this.keys.up = this.keys.down = this.keys.left = this.keys.right = false;
  }

  update(dt, walls) {
    // Turning: left = anti-clockwise, right = clockwise (viewed from above).
    if (this.keys.left) this.heading -= TURN_SPEED * dt;
    if (this.keys.right) this.heading += TURN_SPEED * dt;

    // Forward / backward along the current heading.
    let move = 0;
    if (this.keys.up) move += 1;
    if (this.keys.down) move -= 1;

    if (move !== 0) {
      const dist = move * MOVE_SPEED * dt;
      const dx = Math.sin(this.heading) * dist;
      const dz = Math.cos(this.heading) * dist;
      moveWithCollision(this.pos, dx, dz, RADIUS, walls);
    }
    this.syncCamera();
  }

  syncCamera() {
    this.camera.position.set(this.pos.x, EYE_H, this.pos.z);
    this.camera.rotation.set(0, this.heading, 0);
  }
}

export { RADIUS as PLAYER_RADIUS };
