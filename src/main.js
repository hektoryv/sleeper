/** Wiring: one game, one UI, and the handlers between them. */

import { createGame, mark, restart, toggleMode } from './game.js';
import { createUi } from './ui.js';

const SIZE = 8;
const BOARD_KEY = 'cross-sums-board-number';

/** The board counter carries across launches, so the count means something. */
function loadBoardNumber() {
  try {
    const stored = Number(localStorage.getItem(BOARD_KEY));
    return Number.isFinite(stored) && stored >= 1 ? Math.floor(stored) : 1;
  } catch {
    return 1;
  }
}

function saveBoardNumber(number) {
  try {
    localStorage.setItem(BOARD_KEY, String(number));
  } catch {
    /* private mode - the counter just restarts next launch */
  }
}

let boardNumber = loadBoardNumber();
let game = createGame({ size: SIZE });

const ui = createUi(document, {
  onCell(i, j) {
    const { outcome } = mark(game, i, j);
    if (outcome === 'mistake') ui.flashMistake(i, j);
    if (outcome !== 'ignored') ui.render(game);
  },
  onToggleMode() {
    toggleMode(game);
    ui.render(game);
  },
  onRestart() {
    game = restart(game);
    ui.render(game);
  },
  onNewGame() {
    boardNumber += 1;
    saveBoardNumber(boardNumber);
    game = createGame({ size: SIZE });
    ui.build(game, boardNumber);
  },
});

ui.build(game, boardNumber);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      /* offline support is a bonus; the game works without it */
    });
  });
}
