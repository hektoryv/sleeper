/**
 * Game state: what the player has marked, how many hearts are left, and the
 * per-line arithmetic the clue tiles display.
 *
 * Every mark is checked against the puzzle's one true solution. A mark that
 * contradicts it costs a heart and is not applied, so the board on screen is
 * always a correct partial solution.
 */

import { UNKNOWN, KEPT, REMOVED, generate } from './engine.js';

export { UNKNOWN, KEPT, REMOVED };

export const MAX_HEARTS = 3;

export const MODE_REMOVE = 'remove';
export const MODE_KEEP = 'keep';

export const PLAYING = 'playing';
export const WON = 'won';
export const LOST = 'lost';

export function createGame(options = {}) {
  return startPuzzle(generate(options));
}

/** Fresh state over the same board - what the restart button does. */
export function restart(game) {
  return startPuzzle(game.puzzle);
}

function startPuzzle(puzzle) {
  return {
    puzzle,
    marks: puzzle.values.map(() => new Uint8Array(puzzle.size)),
    hearts: MAX_HEARTS,
    mode: MODE_REMOVE,
    status: PLAYING,
    decided: 0,
  };
}

export function setMode(game, mode) {
  game.mode = mode;
  return game;
}

export function toggleMode(game) {
  game.mode = game.mode === MODE_REMOVE ? MODE_KEEP : MODE_REMOVE;
  return game;
}

/**
 * Apply the current mode to a cell.
 *
 * Returns what happened so the UI can react: `applied` for a correct mark,
 * `mistake` for one that cost a heart, `ignored` for a tap on a cell that was
 * already decided (a no-op, never a penalty).
 */
export function mark(game, i, j, mode = game.mode) {
  if (game.status !== PLAYING) return { outcome: 'ignored', game };
  if (game.marks[i][j] !== UNKNOWN) return { outcome: 'ignored', game };

  const wanted = mode === MODE_KEEP ? KEPT : REMOVED;
  const truth = game.puzzle.solution[i][j] ? KEPT : REMOVED;

  if (wanted !== truth) {
    game.hearts -= 1;
    if (game.hearts <= 0) {
      game.hearts = 0;
      game.status = LOST;
    }
    return { outcome: 'mistake', game };
  }

  game.marks[i][j] = wanted;
  game.decided += 1;
  if (game.decided === game.puzzle.size * game.puzzle.size) game.status = WON;
  return { outcome: 'applied', game };
}

/**
 * The two numbers on a row's clue tile: its target, and how much of that target
 * the undecided cells still owe once the confirmed cells are subtracted.
 * `done` is true when every cell in the line is decided, which is when the real
 * game hides the tile.
 */
export function rowClue(game, i) {
  const { size, values, rowTargets } = game.puzzle;
  let kept = 0;
  let undecided = 0;
  for (let j = 0; j < size; j++) {
    if (game.marks[i][j] === KEPT) kept += values[i][j];
    else if (game.marks[i][j] === UNKNOWN) undecided += 1;
  }
  return { target: rowTargets[i], remaining: rowTargets[i] - kept, done: undecided === 0 };
}

export function colClue(game, j) {
  const { size, values, colTargets } = game.puzzle;
  let kept = 0;
  let undecided = 0;
  for (let i = 0; i < size; i++) {
    if (game.marks[i][j] === KEPT) kept += values[i][j];
    else if (game.marks[i][j] === UNKNOWN) undecided += 1;
  }
  return { target: colTargets[j], remaining: colTargets[j] - kept, done: undecided === 0 };
}
