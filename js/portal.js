import { CELL, WALL_H } from "./levels.js";
import { cellCenter } from "./maze.js";

// A glowing, swirling wormhole that marks the maze exit.
export class Portal {
  constructor(scene, glow) {
    this.scene = scene;
    this.pos = { x: 0, z: 0 };
    this.t = 0;
    this.root = this._build(scene, glow);
  }

  _build(scene, glow) {
    const root = new BABYLON.TransformNode("portal", scene);

    // Outer ring (torus)
    const ring = BABYLON.MeshBuilder.CreateTorus(
      "pring", { diameter: 2.6, thickness: 0.35, tessellation: 40 }, scene
    );
    const ringMat = new BABYLON.StandardMaterial("pringMat", scene);
    ringMat.emissiveColor = new BABYLON.Color3(0.35, 0.8, 1.0);
    ringMat.diffuseColor = new BABYLON.Color3(0.05, 0.2, 0.4);
    ring.material = ringMat;
    ring.parent = root;
    this.ring = ring;

    // Swirling disc inside the ring (animated emissive)
    const disc = BABYLON.MeshBuilder.CreateDisc("pdisc", { radius: 1.25, tessellation: 48 }, scene);
    const discMat = new BABYLON.StandardMaterial("pdiscMat", scene);
    discMat.emissiveColor = new BABYLON.Color3(0.5, 0.2, 0.9);
    discMat.diffuseColor = new BABYLON.Color3(0.1, 0, 0.2);
    discMat.disableLighting = true;
    discMat.backFaceCulling = false;
    disc.material = discMat;
    disc.parent = root;
    this.disc = disc;
    this.discMat = discMat;

    // Spiralling particle vortex
    const ps = new BABYLON.ParticleSystem("pparticles", 600, scene);
    ps.particleTexture = makeGlowTexture(scene);
    ps.emitter = root;
    ps.minEmitBox = new BABYLON.Vector3(-1.1, -1.1, 0);
    ps.maxEmitBox = new BABYLON.Vector3(1.1, 1.1, 0);
    ps.color1 = new BABYLON.Color4(0.4, 0.8, 1, 1);
    ps.color2 = new BABYLON.Color4(0.7, 0.3, 1, 1);
    ps.colorDead = new BABYLON.Color4(0, 0, 0.2, 0);
    ps.minSize = 0.1; ps.maxSize = 0.35;
    ps.minLifeTime = 0.4; ps.maxLifeTime = 0.9;
    ps.emitRate = 300;
    ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
    ps.gravity = new BABYLON.Vector3(0, 0, 0);
    ps.minAngularSpeed = 3; ps.maxAngularSpeed = 6;
    ps.minEmitPower = 0.2; ps.maxEmitPower = 0.6;
    ps.direction1 = new BABYLON.Vector3(-0.4, -0.4, 0);
    ps.direction2 = new BABYLON.Vector3(0.4, 0.4, 0);
    ps.start();
    this.ps = ps;

    if (glow) glow.addIncludedOnlyMesh(ring);
    return root;
  }

  place(cellX, cellY, facing = 0) {
    const c = cellCenter(cellX, cellY);
    this.pos.x = c.x;
    this.pos.z = c.z;
    this.root.position.set(c.x, WALL_H * 0.5, c.z);
    this.root.rotation.y = facing;
  }

  update(dt) {
    this.t += dt;
    this.ring.rotation.z += dt * 1.2;
    this.disc.rotation.z -= dt * 2.5;
    // pulse the disc colour
    const p = 0.6 + Math.sin(this.t * 3) * 0.25;
    this.discMat.emissiveColor.set(0.5 * p, 0.2 * p, 0.95 * p);
  }

  // is the player standing in the portal?
  contains(px, pz, r = 1.4) {
    return Math.hypot(px - this.pos.x, pz - this.pos.z) < r;
  }

  dispose() {
    this.ps.dispose();
    this.root.dispose();
  }
}

// small radial-gradient texture for glowing particles
function makeGlowTexture(scene) {
  const size = 64;
  const dt = new BABYLON.DynamicTexture("glowTex", size, scene, false);
  const ctx = dt.getContext();
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.4, "rgba(180,220,255,0.8)");
  g.addColorStop(1, "rgba(120,160,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  dt.hasAlpha = true;
  dt.update();
  return dt;
}
