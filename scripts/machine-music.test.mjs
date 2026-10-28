import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crossedChime, normalizeScore, nextPitch, DEFAULT_SCORE, PITCHES, hammerMotion } from '../public/machine-music.js';

test('a chime fires once when a ball crosses its point, including entry onto a new track', () => {
  const point = { track: 2, s: 5 };
  assert.equal(crossedChime({mode:'track',track:2,s:4}, {mode:'track',track:2,s:5.1}, point), true);
  assert.equal(crossedChime({mode:'track',track:2,s:5.1}, {mode:'track',track:2,s:6}, point), false);
  assert.equal(crossedChime({mode:'pipe'}, {mode:'track',track:2,s:5.1}, point), true);
  assert.equal(crossedChime(undefined, {mode:'track',track:2,s:6}, point), false);
  assert.equal(crossedChime({mode:'track',track:2,s:6}, {mode:'track',track:2,s:2}, point), false);
});

test('six-note compositions recover safely from corrupt or outdated saved data', () => {
  assert.deepEqual(normalizeScore({version:1, notes:[0,null,7,2,4,1]}), [0,null,7,2,4,1]);
  for (const bad of [null, {version:2,notes:DEFAULT_SCORE}, {version:1,notes:[0]}, {version:1,notes:[0,1,2,3,4,99]}]) {
    assert.deepEqual(normalizeScore(bad), DEFAULT_SCORE);
  }
  const notes = normalizeScore(null); notes[0] = null;
  assert.equal(DEFAULT_SCORE[0], 0, 'defaults must not mutate when editing');
});

test('each plate cycles through eight pitches and a rest, then returns to Do', () => {
  let pitch = 0;
  const sequence = [];
  for (let i=0; i<9; i++) { sequence.push(pitch); pitch = nextPitch(pitch); }
  assert.deepEqual(sequence, [0,1,2,3,4,5,6,7,null]);
  assert.equal(pitch, 0);
  assert.equal(PITCHES[7].frequency, PITCHES[0].frequency * 2);
});

test('hammer meets the plate at the strike, rebounds and settles without residual vibration', () => {
  assert.equal(hammerMotion(0).angle, 0.45);
  assert.ok(hammerMotion(0.08).angle < 0.45);
  assert.ok(Math.abs(hammerMotion(0.12).vibration) > 0);
  assert.deepEqual(hammerMotion(2), {angle:-0.18, vibration:0});
});
