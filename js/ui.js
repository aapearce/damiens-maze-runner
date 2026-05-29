import { CELL } from "./levels.js";
import { loadBoard } from "./leaderboard.js";

const $ = (id) => document.getElementById(id);

export const dom = {
  hud: $("hud"),
  levelName: $("level-name"),
  hearts: () => document.querySelectorAll("#health-wrap .heart"),
  timer: $("timer"),
  quitBtn: $("quit-btn"),
  mapOverlay: $("map-overlay"),
  mapCanvas: $("mapCanvas"),
  menu: $("menu"),
  death: $("death"),
  win: $("win"),
  board: $("board"),
  boardList: $("board-list"),
  stars: $("stars"),
  scoreLine: $("score-line"),
  nameInput: $("name-input"),
  nameEntry: $("name-entry"),
  wormhole: $("wormhole"),
};

const SCREENS = [dom.menu, dom.death, dom.win, dom.board];

export function showScreen(el) {
  for (const s of SCREENS) s.classList.add("hidden");
  if (el) el.classList.remove("hidden");
}

export function setHudVisible(v) {
  dom.hud.classList.toggle("hidden", !v);
}

export function setLevelName(name) {
  dom.levelName.textContent = name;
}

export function setHealth(hp) {
  dom.hearts().forEach((h, i) => h.classList.toggle("lost", i >= hp));
}

export function setTimer(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  dom.timer.textContent =
    String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
}

export function toggleMap(force) {
  const show =
    force !== undefined ? force : dom.mapOverlay.classList.contains("hidden");
  dom.mapOverlay.classList.toggle("hidden", !show);
  return show;
}

export function isMapOpen() {
  return !dom.mapOverlay.classList.contains("hidden");
}

// Draw a top-down map: walls, exit portal, monsters and the player with a heading wedge.
export function drawMap(cells, walls, player, monsters, portal) {
  const cv = dom.mapCanvas;
  const ctx = cv.getContext("2d");
  const n = cells.length;
  const W = cv.width;
  const pad = 16;
  const span = n * CELL;
  const scale = (W - pad * 2) / (span + CELL);
  const toX = (wx) => pad + (wx + CELL / 2) * scale;
  const toY = (wz) => pad + (wz + CELL / 2) * scale;

  ctx.clearRect(0, 0, W, W);
  ctx.fillStyle = "#070a14";
  ctx.fillRect(0, 0, W, W);

  // walls
  ctx.fillStyle = "#5fa8ff";
  ctx.shadowColor = "#3a78ff";
  ctx.shadowBlur = 6;
  for (const w of walls) {
    ctx.fillRect(toX(w.minX), toY(w.minZ), w.w * scale, w.d * scale);
  }
  ctx.shadowBlur = 0;

  // exit portal
  if (portal) {
    ctx.fillStyle = "#7affd6";
    ctx.beginPath();
    ctx.arc(toX(portal.pos.x), toY(portal.pos.z), 7, 0, Math.PI * 2);
    ctx.fill();
  }

  // monsters
  ctx.fillStyle = "#ff2a4d";
  for (const m of monsters) {
    ctx.beginPath();
    ctx.arc(toX(m.pos.x), toY(m.pos.z), 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // player + heading wedge
  const px = toX(player.pos.x);
  const py = toY(player.pos.z);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(player.heading);
  ctx.fillStyle = "#ffd23f";
  ctx.beginPath();
  // facing +Z in world == downward on canvas; draw triangle pointing that way
  ctx.moveTo(0, 9);
  ctx.lineTo(-6, -6);
  ctx.lineTo(6, -6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function showStars(count) {
  const filled = "★".repeat(count);
  const empty = "★".repeat(3 - count);
  dom.stars.innerHTML = filled + `<span class="dim">${empty}</span>`;
}

export function setScoreLine(text) {
  dom.scoreLine.textContent = text;
}

export function renderBoard() {
  const board = loadBoard();
  const list = dom.boardList;
  list.innerHTML = "";
  if (board.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "No scores yet — be the first!";
    list.appendChild(li);
    return;
  }
  board.forEach((e, i) => {
    const li = document.createElement("li");
    const stars = "★".repeat(e.stars || 0);
    li.innerHTML =
      `<span class="rank">${i + 1}</span>` +
      `<span class="nm">${escapeHtml(e.name)}</span>` +
      `<span class="st">${stars}</span>` +
      `<span class="sc">${e.score}</span>`;
    list.appendChild(li);
  });
}

export function playWormhole(durationMs, onMidpoint) {
  dom.wormhole.classList.remove("hidden");
  // swap the level at the visual peak, then fade out
  setTimeout(() => onMidpoint && onMidpoint(), durationMs * 0.55);
  setTimeout(() => dom.wormhole.classList.add("hidden"), durationMs);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}
