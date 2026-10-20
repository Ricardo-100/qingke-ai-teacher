import test from 'node:test';
import assert from 'node:assert/strict';
import { textBounds } from '../shared/pdf-bounds.mjs';
test('PDF text bounds use font ascent and stay aligned under rotated transforms', () => {
  assert.deepEqual(textBounds([20,0,0,-20,100,200], 60, { ascent: .75 }, 1000, 1000), { x: .1, y: .185, w: .06, h: .02 });
  assert.deepEqual(textBounds([0,20,20,0,100,200], 60, { ascent: .75 }, 1000, 1000), { x: .095, y: .2, w: .02, h: .06 });
});
