// Level definitions. Difficulty scales grid size, monster count, monster speed and fog.
export const CELL = 4;            // world units per maze cell
export const WALL_H = 3.6;        // wall height
export const WALL_T = 0.4;        // wall thickness

export const LEVELS = [
  {
    name: "EASY",
    grid: 8,
    monsters: 2,
    monsterSpeed: 1.6,
    fog: 0.045,
    color: "#36d17a",
  },
  {
    name: "MEDIUM",
    grid: 12,
    monsters: 2,
    monsterSpeed: 3.2,
    fog: 0.07,
    color: "#ffb13f",
  },
  {
    name: "HARD",
    grid: 16,
    monsters: 3,
    monsterSpeed: 4.0,
    fog: 0.095,
    color: "#ff2a4d",
  },
];
