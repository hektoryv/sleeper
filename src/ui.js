/**
 * Rendering and input. Builds the board once per puzzle, then only touches the
 * parts that change, so a tap never rebuilds the grid under the player's thumb.
 */

import { KEPT, REMOVED, UNKNOWN, MODE_KEEP, MODE_REMOVE, MAX_HEARTS, LOST, PLAYING, WON, colClue, mark, rowClue } from './game.js';
import { CONTROLS, DEFAULTS, applySettings, formatValue, loadSettings, saveSettings } from './settings.js';

const HEART_SVG = '<svg class="heart" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.7-9.6-9A5.4 5.4 0 0 1 12 6.2 5.4 5.4 0 0 1 21.6 12c-2.1 4.3-9.6 9-9.6 9z"/></svg>';

export function createUi(root, handlers) {
  const board = root.querySelector('#board');
  const heartsEl = root.querySelector('#hearts');
  const difficultyEl = root.querySelector('#difficulty');
  const nameEl = root.querySelector('#board-name');
  const modeRemove = root.querySelector('#mode-remove');
  const modeKeep = root.querySelector('#mode-keep');
  const overlay = root.querySelector('#overlay');

  let cells = [];
  let rowClues = [];
  let colClues = [];
  let current = null;

  board.addEventListener('click', (event) => {
    const target = event.target.closest('.cell');
    if (!target || !board.contains(target)) return;
    handlers.onCell(Number(target.dataset.row), Number(target.dataset.col));
  });

  modeRemove.addEventListener('click', () => handlers.onMode(MODE_REMOVE));
  modeKeep.addEventListener('click', () => handlers.onMode(MODE_KEEP));
  root.querySelector('#restart').addEventListener('click', handlers.onRestart);
  root.querySelector('#new-game').addEventListener('click', handlers.onNewGame);
  root.querySelector('#overlay-again').addEventListener('click', handlers.onRestart);
  root.querySelector('#overlay-next').addEventListener('click', handlers.onNewGame);

  /** Rebuild the grid for a new puzzle. */
  function build(game) {
    current = game;
    const { size, values } = game.puzzle;
    board.replaceChildren();
    board.style.gridTemplateColumns = `minmax(34px, 0.82fr) repeat(${size}, 1fr)`;
    cells = [];
    rowClues = [];
    colClues = [];

    const corner = document.createElement('div');
    corner.className = 'corner';
    board.append(corner);

    for (let j = 0; j < size; j++) {
      const clue = clueElement('col');
      colClues.push(clue);
      board.append(clue);
    }

    for (let i = 0; i < size; i++) {
      const clue = clueElement('row');
      rowClues.push(clue);
      board.append(clue);

      const row = [];
      for (let j = 0; j < size; j++) {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'cell';
        cell.dataset.row = String(i);
        cell.dataset.col = String(j);
        cell.setAttribute('role', 'gridcell');
        cell.innerHTML = `<span class="ring"></span><span class="digit">${values[i][j]}</span>`;
        row.push(cell);
        board.append(cell);
      }
      cells.push(row);
    }

    nameEl.textContent = 'Cross Sums';
    difficultyEl.textContent = game.puzzle.difficulty;
    render(game);
  }

  function clueElement(axis) {
    const el = document.createElement('div');
    el.className = `clue ${axis}`;
    el.innerHTML = '<span class="remaining"></span><span class="target"></span>';
    return el;
  }

  function paintClue(el, clue) {
    el.querySelector('.target').textContent = String(clue.target);
    el.querySelector('.remaining').textContent = String(clue.remaining);
    el.classList.toggle('done', clue.done);
  }

  /** Repaint everything that can change without the puzzle changing. */
  function render(game) {
    current = game;
    const { size } = game.puzzle;

    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        const state = game.marks[i][j];
        const cell = cells[i][j];
        cell.classList.toggle('kept', state === KEPT);
        cell.classList.toggle('removed', state === REMOVED);
        cell.classList.toggle('decided', state !== UNKNOWN);
        cell.setAttribute(
          'aria-label',
          `${game.puzzle.values[i][j]} at row ${i + 1} column ${j + 1}, ` +
            (state === KEPT ? 'kept' : state === REMOVED ? 'crossed out' : 'undecided'),
        );
      }
      paintClue(rowClues[i], rowClue(game, i));
    }
    for (let j = 0; j < size; j++) paintClue(colClues[j], colClue(game, j));

    heartsEl.innerHTML = Array.from({ length: MAX_HEARTS }, (_, k) =>
      HEART_SVG.replace('class="heart"', `class="heart${k < game.hearts ? '' : ' spent'}"`),
    ).join('');

    const removing = game.mode === MODE_REMOVE;
    modeRemove.setAttribute('aria-checked', String(removing));
    modeKeep.setAttribute('aria-checked', String(!removing));

    renderOverlay(game);
  }

  function renderOverlay(game) {
    if (game.status === PLAYING) {
      overlay.hidden = true;
      return;
    }
    const won = game.status === WON;
    root.querySelector('#overlay-title').textContent = won ? 'Solved' : 'Out of hearts';
    root.querySelector('#overlay-body').textContent = won
      ? 'Every row and column adds up. Sleep well.'
      : 'The board is still here if you want another go at it.';
    root.querySelector('#overlay-again').textContent = won ? 'Same board' : 'Retry this board';
    root.querySelector('#overlay-next').textContent = won ? 'New board' : 'New board';
    overlay.hidden = false;
  }

  const settingsPanel = root.querySelector('#settings');
  const settingsButton = root.querySelector('#settings-open');
  let settings = loadSettings();
  const sliders = new Map();

  function buildSettings() {
    const host = root.querySelector('#settings-controls');
    host.replaceChildren();
    for (const section of CONTROLS) {
      const group = document.createElement('div');
      group.className = 'settings-group';
      const heading = document.createElement('h3');
      heading.textContent = section.group;
      group.append(heading);

      for (const control of section.items) {
        const row = document.createElement('div');
        row.className = 'slider-row';

        const id = `set-${control.key}`;
        const label = document.createElement('label');
        label.htmlFor = id;
        label.textContent = control.label;

        const input = document.createElement('input');
        input.type = 'range';
        input.id = id;
        input.min = String(control.min);
        input.max = String(control.max);
        input.step = String(control.step);
        input.value = String(settings[control.key]);

        const readout = document.createElement('output');
        readout.htmlFor = id;
        readout.textContent = formatValue(control, settings[control.key]);

        input.addEventListener('input', () => {
          settings = { ...settings, [control.key]: Number(input.value) };
          readout.textContent = formatValue(control, Number(input.value));
          applySettings(settings);
        });
        // Only persist once the thumb is released, not on every pixel of drag.
        input.addEventListener('change', () => saveSettings(settings));

        sliders.set(control.key, { input, readout, control });
        row.append(label, input, readout);
        group.append(row);
      }
      host.append(group);
    }
  }

  function syncSliders() {
    for (const [key, { input, readout, control }] of sliders) {
      input.value = String(settings[key]);
      readout.textContent = formatValue(control, settings[key]);
    }
  }

  function openSettings(open) {
    settingsPanel.hidden = !open;
    settingsButton.setAttribute('aria-expanded', String(open));
  }

  settingsButton.addEventListener('click', () => openSettings(settingsPanel.hidden));
  root.querySelector('#settings-close').addEventListener('click', () => openSettings(false));
  root.querySelector('#settings-reset').addEventListener('click', () => {
    settings = { ...DEFAULTS };
    applySettings(settings);
    saveSettings(settings);
    syncSliders();
  });

  /**
   * Eat the click that follows a dismissing tap, so closing the sheet by
   * tapping the board does not also mark the cell underneath - which could
   * otherwise cost a heart.
   */
  function swallowNextClick() {
    const eat = (event) => {
      event.stopPropagation();
      event.preventDefault();
    };
    document.addEventListener('click', eat, { capture: true, once: true });
    // If the gesture turned out to be a scroll, no click ever arrives - drop
    // the listener rather than leave it to eat an unrelated tap later.
    setTimeout(() => document.removeEventListener('click', eat, { capture: true }), 500);
  }

  // Tapping the board while the sheet is open just closes it.
  document.addEventListener('pointerdown', (event) => {
    if (settingsPanel.hidden) return;
    if (settingsPanel.contains(event.target) || settingsButton.contains(event.target)) return;
    openSettings(false);
    swallowNextClick();
  });

  applySettings(settings);
  buildSettings();

  /** Flash a cell red without changing the board - used for a wrong tap. */
  function flashMistake(i, j) {
    const cell = cells[i][j];
    cell.classList.remove('wrong');
    void cell.offsetWidth; // restart the animation
    cell.classList.add('wrong');
    setTimeout(() => cell.classList.remove('wrong'), 400);
  }

  return { build, render, flashMistake };
}
