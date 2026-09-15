import test from 'node:test';
import assert from 'node:assert/strict';

import {
  UNKNOWN,
  KEPT,
  REMOVED,
  countSolutions,
  deduce,
  generate,
  makeRng,
  subsetsWithSum,
  targetsFor,
} from '../src/engine.js';

import {
  MAX_HEARTS,
  MODE_KEEP,
  MODE_REMOVE,
  LOST,
  PLAYING,
  WON,
  colClue,
  createGame,
  mark,
  restart,
  rowClue,
} from '../src/game.js';

test('subsetsWithSum finds exactly the subsets that hit the target', () => {
  const masks = subsetsWithSum([1, 2, 3], 3);
  const asSets = masks.map((m) => [0, 1, 2].filter((k) => (m >> k) & 1)).sort();
  assert.deepEqual(asSets.sort(), [[0, 1], [2]].sort());
  assert.deepEqual(subsetsWithSum([5, 5], 0), [0]);
  assert.deepEqual(subsetsWithSum([5, 5], 3), []);
});

test('makeRng is deterministic per seed and differs across seeds', () => {
  const a = makeRng(42);
  const b = makeRng(42);
  const c = makeRng(43);
  const first = Array.from({ length: 5 }, () => a());
  assert.deepEqual(first, Array.from({ length: 5 }, () => b()));
  assert.notDeepEqual(first, Array.from({ length: 5 }, () => c()));
  for (const v of first) assert.ok(v >= 0 && v < 1);
});

test('countSolutions rejects the ambiguous 2x2 block of equal values', () => {
  // All four values equal, so keeping either diagonal gives the same sums.
  const values = [
    [4, 4],
    [4, 4],
  ];
  assert.equal(countSolutions(values, [4, 4], [4, 4], 5), 2);
});

test('countSolutions finds a unique answer and reports impossible boards', () => {
  const values = [
    [1, 2],
    [3, 4],
  ];
  // Keep 2 and 3 only: rows 2 and 3, columns 3 and 2.
  assert.equal(countSolutions(values, [2, 3], [3, 2], 5), 1);
  assert.equal(countSolutions(values, [99, 3], [3, 2], 5), 0);
});

test('deduce reports a contradiction on an unsatisfiable board', () => {
  const result = deduce([[1, 2], [3, 4]], [99, 3], [3, 2]);
  assert.equal(result.contradiction, true);
  assert.equal(result.solved, false);
});

test('deduce stops short rather than guessing on an ambiguous board', () => {
  const result = deduce([[4, 4], [4, 4]], [4, 4], [4, 4]);
  assert.equal(result.solved, false);
  assert.equal(result.contradiction, false);
  assert.equal(result.unknown, 4);
});

test('generated boards are unique, fair, and internally consistent', () => {
  for (let seed = 0; seed < 200; seed++) {
    const p = generate({ seed });
    const where = `seed ${seed}`;

    // Values are digits and the stored solution reproduces the stored targets.
    for (let i = 0; i < p.size; i++) {
      for (let j = 0; j < p.size; j++) {
        assert.ok(p.values[i][j] >= 1 && p.values[i][j] <= 9, where);
      }
    }
    const recomputed = targetsFor(p.values, p.solution);
    assert.deepEqual(recomputed.rowTargets, p.rowTargets, where);
    assert.deepEqual(recomputed.colTargets, p.colTargets, where);
    assert.ok(p.rowTargets.every((t) => t > 0), where);
    assert.ok(p.colTargets.every((t) => t > 0), where);

    // Exactly one answer...
    assert.equal(countSolutions(p.values, p.rowTargets, p.colTargets, 3), 1, where);

    // ...and reasoning alone reaches it, with no guessing.
    const solved = deduce(p.values, p.rowTargets, p.colTargets);
    assert.equal(solved.solved, true, where);
    for (let i = 0; i < p.size; i++) {
      for (let j = 0; j < p.size; j++) {
        const expected = p.solution[i][j] ? KEPT : REMOVED;
        assert.equal(solved.state[i][j], expected, `${where} at ${i},${j}`);
      }
    }
  }
});

test('the same seed rebuilds the same board', () => {
  const a = generate({ seed: 12345 });
  const b = generate({ seed: 12345 });
  assert.deepEqual(a.values, b.values);
  assert.deepEqual(a.solution, b.solution);
  assert.equal(a.seed, 12345);
});

