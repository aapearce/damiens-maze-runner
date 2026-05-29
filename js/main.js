import { LEVELS, CELL } from "./levels.js";
import { generateMaze, buildWallList, buildMazeMeshes, cellCenter } from "./maze.js";
import { Player, PLAYER_RADIUS } from "./player.js";
import { Monster, MONSTER_RADIUS } from "./monster.js";
import { Portal } from "./portal.js";
import { saveScore } from "./leaderboard.js";
import { CreepSound } from "./audio.js";
import * as ui from "./ui.js";

const DANGER_RANGE = CELL * 3.2; // distance at which the creepy glow/sound peaks

const MAX_HP = 2;
const HIT_COOLDOWN = 1.3; // seconds of invulnerability after a hit

class Game {
  constructor() {
    this.canvas = document.getElementById("renderCanvas");
    this.engine = new BABYLON.Engine(this.canvas, true, { stencil: true });
    this.scene = this._createScene();

    this.state = "menu"; // menu | playing | dead | win | board
    this.mazeMeshes = [];
    this.monsters = [];
    this.walls = [];
    this.cells = [];
    this.level = 0;

    this.hp = MAX_HP;
    this.invuln = 0;
    this.runTime = 0;
    this.deaths = 0;
    this.transitioning = false;
    this.danger = 0; // smoothed monster-proximity intensity 0..1
    this.dangerClock = 0;

    this.creep = new CreepSound();
    this.vignette = document.getElementById("danger-vignette");

    this._bindUI();
    this._bindKeys();

    this.engine.runRenderLoop(() => this._frame());
    window.addEventListener("resize", () => this.engine.resize());

    ui.showScreen(ui.dom.menu);
    ui.setHudVisible(false);
  }

  _createScene() {
    const scene = new BABYLON.Scene(this.engine);
    scene.clearColor = new BABYLON.Color3(0.02, 0.02, 0.05);

    // atmospheric fog (density set per level)
    scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
    scene.fogColor = new BABYLON.Color3(0.03, 0.02, 0.06);
    scene.fogDensity = 0.05;

    // first-person camera, driven manually by Player
    const cam = new BABYLON.UniversalCamera("cam", new BABYLON.Vector3(0, 1.7, 0), scene);
    cam.fov = 1.15;
    cam.minZ = 0.1;
    cam.maxZ = 200;
    this.camera = cam;

    // dim ambient + a torch that follows the player
    const amb = new BABYLON.HemisphericLight("amb", new BABYLON.Vector3(0, 1, 0), scene);
    amb.intensity = 0.18;
    amb.diffuse = new BABYLON.Color3(0.5, 0.45, 0.7);
    amb.groundColor = new BABYLON.Color3(0.1, 0.05, 0.15);

    const torch = new BABYLON.PointLight("torch", new BABYLON.Vector3(0, 1.7, 0), scene);
    torch.intensity = 1.1;
    torch.diffuse = new BABYLON.Color3(1.0, 0.8, 0.6);
    torch.range = CELL * 3.2;
    this.torch = torch;

    // No GlowLayer on purpose: it bleeds emissive glow THROUGH opaque walls.
    // Screen-space bloom (below) only blooms what's actually visible, so walls stay solid.
    this.glow = null;

    const pipe = new BABYLON.DefaultRenderingPipeline("pipe", true, scene, [cam]);
    pipe.bloomEnabled = true;
    pipe.bloomThreshold = 0.55;
    pipe.bloomWeight = 0.7;
    pipe.bloomKernel = 64;
    pipe.bloomScale = 0.6;
    pipe.fxaaEnabled = true;

    this.player = new Player(scene, cam);
    this.portal = new Portal(scene, this.glow);

    return scene;
  }

