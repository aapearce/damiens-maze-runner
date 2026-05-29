import { CELL, WALL_H, WALL_T } from "./levels.js";

// Generate a "perfect" maze using iterative randomized depth-first search (recursive backtracker).
// Each cell tracks which of its 4 walls still stand.
export function generateMaze(n) {
  const cells = [];
  for (let x = 0; x < n; x++) {
    cells[x] = [];
    for (let y = 0; y < n; y++) {
      cells[x][y] = { x, y, N: true, S: true, E: true, W: true, visited: false };
    }
  }

  const stack = [];
  let current = cells[0][0];
  current.visited = true;
  let visitedCount = 1;
  const total = n * n;

  while (visitedCount < total) {
    const neighbors = [];
    const { x, y } = current;
    if (y > 0 && !cells[x][y - 1].visited) neighbors.push(["N", cells[x][y - 1]]);
    if (y < n - 1 && !cells[x][y + 1].visited) neighbors.push(["S", cells[x][y + 1]]);
    if (x < n - 1 && !cells[x + 1][y].visited) neighbors.push(["E", cells[x + 1][y]]);
    if (x > 0 && !cells[x - 1][y].visited) neighbors.push(["W", cells[x - 1][y]]);

    if (neighbors.length === 0) {
      current = stack.pop();
      continue;
    }
    const [dir, next] = neighbors[(Math.random() * neighbors.length) | 0];
    // knock down the wall between current and next
    const opp = { N: "S", S: "N", E: "W", W: "E" }[dir];
    current[dir] = false;
    next[opp] = false;

    stack.push(current);
    next.visited = true;
    visitedCount++;
    current = next;
  }
  return cells;
}

// World-space center of a cell.
export function cellCenter(x, y) {
  return { x: x * CELL, z: y * CELL };
}

// Build the de-duplicated list of standing-wall AABBs ({minX,maxX,minZ,maxZ}) used for collision,
// plus parallel box descriptors for rendering.
export function buildWallList(cells) {
  const n = cells.length;
  const keys = new Set();
  const half = CELL / 2;

  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) {
      const c = cells[x][y];
      if (c.N) keys.add(`H_${x}_${y}`);       // north edge of (x,y)
      if (c.S) keys.add(`H_${x}_${y + 1}`);   // south edge == north edge of (x,y+1)
      if (c.W) keys.add(`V_${x}_${y}`);        // west edge of (x,y)
      if (c.E) keys.add(`V_${x + 1}_${y}`);    // east edge == west edge of (x+1,y)
    }
  }

  const walls = [];
  for (const key of keys) {
    const [type, ax, ay] = key.split("_");
    const i = +ax, j = +ay;
    if (type === "H") {
      // horizontal wall spanning x of cell i, at the boundary line z = j*CELL - half
      const cx = i * CELL;
      const cz = j * CELL - half;
      walls.push(makeWall(cx, cz, CELL + WALL_T, WALL_T));
    } else {
      const cx = i * CELL - half;
      const cz = j * CELL;
      walls.push(makeWall(cx, cz, WALL_T, CELL + WALL_T));
    }
  }
  return walls;
}

function makeWall(cx, cz, w, d) {
  return {
    cx, cz, w, d,
    minX: cx - w / 2, maxX: cx + w / 2,
    minZ: cz - d / 2, maxZ: cz + d / 2,
  };
}

// Create the visible 3D meshes for floor, ceiling and walls. Returns the meshes so they can be disposed.
export function buildMazeMeshes(scene, cells, walls) {
  const n = cells.length;
  const span = n * CELL;
  const meshes = [];

  // ----- Floor -----
  const floor = BABYLON.MeshBuilder.CreateGround(
    "floor",
    { width: span + CELL, height: span + CELL },
    scene
  );
  floor.position.set((span - CELL) / 2, 0, (span - CELL) / 2);
  const floorMat = new BABYLON.StandardMaterial("floorMat", scene);
  floorMat.diffuseColor = new BABYLON.Color3(0.07, 0.07, 0.1);
  floorMat.specularColor = new BABYLON.Color3(0.15, 0.05, 0.2);
  floor.material = floorMat;
  meshes.push(floor);

  // ----- Ceiling -----
  const ceil = BABYLON.MeshBuilder.CreateGround(
    "ceil",
    { width: span + CELL, height: span + CELL },
    scene
  );
  ceil.position.set((span - CELL) / 2, WALL_H, (span - CELL) / 2);
  ceil.rotation.x = Math.PI; // face downward
  const ceilMat = new BABYLON.StandardMaterial("ceilMat", scene);
  ceilMat.diffuseColor = new BABYLON.Color3(0.04, 0.04, 0.07);
  ceil.material = ceilMat;
  meshes.push(ceil);

  // ----- Walls (built individually, then merged for performance) -----
  const wallMat = new BABYLON.StandardMaterial("wallMat", scene);
  wallMat.diffuseColor = new BABYLON.Color3(0.16, 0.13, 0.22);
  wallMat.specularColor = new BABYLON.Color3(0.4, 0.2, 0.5);
  wallMat.emissiveColor = new BABYLON.Color3(0.05, 0.02, 0.09);

  const wallMeshes = [];
  for (let i = 0; i < walls.length; i++) {
    const w = walls[i];
    const box = BABYLON.MeshBuilder.CreateBox(
      "w" + i,
      { width: w.w, height: WALL_H, depth: w.d },
      scene
    );
    box.position.set(w.cx, WALL_H / 2, w.cz);
    wallMeshes.push(box);
  }
  let merged = null;
  if (wallMeshes.length) {
    merged = BABYLON.Mesh.MergeMeshes(wallMeshes, true, true, undefined, false, false);
    merged.material = wallMat;
    meshes.push(merged);
  }

  return meshes;
}

// Resolve a circle (entity) of `radius` against the wall AABBs.
// Applies the full move, then pushes the circle out of any overlapping wall along the
// shortest vector (handles flat faces and corners). A couple of passes settle tight spots.
// Mutates and returns {x, z}.
export function moveWithCollision(pos, dx, dz, radius, walls) {
  pos.x += dx;
  pos.z += dz;
  for (let pass = 0; pass < 2; pass++) {
    for (const w of walls) resolveCircle(pos, radius, w);
  }
  return pos;
}

function resolveCircle(pos, r, w) {
  const closestX = clamp(pos.x, w.minX, w.maxX);
  const closestZ = clamp(pos.z, w.minZ, w.maxZ);
  const dx = pos.x - closestX;
  const dz = pos.z - closestZ;
  const d2 = dx * dx + dz * dz;

  if (d2 > 1e-9) {
    if (d2 >= r * r) return; // no overlap
    const d = Math.sqrt(d2);
    const push = (r - d) / d;
    pos.x += dx * push;
    pos.z += dz * push;
  } else {
    // center is inside the box — eject through the nearest face
    const toLeft = pos.x - w.minX;
    const toRight = w.maxX - pos.x;
    const toTop = pos.z - w.minZ;
    const toBottom = w.maxZ - pos.z;
    const m = Math.min(toLeft, toRight, toTop, toBottom);
    if (m === toLeft) pos.x = w.minX - r;
    else if (m === toRight) pos.x = w.maxX + r;
    else if (m === toTop) pos.z = w.minZ - r;
    else pos.z = w.maxZ + r;
  }
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
