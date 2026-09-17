/**
 * Appearance settings.
 *
 * Everything adjustable is a CSS custom property, so a slider is just a number
 * written onto :root - no re-render, no repaint logic, and the board updates
 * live underneath the settings sheet while you drag.
 *
 * Brightness values are alphas over a black background, which is why "as dark
 * as possible" works: 0 is invisible, 1 is full white.
 */

const STORAGE_KEY = 'cross-sums-appearance';

/**
 * Each control is a slider. `prop` is the CSS variable it writes to.
 * Sizes are multipliers against the font sizes in the stylesheet.
 */
export const CONTROLS = [
  {
    group: 'Board numbers',
    items: [
      { key: 'digitScale', label: 'Size', prop: '--digit-scale', min: 0.6, max: 1.5, step: 0.05, unit: 'x' },
      { key: 'digitAlpha', label: 'Brightness', prop: '--digit-alpha', min: 0.08, max: 1, step: 0.02, unit: '%' },
    ],
  },
  {
    group: 'Targets',
    items: [
      { key: 'targetScale', label: 'Size', prop: '--target-scale', min: 0.6, max: 1.5, step: 0.05, unit: 'x' },
      { key: 'targetAlpha', label: 'Brightness', prop: '--target-alpha', min: 0.08, max: 1, step: 0.02, unit: '%' },
    ],
  },
  {
    group: 'Small "still needed" number',
    items: [
      { key: 'remainingScale', label: 'Size', prop: '--remaining-scale', min: 0.6, max: 2.2, step: 0.05, unit: 'x' },
      { key: 'remainingAlpha', label: 'Brightness', prop: '--remaining-alpha', min: 0.08, max: 1, step: 0.02, unit: '%' },
    ],
  },
  {
    group: 'Everything else',
    items: [
      { key: 'uiAlpha', label: 'Brightness', prop: '--ui-alpha', min: 0.04, max: 1, step: 0.02, unit: '%' },
    ],
  },
];

const ALL = CONTROLS.flatMap((section) => section.items);

/** Deliberately dim - the starting point for tuning, not a neutral default. */
export const DEFAULTS = {
  digitScale: 1,
  digitAlpha: 0.62,
  targetScale: 1,
  targetAlpha: 0.54,
  remainingScale: 1.1,
  remainingAlpha: 0.4,
  uiAlpha: 0.42,
};

/**
 * Merge a partial (or junk) settings object onto the defaults, clamping every
 * value into its slider's range. Pure, so stored settings from an older version
 * - or a hand-edited localStorage entry - can never produce an unreadable board.
 */
export function clampSettings(partial) {
  const out = { ...DEFAULTS };
  if (!partial || typeof partial !== 'object') return out;
  for (const control of ALL) {
    const value = Number(partial[control.key]);
    if (!Number.isFinite(value)) continue;
    out[control.key] = Math.min(control.max, Math.max(control.min, value));
  }
  return out;
}

export function loadSettings() {
  try {
    return clampSettings(JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* private mode or a full quota - the settings just will not persist */
  }
}

export function applySettings(settings, root = document.documentElement) {
  for (const control of ALL) root.style.setProperty(control.prop, String(settings[control.key]));
}

/** Slider position rendered for the label next to it. */
export function formatValue(control, value) {
  return control.unit === '%' ? `${Math.round(value * 100)}%` : `${value.toFixed(2)}x`;
}
