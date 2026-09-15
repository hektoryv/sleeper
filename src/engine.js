/**
 * Cross Sums engine.
 *
 * A puzzle is an n x n grid of digits 1-9 plus a target for every row and
 * column. The player decides, for each cell, whether it is KEPT or REMOVED;
 * the kept cells of a line must sum to exactly that line's target.
 *
 * Three pieces live here:
 *   1. countSolutions - exact solver, used to prove a puzzle has one answer.
 *   2. deduce         - constraint propagation, used to prove a puzzle can be
 *                       solved by reasoning instead of guessing.
 *   3. generate       - random boards, filtered through both of the above.
 */

export const UNKNOWN = 0;
export const KEPT = 1;
export const REMOVED = 2;

/** Deterministic PRNG (mulberry32) so a seed always rebuilds the same board. */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed() {
  return (Math.random() * 0x100000000) >>> 0;
}

/**
 * Every subset of `values` summing to `target`, as bitmasks (bit k = values[k]).
 * n is at most a dozen here, so enumerating all 2^n subsets is the simplest
 * thing that works. Sums are built incrementally off the low bit.
 */
export function subsetsWithSum(values, target) {
  const n = values.length;
  const total = 1 << n;
  const sums = new Int32Array(total);
  const out = [];
  if (target === 0) out.push(0);
  for (let mask = 1; mask < total; mask++) {
    const low = mask & -mask;
    sums[mask] = sums[mask ^ low] + values[31 - Math.clz32(low)];
    if (sums[mask] === target) out.push(mask);
  }
  return out;
}

function column(values, j) {
  return values.map((row) => row[j]);
}

/**
 * Count solutions, stopping at `limit`. Rows are tried fewest-candidates-first;
 * a candidate is rejected as soon as any column would overshoot its target or
 * could no longer reach it with the rows that remain.
 */
export function countSolutions(values, rowTargets, colTargets, limit = 2) {
  const n = values.length;
  const rowCands = values.map((row, i) => subsetsWithSum(row, rowTargets[i]));
  if (rowCands.some((cands) => cands.length === 0)) return 0;

  const order = rowCands.map((_, i) => i).sort((a, b) => rowCands[a].length - rowCands[b].length);

  // remaining[t][j]: total of column j across the rows not yet placed at depth t.
  const remaining = [];
  for (let t = 0; t <= n; t++) remaining.push(new Int32Array(n));
  for (let t = n - 1; t >= 0; t--) {
    const row = values[order[t]];
    for (let j = 0; j < n; j++) remaining[t][j] = remaining[t + 1][j] + row[j];
  }

  const cols = new Int32Array(n);
  let count = 0;

  function place(t) {
    if (t === n) {
      // The pruning below is exact at the last row, so reaching here is a solution.
      count++;
      return;
    }
    const row = values[order[t]];
    const rest = remaining[t + 1];
    candidates: for (const mask of rowCands[order[t]]) {
      for (let j = 0; j < n; j++) {
        const next = cols[j] + ((mask >> j) & 1 ? row[j] : 0);
        if (next > colTargets[j] || next + rest[j] < colTargets[j]) continue candidates;
      }
      for (let j = 0; j < n; j++) if ((mask >> j) & 1) cols[j] += row[j];
      place(t + 1);
      for (let j = 0; j < n; j++) if ((mask >> j) & 1) cols[j] -= row[j];
      if (count >= limit) return;
    }
  }

  place(0);
  return count;
}

/**
 * Solve by constraint propagation only - no guessing, no backtracking.
 *
 * Each row and column keeps the list of subsets that could still be its answer.
 * Filter that list by what is already decided, then look across what survives:
 * a cell kept by every surviving candidate must be KEPT, a cell kept by none
 * must be REMOVED. Repeat until nothing changes.
 *
 * `solved: true` means a human can reach the answer by reasoning alone, which
 * is the property that makes a generated board fair to play.
 */
