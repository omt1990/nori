import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  autoLines, bingoCount, candidateStations, cellCount, freeIndex, lineNames, makeBoard, metroLines, seeded, settingsFor, toGrid, visibleLines,
} from '../src/board.js';

const data = JSON.parse(readFileSync(new URL('../src/data/stations.json', import.meta.url)));
const line = (op, name) => data.lines.find((l) => l.operator === op && l.name === name).id;

test('時間ごとの盤の大きさ', () => {
  assert.equal(settingsFor(2).size, 3);
  assert.equal(settingsFor(4).size, 4);
  assert.equal(settingsFor(8).size, 5);
  assert.equal(cellCount(3), 8);
  assert.equal(cellCount(4), 16);
  assert.equal(cellCount(5), 24);
  assert.equal(freeIndex(3), 4);
  assert.equal(freeIndex(4), -1);
  assert.equal(freeIndex(5), 12);
});

test('駅データ：都内全駅・隠し路線は選べない', () => {
  assert.ok(data.stations.length > 600);
  const names = data.stations.map((s) => s.name);
  assert.equal(new Set(names).size, names.length, '駅名は重複しない');
  const visible = visibleLines(data);
  assert.ok(visible.every((l) => !l.hidden));
  assert.ok(!visible.some((l) => l.name === '東北線'));
  assert.equal(data.lines.find((l) => l.name === '山手線').stations.length, 30);
  for (const s of data.stations) {
    assert.ok(s.lines.some((id) => visible.some((l) => l.id === id)), `${s.name} はどの路線からも選べない`);
  }
});

test('盤は選んだ路線の駅だけから作る', () => {
  const ids = [line('東京地下鉄', '銀座線')];
  const board = makeBoard(data, ids, 3, seeded(1));
  assert.equal(board.length, 8);
  const ginza = new Set(candidateStations(data, ids).map((s) => s.name));
  for (const name of board) assert.ok(ginza.has(name), `${name} は銀座線にない`);
  assert.equal(new Set(board).size, 8);
});

test('同じ乱数なら同じ盤', () => {
  const ids = [line('東京地下鉄', '銀座線'), line('東京地下鉄', '丸ノ内線')];
  assert.deepEqual(makeBoard(data, ids, 4, seeded(7)), makeBoard(data, ids, 4, seeded(7)));
  assert.notDeepEqual(makeBoard(data, ids, 4, seeded(7)), makeBoard(data, ids, 4, seeded(8)));
});

test('駅が足りなければ作れない', () => {
  const ids = [line('京成電鉄', '金町線')]; // 3駅
  assert.throws(() => makeBoard(data, ids, 3, seeded(1)));
});

test('路線はアプリが東京メトロから自動で決める：2h=2本・4h=4本・8h=全線', () => {
  assert.equal(metroLines(data).length, 9, '東京メトロの本線は9本');
  assert.equal(lineNames(data, autoLines(data, 2, seeded(1))).length, 2);
  assert.equal(lineNames(data, autoLines(data, 4, seeded(1))).length, 4);
  assert.equal(lineNames(data, autoLines(data, 8, seeded(1))).length, 9);
  for (const hours of [2, 4, 8]) {
    const ids = autoLines(data, hours, seeded(3));
    const size = settingsFor(hours).size;
    assert.ok(candidateStations(data, ids).length >= cellCount(size), `${hours}h の盤を埋める駅がある`);
    assert.ok(ids.every((id) => id.startsWith('東京地下鉄|')), '東京メトロだけ');
  }
  assert.notDeepEqual(autoLines(data, 2, seeded(1)), autoLines(data, 2, seeded(2)), '乱数で変わる');
});

test('丸ノ内線を引いたら方南町の分岐線も盤に入る。表示は本線だけ', () => {
  const m = line('東京地下鉄', '丸ノ内線');
  const branch = line('東京地下鉄', '丸ノ内線分岐線');
  let found = null;
  for (let seed = 1; seed < 50 && !found; seed++) {
    const ids = autoLines(data, 2, seeded(seed));
    if (ids.includes(m)) found = ids;
  }
  assert.ok(found, '丸ノ内線が選ばれる種がある');
  assert.ok(found.includes(branch));
  assert.deepEqual(lineNames(data, found).filter((n) => n.includes('分岐')), []);
});

test('FREE を含む盤とビンゴ判定', () => {
  const grid = toGrid(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], 3);
  assert.deepEqual(grid, ['a', 'b', 'c', 'd', null, 'e', 'f', 'g', 'h']);
  const none = grid.map((_, i) => i === 4);
  assert.equal(bingoCount(none, 3), 0);
  const row0 = none.slice(); row0[0] = row0[1] = row0[2] = true;
  assert.equal(bingoCount(row0, 3), 1);
  const diag = none.slice(); diag[0] = diag[8] = true; // 中央 FREE で斜め成立
  assert.equal(bingoCount(diag, 3), 1);
  const col1 = none.slice(); col1[1] = col1[7] = true; // 中央 FREE で縦成立
  assert.equal(bingoCount(col1, 3), 1);
  assert.equal(bingoCount(Array(9).fill(true), 3), 8);
  assert.equal(bingoCount(Array(16).fill(false), 4), 0);
  assert.equal(bingoCount(Array(16).fill(true), 4), 10);
});