  // ---------- level lifecycle ----------
  buildLevel(index) {
    this.level = index;
    const cfg = LEVELS[index];

    // tear down old geometry
    for (const m of this.mazeMeshes) m.dispose();
    this.mazeMeshes = [];
    for (const m of this.monsters) m.dispose();
    this.monsters = [];

    // generate + render
    this.cells = generateMaze(cfg.grid);
    this.walls = buildWallList(this.cells);
    this.mazeMeshes = buildMazeMeshes(this.scene, this.cells, this.walls);
    this.scene.fogDensity = cfg.fog;

    // player at start corner
    this.player.spawn(0, 0);
    this.player.releaseAll();

    // exit portal at opposite corner
    this.portal.place(cfg.grid - 1, cfg.grid - 1);

    // monsters at random cells far from the start
    for (let i = 0; i < cfg.monsters; i++) {
      const mon = new Monster(this.scene, this.glow);
      const [cx, cy] = this._farSpawnCell(cfg.grid);
      mon.spawn(cx, cy, cfg.monsterSpeed);
      this.monsters.push(mon);
    }

    this.hp = MAX_HP;
    this.invuln = 0;
    ui.setHealth(this.hp);
    ui.setLevelName(cfg.name);
  }

  _farSpawnCell(grid) {
    let cx, cy;
    do {
      cx = (Math.random() * grid) | 0;
      cy = (Math.random() * grid) | 0;
    } while (cx + cy < grid); // keep them in the far half, away from the player start
    return [cx, cy];
  }

  startRun(level) {
    // audio must be unlocked from a user gesture — this is called from a button click
    this.creep.start();
    this.creep.resume();
    this.runTime = 0;
    this.deaths = 0;
    this.transitioning = false;
    this.buildLevel(level);
    this.state = "playing";
    ui.toggleMap(false);
    ui.showScreen(null);
    ui.setHudVisible(true);
    this.canvas.focus();
  }

  retryLevel() {
    this.deaths++;
    this.transitioning = false;
    this.buildLevel(this.level);
    this.state = "playing";
    ui.toggleMap(false);
    ui.showScreen(null);
    ui.setHudVisible(true);
  }

  // ---------- per-frame ----------
  _frame() {
    const dt = Math.min(this.engine.getDeltaTime() / 1000, 0.05);

    if (this.state === "playing" && !this.transitioning && !ui.isMapOpen()) {
      this.runTime += dt;
      ui.setTimer(this.runTime);

      this.player.update(dt, this.walls);
      for (const m of this.monsters) m.update(dt, this.walls);
      this.portal.update(dt);

      if (this.invuln > 0) this.invuln -= dt;
      this._checkMonsters();
      this._updateDanger(dt);
      this._checkExit();
    } else {
      // keep the portal swirling on menus/death for ambience; no danger here
      this.portal.update(dt);
      this._clearDanger();
    }

    // torch follows the camera
    this.torch.position.copyFrom(this.camera.position);

    this.scene.render();
  }

  _checkMonsters() {
    if (this.invuln > 0) return;
    const reach = PLAYER_RADIUS + MONSTER_RADIUS + 0.15;
    for (const m of this.monsters) {
      const d = Math.hypot(this.player.pos.x - m.pos.x, this.player.pos.z - m.pos.z);
      if (d < reach) {
        this.hp--;
        this.invuln = HIT_COOLDOWN;
        ui.setHealth(Math.max(0, this.hp));
        if (this.hp <= 0) this._die();
        return;
      }
    }
  }

  // Red glow + creepy sound that intensify as the NEAREST monster gets closer.
  // Based on straight-line distance, so you sense them even through walls.
  _updateDanger(dt) {
    let nearest = Infinity;
    for (const m of this.monsters) {
      const d = Math.hypot(this.player.pos.x - m.pos.x, this.player.pos.z - m.pos.z);
      if (d < nearest) nearest = d;
    }
    const target = Math.max(0, 1 - nearest / DANGER_RANGE);
    // smooth toward target so it eases in/out
    this.danger += (target - this.danger) * Math.min(1, dt * 6);

    this.dangerClock += dt * (4 + this.danger * 6);
    const pulse = 0.78 + 0.22 * Math.sin(this.dangerClock); // subtle heartbeat
    this.vignette.style.opacity = (this.danger * pulse).toFixed(3);
    this.creep.setIntensity(this.danger);
  }

