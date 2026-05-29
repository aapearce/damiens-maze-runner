import { CELL } from "./levels.js";
import { cellCenter, moveWithCollision } from "./maze.js";

const RADIUS = 0.6;

// A masked red monster that wanders the maze on random cardinal headings.
// It has NO knowledge of the player's position — movement is purely random.
export class Monster {
  constructor(scene, glow) {
    this.scene = scene;
    this.pos = { x: 0, z: 0 };
    this.speed = 2;
    this.dir = this._randomDir();
    this.changeTimer = 0;
    this.bob = Math.random() * Math.PI * 2;
    this.root = this._build(scene, glow);
  }

  _randomDir() {
    const dirs = [
      { x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 },
    ];
    return dirs[(Math.random() * dirs.length) | 0];
  }

  _build(scene, glow) {
    const root = new BABYLON.TransformNode("monster", scene);

    // glowing red emissive material for the body
    const body = BABYLON.MeshBuilder.CreateCapsule(
      "mbody", { radius: 0.5, height: 1.7 }, scene
    );
    body.position.y = 0.95;
    const bodyMat = new BABYLON.StandardMaterial("mbodyMat", scene);
    bodyMat.diffuseColor = new BABYLON.Color3(0.6, 0.02, 0.06);
    bodyMat.emissiveColor = new BABYLON.Color3(0.85, 0.05, 0.12);
    bodyMat.specularColor = new BABYLON.Color3(1, 0.4, 0.4);
    body.material = bodyMat;
    body.parent = root;

    // pale "mask" face plate
    const mask = BABYLON.MeshBuilder.CreateBox(
      "mmask", { width: 0.7, height: 0.55, depth: 0.18 }, scene
    );
    mask.position.set(0, 1.25, 0.42);
    const maskMat = new BABYLON.StandardMaterial("mmaskMat", scene);
    maskMat.diffuseColor = new BABYLON.Color3(0.95, 0.92, 0.88);
    maskMat.emissiveColor = new BABYLON.Color3(0.35, 0.33, 0.3);
    mask.material = maskMat;
    mask.parent = root;

    // two glowing eyes
    const eyeMat = new BABYLON.StandardMaterial("meyeMat", scene);
    eyeMat.emissiveColor = new BABYLON.Color3(1, 0.85, 0.1);
    eyeMat.diffuseColor = new BABYLON.Color3(0, 0, 0);
    for (const ex of [-0.16, 0.16]) {
      const eye = BABYLON.MeshBuilder.CreateSphere("meye", { diameter: 0.14 }, scene);
      eye.position.set(ex, 1.3, 0.52);
      eye.material = eyeMat;
      eye.parent = root;
    }

    // two horns
    const hornMat = new BABYLON.StandardMaterial("mhornMat", scene);
    hornMat.diffuseColor = new BABYLON.Color3(0.1, 0.0, 0.0);
    hornMat.emissiveColor = new BABYLON.Color3(0.3, 0.0, 0.05);
    for (const hx of [-0.28, 0.28]) {
      const horn = BABYLON.MeshBuilder.CreateCylinder(
        "mhorn", { height: 0.5, diameterBottom: 0.18, diameterTop: 0.0 }, scene
      );
      horn.position.set(hx, 1.7, 0.1);
      horn.rotation.z = hx < 0 ? 0.3 : -0.3;
      horn.material = hornMat;
      horn.parent = root;
    }

    if (glow) {
      glow.addIncludedOnlyMesh(body);
      glow.addIncludedOnlyMesh(mask);
    }
    return root;
  }

  spawn(cellX, cellY, speed) {
    const c = cellCenter(cellX, cellY);
    this.pos.x = c.x;
    this.pos.z = c.z;
    this.speed = speed;
    this.dir = this._randomDir();
    this.changeTimer = 0.5 + Math.random() * 1.5;
    this._sync();
  }

  update(dt, walls) {
    this.changeTimer -= dt;
    const before = { x: this.pos.x, z: this.pos.z };

    const dist = this.speed * dt;
    moveWithCollision(this.pos, this.dir.x * dist, this.dir.z * dist, RADIUS, walls);

    // If blocked (barely moved) or timer elapsed, pick a fresh random direction.
    const moved = Math.hypot(this.pos.x - before.x, this.pos.z - before.z);
    if (this.changeTimer <= 0 || moved < dist * 0.4) {
      this.dir = this._randomDir();
      this.changeTimer = 0.8 + Math.random() * 2.2;
    }

    // gentle floating bob + face travel direction
    this.bob += dt * 4;
    this.root.position.set(this.pos.x, Math.sin(this.bob) * 0.12, this.pos.z);
    this.root.rotation.y = Math.atan2(this.dir.x, this.dir.z);
  }

  _sync() {
    this.root.position.set(this.pos.x, 0, this.pos.z);
  }

  dispose() {
    this.root.dispose();
  }
}

export { RADIUS as MONSTER_RADIUS };
