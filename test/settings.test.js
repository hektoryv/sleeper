import test from 'node:test';
import assert from 'node:assert/strict';

import { CONTROLS, DEFAULTS, clampSettings, formatValue } from '../src/settings.js';

const ALL = CONTROLS.flatMap((section) => section.items);

test('every control has a default inside its own slider range', () => {
  for (const control of ALL) {
    const value = DEFAULTS[control.key];
    assert.equal(typeof value, 'number', `${control.key} has no default`);
    assert.ok(value >= control.min && value <= control.max, `${control.key} default ${value} is out of range`);
  }
  assert.equal(Object.keys(DEFAULTS).length, ALL.length, 'defaults and controls have drifted apart');
});

test('clampSettings falls back to defaults for junk input', () => {
  assert.deepEqual(clampSettings(null), DEFAULTS);
  assert.deepEqual(clampSettings(undefined), DEFAULTS);
  assert.deepEqual(clampSettings('nonsense'), DEFAULTS);
  assert.deepEqual(clampSettings({}), DEFAULTS);
  assert.deepEqual(clampSettings({ digitAlpha: 'bright' }), DEFAULTS);
  assert.deepEqual(clampSettings({ digitAlpha: NaN }), DEFAULTS);
});

test('clampSettings keeps stored values inside range, so the board stays readable', () => {
  // A value of 0 would make the board invisible with no way to see the sliders.
  const floored = clampSettings({ digitAlpha: 0, uiAlpha: -5 });
  assert.equal(floored.digitAlpha, ALL.find((c) => c.key === 'digitAlpha').min);
  assert.equal(floored.uiAlpha, ALL.find((c) => c.key === 'uiAlpha').min);

  const capped = clampSettings({ digitScale: 99 });
  assert.equal(capped.digitScale, ALL.find((c) => c.key === 'digitScale').max);
});

test('clampSettings keeps valid values and ignores unknown keys', () => {
  const result = clampSettings({ digitAlpha: 0.5, somethingRemoved: 3 });
  assert.equal(result.digitAlpha, 0.5);
  assert.equal(result.targetAlpha, DEFAULTS.targetAlpha, 'untouched keys keep their default');
  assert.ok(!('somethingRemoved' in result), 'unknown keys are dropped');
});

test('formatValue renders brightness as a percentage and size as a multiplier', () => {
  const alpha = ALL.find((c) => c.unit === '%');
  const scale = ALL.find((c) => c.unit === 'x');
  assert.equal(formatValue(alpha, 0.62), '62%');
  assert.equal(formatValue(scale, 1.1), '1.10x');
});