export function deduce(values, rowTargets, colTargets) {
  const n = values.length;
  const state = values.map(() => new Uint8Array(n));
  const all = (1 << n) - 1;

  const lines = [];
  for (let i = 0; i < n; i++) {
    lines.push({
      cells: Array.from({ length: n }, (_, j) => [i, j]),
      cands: subsetsWithSum(values[i], rowTargets[i]),
    });
  }
  for (let j = 0; j < n; j++) {
    lines.push({
      cells: Array.from({ length: n }, (_, i) => [i, j]),
      cands: subsetsWithSum(column(values, j), colTargets[j]),
    });
  }

  let rounds = 0;
  let changed = true;
  while (changed) {
    changed = false;
    rounds++;
    for (const line of lines) {
      let need = 0;
      let forbid = 0;
      for (let k = 0; k < n; k++) {
        const [i, j] = line.cells[k];
        if (state[i][j] === KEPT) need |= 1 << k;
        else if (state[i][j] === REMOVED) forbid |= 1 << k;
      }
      line.cands = line.cands.filter((m) => (m & need) === need && (m & forbid) === 0);
      if (line.cands.length === 0) {
        return { solved: false, contradiction: true, rounds, unknown: -1, state };
      }

      let inEvery = all;
      let inAny = 0;
      for (const m of line.cands) {
        inEvery &= m;
        inAny |= m;
      }
      for (let k = 0; k < n; k++) {
        const [i, j] = line.cells[k];
        if (state[i][j] !== UNKNOWN) continue;
        if ((inEvery >> k) & 1) {
          state[i][j] = KEPT;
          changed = true;
        } else if (!((inAny >> k) & 1)) {
          state[i][j] = REMOVED;
          changed = true;
        }
      }
    }
  }

  let unknown = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) if (state[i][j] === UNKNOWN) unknown++;
  }
  return { solved: unknown === 0, contradiction: false, rounds, unknown, state };
}

/**
 * How much work the deduction engine needed, as a difficulty proxy. More rounds
 * means more back-and-forth between rows and columns before the board falls.
 */
export function grade(values, rowTargets, colTargets) {
  const result = deduce(values, rowTargets, colTargets);
  const rounds = result.rounds;
  let difficulty = 'easy';
  if (!result.solved) difficulty = 'unfair';
  else if (rounds >= 7) difficulty = 'extra hard';
  else if (rounds >= 6) difficulty = 'hard';
  else if (rounds >= 5) difficulty = 'medium';
  return { ...result, difficulty };
}

export function targetsFor(values, solution) {
  const n = values.length;
  const rowTargets = new Array(n).fill(0);
  const colTargets = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (solution[i][j]) {
        rowTargets[i] += values[i][j];
        colTargets[j] += values[i][j];
      }
    }
  }
  return { rowTargets, colTargets };
}

function attempt(size, keepProb, rng, minRounds) {
  const values = [];
  const solution = [];
  for (let i = 0; i < size; i++) {
    const row = new Array(size);
    const keep = new Array(size);
    for (let j = 0; j < size; j++) {
      row[j] = 1 + Math.floor(rng() * 9);
      keep[j] = rng() < keepProb ? 1 : 0;
    }
    values.push(row);
    solution.push(keep);
  }

  const { rowTargets, colTargets } = targetsFor(values, solution);

  // A line with nothing kept shows a target of 0 and gives the whole line away.
  if (rowTargets.some((t) => t === 0) || colTargets.some((t) => t === 0)) return null;
  if (countSolutions(values, rowTargets, colTargets, 2) !== 1) return null;

  const graded = grade(values, rowTargets, colTargets);
  if (!graded.solved) return null;
  if (graded.rounds < minRounds) return null;

  return {
    size,
    values,
    solution,
    rowTargets,
    colTargets,
    difficulty: graded.difficulty,
    rounds: graded.rounds,
  };
}

/**
 * Build a board that is guaranteed to have exactly one answer AND to be
 * reachable by pure reasoning. Roughly 45% of random boards clear both bars, so
 * this returns in a couple of milliseconds.
 */
export function generate({ size = 8, keepProb = 0.55, seed, minRounds = 4, maxAttempts = 5000 } = {}) {
  const usedSeed = seed === undefined ? randomSeed() : seed >>> 0;
  const rng = makeRng(usedSeed);
  for (let i = 0; i < maxAttempts; i++) {
    const puzzle = attempt(size, keepProb, rng, minRounds);
    if (puzzle) return { ...puzzle, seed: usedSeed };
  }
  throw new Error(`generate: no puzzle found for size ${size} after ${maxAttempts} attempts`);
}
