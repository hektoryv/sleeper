/** Wiring: one game, one UI, and the handlers between them. */

import { createGame, mark, restart, setMode } from './game.js';
import { createUi } from './ui.js';

const SIZE = 8;

let game = createGame({ size: SIZE });

const ui = createUi(document, {
  onCell(i, j) {
    const { outcome } = mark(game, i, j);
    if (outcome === 'mistake') ui.flashMistake(i, j);
    if (outcome !== 'ignored') ui.render(game);
  },
  onMode(mode) {
    setMode(game, mode);
    ui.render(game);
  },
  onRestart() {
    game = restart(game);
    ui.render(game);
  },
  onNewGame() {
    game = createGame({ size: SIZE });
    ui.build(game);
  },
});

ui.build(game);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      /* offline support is a bonus; the game works without it */
    });
  });
}