  _clearDanger() {
    this.danger = 0;
    if (this.vignette) this.vignette.style.opacity = "0";
    this.creep.silence();
  }

  _checkExit() {
    if (this.portal.contains(this.player.pos.x, this.player.pos.z)) {
      this._completeLevel();
    }
  }

  _die() {
    this.state = "dead";
    this.player.releaseAll();
    ui.setHudVisible(false);
    ui.showScreen(ui.dom.death);
  }

  _completeLevel() {
    if (this.transitioning) return;
    this.transitioning = true;
    this.player.releaseAll();

    if (this.level >= LEVELS.length - 1) {
      this._win();
      return;
    }
    // wormhole transition into the next level
    ui.playWormhole(1400, () => {
      this.buildLevel(this.level + 1);
      this.transitioning = false;
    });
  }

  _win() {
    this.state = "win";
    ui.setHudVisible(false);

    const score = Math.max(0, Math.round(10000 - this.runTime * 10 - this.deaths * 600));
    const stars = score >= 7000 ? 3 : score >= 4000 ? 2 : 1;
    this.pendingScore = { score, stars, time: Math.round(this.runTime) };

    ui.showStars(stars);
    ui.setScoreLine(
      `Score ${score}  •  Time ${this._fmt(this.runTime)}  •  Deaths ${this.deaths}`
    );
    ui.dom.nameInput.value = "";
    ui.dom.nameEntry.style.display = "flex";
    ui.showScreen(ui.dom.win);
    setTimeout(() => ui.dom.nameInput.focus(), 50);
  }

  _fmt(s) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }

  quitToMenu() {
    this.state = "menu";
    this.transitioning = false;
    this.player.releaseAll();
    ui.toggleMap(false);
    ui.setHudVisible(false);
    ui.showScreen(ui.dom.menu);
  }

  // ---------- input / UI wiring ----------
  _bindKeys() {
    window.addEventListener("keydown", (e) => {
      if (e.key === "m" || e.key === "M") {
        if (this.state === "playing" && !this.transitioning) {
          const open = ui.toggleMap();
          if (open) ui.drawMap(this.cells, this.walls, this.player, this.monsters, this.portal);
          else this.player.releaseAll();
        }
        e.preventDefault();
        return;
      }
      if (this.state === "playing" && !ui.isMapOpen() && this.player.setKey(e.key, true)) {
        e.preventDefault();
      }
    });
    window.addEventListener("keyup", (e) => {
      if (this.player.setKey(e.key, false)) e.preventDefault();
    });
    // keep the map fresh while it's open
    setInterval(() => {
      if (ui.isMapOpen() && this.state === "playing") {
        ui.drawMap(this.cells, this.walls, this.player, this.monsters, this.portal);
      }
    }, 120);
  }

  _bindUI() {
    document.querySelectorAll(".lvl-btn[data-level]").forEach((btn) => {
      btn.addEventListener("click", () => this.startRun(+btn.dataset.level));
    });
    ui.dom.quitBtn.addEventListener("click", () => this.quitToMenu());
    document.getElementById("retry-btn").addEventListener("click", () => this.retryLevel());
    document.getElementById("death-menu-btn").addEventListener("click", () => this.quitToMenu());
    document.getElementById("win-menu-btn").addEventListener("click", () => this.quitToMenu());

    document.getElementById("show-board-btn").addEventListener("click", () => {
      ui.renderBoard();
      ui.showScreen(ui.dom.board);
    });
    document.getElementById("board-back-btn").addEventListener("click", () => {
      ui.showScreen(ui.dom.menu);
    });
    document.getElementById("save-score-btn").addEventListener("click", () => {
      const name = (ui.dom.nameInput.value || "Runner").trim().slice(0, 12) || "Runner";
      saveScore({ name, ...this.pendingScore, date: Date.now() });
      ui.dom.nameEntry.style.display = "none";
      ui.renderBoard();
      ui.showScreen(ui.dom.board);
    });
  }
}

window.addEventListener("DOMContentLoaded", () => new Game());
