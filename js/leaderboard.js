// Local top-10 leaderboard stored in the browser via localStorage.
const KEY = "dmr_leaderboard_v1";

export function loadBoard() {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveScore(entry) {
  const board = loadBoard();
  board.push(entry);
  board.sort((a, b) => b.score - a.score);
  const top = board.slice(0, 10);
  try {
    localStorage.setItem(KEY, JSON.stringify(top));
  } catch {
    /* storage may be unavailable (private mode) — fail quietly */
  }
  // Return the rank (1-based) of the saved entry, or -1 if it missed the top 10.
  return top.indexOf(entry) + 1 || -1;
}