test('generate honours size and difficulty floor', () => {
  const small = generate({ seed: 4, size: 5 });
  assert.equal(small.size, 5);
  assert.equal(small.values.length, 5);
  assert.equal(small.values[0].length, 5);
  assert.ok(generate({ seed: 9, minRounds: 6 }).rounds >= 6);
});

test('playing every correct mark wins the game with hearts intact', () => {
  const game = createGame({ seed: 77 });
  const { size, solution } = game.puzzle;
  assert.equal(game.status, PLAYING);

  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      const mode = solution[i][j] ? MODE_KEEP : MODE_REMOVE;
      assert.equal(mark(game, i, j, mode).outcome, 'applied');
    }
  }

  assert.equal(game.status, WON);
  assert.equal(game.hearts, MAX_HEARTS);
  assert.equal(game.decided, size * size);
});

test('a wrong mark costs a heart, is not applied, and three of them lose', () => {
  const game = createGame({ seed: 78 });
  const { solution } = game.puzzle;

  let wrong = null;
  outer: for (let i = 0; i < game.puzzle.size; i++) {
    for (let j = 0; j < game.puzzle.size; j++) {
      if (solution[i][j]) {
        wrong = [i, j];
        break outer;
      }
    }
  }
  const [wi, wj] = wrong;

  // Removing a cell the solution keeps is a mistake.
  assert.equal(mark(game, wi, wj, MODE_REMOVE).outcome, 'mistake');
  assert.equal(game.hearts, MAX_HEARTS - 1);
  assert.equal(game.marks[wi][wj], UNKNOWN, 'a mistake must leave the board untouched');
  assert.equal(game.status, PLAYING);

  mark(game, wi, wj, MODE_REMOVE);
  assert.equal(game.hearts, 1);
  mark(game, wi, wj, MODE_REMOVE);
  assert.equal(game.hearts, 0);
  assert.equal(game.status, LOST);

  // A lost game accepts no further marks.
  assert.equal(mark(game, wi, wj, MODE_KEEP).outcome, 'ignored');
  assert.equal(game.marks[wi][wj], UNKNOWN);
});

test('marking an already decided cell is a no-op, not a penalty', () => {
  const game = createGame({ seed: 79 });
  const { solution } = game.puzzle;
  const mode = solution[0][0] ? MODE_KEEP : MODE_REMOVE;
  mark(game, 0, 0, mode);
  const before = game.marks[0][0];

  const result = mark(game, 0, 0, mode === MODE_KEEP ? MODE_REMOVE : MODE_KEEP);
  assert.equal(result.outcome, 'ignored');
  assert.equal(game.hearts, MAX_HEARTS);
  assert.equal(game.marks[0][0], before);
});

test('clues count down as cells are confirmed and go done when the line is settled', () => {
  const game = createGame({ seed: 80 });
  const { size, values, solution, rowTargets } = game.puzzle;

  const fresh = rowClue(game, 0);
  assert.equal(fresh.target, rowTargets[0]);
  assert.equal(fresh.remaining, rowTargets[0], 'nothing confirmed yet, so the full target is owed');
  assert.equal(fresh.done, false);

  let owed = rowTargets[0];
  for (let j = 0; j < size; j++) {
    if (solution[0][j]) {
      mark(game, 0, j, MODE_KEEP);
      owed -= values[0][j];
      assert.equal(rowClue(game, 0).remaining, owed);
    } else {
      mark(game, 0, j, MODE_REMOVE);
    }
  }

  const settled = rowClue(game, 0);
  assert.equal(settled.done, true);
  assert.equal(settled.remaining, 0, 'a finished line owes nothing');

  // Columns work the same way, and are only done once every row is filled in.
  assert.equal(colClue(game, 0).done, false);
  assert.equal(colClue(game, 0).target, game.puzzle.colTargets[0]);
});

test('restart clears the board and hearts but keeps the same puzzle', () => {
  const game = createGame({ seed: 81 });
  mark(game, 0, 0, game.puzzle.solution[0][0] ? MODE_KEEP : MODE_REMOVE);
  const fresh = restart(game);

  assert.equal(fresh.puzzle, game.puzzle);
  assert.equal(fresh.hearts, MAX_HEARTS);
  assert.equal(fresh.decided, 0);
  assert.equal(fresh.marks[0][0], UNKNOWN);
  assert.equal(fresh.status, PLAYING);
});
