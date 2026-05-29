# 🏃 Damien's Maze Runner

A first-person 3D maze game built with [Babylon.js](https://www.babylonjs.com/). You're *inside* a dark, foggy maze — find the glowing wormhole exit while avoiding masked red monsters.

## ▶️ Play

**[Play it here](https://aapearce.github.io/damiens-maze-runner/)** (GitHub Pages)

Or run locally — it's a static site, so any web server works:

```bash
# from the project folder
python3 -m http.server 8000
# then open http://localhost:8000
```

> It must be served over http(s), not opened as a `file://` path, because it uses ES modules.

## 🎮 Controls

| Key | Action |
| --- | --- |
| **↑** | Move forward |
| **↓** | Move backward |
| **←** | Turn anti-clockwise |
| **→** | Turn clockwise |
| **M** | Toggle the maze map |
| **✕ Quit** (top-right) | Return to the main menu |

**On phones/tablets** the game auto-shows on-screen touch controls: turn ◄ ► buttons (bottom-left), move ▲ ▼ buttons (bottom-right), and a **🗺 MAP** button (bottom-centre — tap the map to close it).

## 🧩 Features

- **First-person 3D maze** with atmospheric fog, dynamic torch light, and bloom/glow.
- **Three levels** — Easy, Medium, Hard — with progressively larger mazes and faster monsters (3 monsters on Hard).
- **Masked red monsters** that wander **randomly** — they have *no knowledge* of your location.
- **Health bar** — two hits from a monster and you're done.
- **Map view** (press **M**) showing walls, the exit, monsters, and your position + heading.
- **Wormhole transitions** between levels — reach the exit and get sucked into the next maze.
- **Death** restarts you at the same level.
- **3-star ranking** based on time and deaths, plus a **local top-10 leaderboard**.

## 🛠️ Tech

- **Babylon.js** (loaded from CDN) for 3D rendering, particles, glow layer, and bloom post-processing.
- Vanilla ES modules — no build step.
- Leaderboard stored in the browser via `localStorage`.

## 📁 Structure

```
index.html      # markup + HUD/menus/overlays
style.css       # all styling
js/
  main.js       # game orchestration, scene, loop, state machine
  levels.js     # level/difficulty config + shared constants
  maze.js       # maze generation, 3D build, collision
  player.js     # first-person camera + controls
  monster.js    # wandering masked monsters
  portal.js     # the wormhole exit
  ui.js         # HUD, screens, map, leaderboard rendering
  leaderboard.js# localStorage top-10
```

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
