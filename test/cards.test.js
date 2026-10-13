import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CARDS, JOKER, draw, isCard, steps } from '../src/cards.js';

test('札の数', () => {
  assert.equal(steps('A'), 1);
  assert.equal(steps('2'), 2);
  assert.equal(steps('10'), 10);
  assert.equal(steps('J'), 11);
  assert.equal(steps('Q'), 12);
  assert.equal(steps('K'), 13);
  assert.equal(steps(JOKER), null);
  assert.throws(() => steps('X'));
});

test('54枚から引く：13種＋JOKER、JOKER は 2/54', () => {
  assert.equal(CARDS.length, 14);
  const seen = {};
  for (let i = 0; i < 54; i++) {
    const c = draw(() => i / 54);
    assert.ok(isCard(c));
    seen[c] = (seen[c] || 0) + 1;
  }
  assert.equal(seen[JOKER], 2);
  assert.equal(seen['A'], 4);
  assert.equal(seen['K'], 4);
});
