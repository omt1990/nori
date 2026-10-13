import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHASE, computeState, memberOf, openArrival, sortEvents } from '../src/state.js';

const H = 3600 * 1000;
const T0 = 1_760_000_000_000;

// 3×3：盤8駅＋FREE。お題は盤なし（2時間）
const config3 = {
  createdAt: T0,
  duration: 2 * H,
  size: 3,
  board: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
  lines: ['x'],
  teams: ['東', '西'],
  missions: ['m01', 'm02', 'm03'],
  missionSize: 0,
};

// push id 順になるよう、連番の id を付ける
function room(config, startedAt, list) {
  const events = {};
  list.forEach((e, i) => {
    events[`e${String(i).padStart(3, '0')}`] = e;
  });
  return { config, startedAt, events };
}
const join = (uid, name, team, at = T0) => ({ type: 'join', uid, name, team, at });
const arrive = (uid, team, station, at) => ({ type: 'arrive', uid, team, station, at });

test('events は push id 順', () => {
  const sorted = sortEvents({ b: { type: 'x' }, a: { type: 'y' } });
  assert.deepEqual(sorted.map((e) => e.id), ['a', 'b']);
});

test('ロビー：参加者とチーム。開始条件は2チーム以上に1人ずつ', () => {
  const r1 = room(config3, null, [join('u1', 'さくら', '東')]);
  const s1 = computeState(r1, T0 + 1000);
  assert.equal(s1.phase, PHASE.LOBBY);
  assert.equal(s1.canStart, false);
  assert.deepEqual(memberOf(s1, 'u1'), { uid: 'u1', name: 'さくら', team: '東' });
  assert.equal(memberOf(s1, 'u9'), null);

  const r2 = room(config3, null, [join('u1', 'さくら', '東'), join('u2', 'たろう', '東'), join('u2', 'たろう', '西')]);
  const s2 = computeState(r2, T0 + 1000);
  assert.equal(s2.canStart, true, '同じ人の最後の join が有効');
  assert.equal(s2.teams['東'].members.length, 1);
  assert.equal(s2.teams['西'].members.length, 1);
});

test('残り時間・終了・相手の盤を隠す（最後の1/6）', () => {
  const start = T0 + 10_000;
  const r = room(config3, start, [join('u1', 'a', '東'), join('u2', 'b', '西')]);
  assert.equal(computeState(r, start + 1).phase, PHASE.PLAYING);
  assert.equal(computeState(r, start + 1).remainingMs, 2 * H - 1);
  assert.equal(computeState(r, start + 2 * H - 20 * 60 * 1000 - 1).hideOpponents, false);
  assert.equal(computeState(r, start + 2 * H - 20 * 60 * 1000).hideOpponents, true);
  const ended = computeState(r, start + 2 * H);
  assert.equal(ended.phase, PHASE.ENDED);
  assert.equal(ended.remainingMs, 0);
  assert.equal(ended.hideOpponents, false);
  assert.equal(ended.canStart, false);
});

test('到着：盤は1回だけ埋まる、盤にない駅は無効、ログには残る', () => {
  const start = T0 + 10_000;
  const r = room(config3, start, [
    join('u1', 'a', '東'), join('u2', 'b', '西'),
    arrive('u1', '東', 'A', start + 1),
    arrive('u1', '東', 'A', start + 2),
    arrive('u1', '東', 'Z', start + 3),
  ]);
  const s = computeState(r, start + 100);
  const east = s.teams['東'];
  assert.equal(east.score.filled, 1);
  assert.equal(east.arrivals.length, 2, '前に来た駅でも到着は記録される');
  assert.equal(s.log.length, 5);
  assert.equal(s.log[4].ok, false, '盤にない駅');
  assert.equal(s.teams['西'].score.filled, 0);
});

test('得点：駅pt = 到着マス + ビンゴ列×3、FREE は点にならない', () => {
  const start = T0 + 10_000;
  // 3×3 の grid: A B C / D ● F... 実際は board[4]='E' が中央の右。
  // toGrid: [A,B,C,D,null,E,F,G,H]。1列目 A,B,C を埋める
  const r = room(config3, start, [
    join('u1', 'a', '東'), join('u2', 'b', '西'),
    arrive('u1', '東', 'A', start + 1),
    arrive('u1', '東', 'B', start + 2),
    arrive('u1', '東', 'C', start + 3),
  ]);
  const s = computeState(r, start + 100);
  const sc = s.teams['東'].score;
  assert.equal(sc.filled, 3);
  assert.equal(sc.stationBingo, 1);
  assert.equal(sc.stationPt, 6);
  assert.equal(sc.missionPt, 0);
  assert.equal(sc.total, 6, 'お題0なら 駅pt × 1');
});

test('お題：直近の到着1つにつき1つ。同じ駅に戻ればまたできる。得点は駅pt×(お題pt+1)', () => {
  const start = T0 + 10_000;
  const list = [
    join('u1', 'a', '東'), join('u2', 'b', '西'),
    arrive('u1', '東', 'A', start + 1),                                   // e002
    { type: 'mission', uid: 'u1', team: '東', mission: 'm01', arrive: 'e002', at: start + 2 },
    { type: 'mission', uid: 'u1', team: '東', mission: 'm02', arrive: 'e002', at: start + 3 }, // 同じ到着で2つ目 → 無効
    arrive('u1', '東', 'A', start + 4),                                   // e005 同じ駅に戻る
    { type: 'mission', uid: 'u1', team: '東', mission: 'm02', arrive: 'e005', at: start + 5 },
    { type: 'mission', uid: 'u1', team: '東', mission: 'm09', arrive: 'e005', at: start + 6 }, // 一覧にないお題 → 無効
  ];
  const r = room(config3, start, list);
  const s = computeState(r, start + 100);
  const east = s.teams['東'];
  assert.equal(east.missions.length, 2);
  assert.equal(s.log[4].ok, false);
  assert.equal(s.log[7].ok, false);
  assert.equal(east.score.filled, 1);
  assert.equal(east.score.missionPt, 2);
  assert.equal(east.score.total, 1 * (2 + 1));
  assert.equal(openArrival(s, '東'), null, '直近の到着は使用済み');

  const r2 = room(config3, start, [...list, arrive('u1', '東', 'B', start + 7)]);
  const s2 = computeState(r2, start + 100);
  assert.equal(openArrival(s2, '東').station, 'B');
});

test('お題の盤（4時間・3×3）はビンゴ列×3', () => {
  const start = T0 + 10_000;
  const config4 = {
    ...config3,
    duration: 4 * H,
    size: 4,
    board: Array.from({ length: 16 }, (_, i) => `S${i}`),
    missions: Array.from({ length: 9 }, (_, i) => `m0${i + 1}`),
    missionSize: 3,
  };
  const list = [join('u1', 'a', '東'), join('u2', 'b', '西')];
  // お題 m01, m02, m03（1行目）を3回の到着で達成
  ['S0', 'S1', 'S2'].forEach((st, i) => {
    list.push(arrive('u1', '東', st, start + i * 10 + 1));
    const arriveId = `e${String(list.length - 1).padStart(3, '0')}`;
    list.push({ type: 'mission', uid: 'u1', team: '東', mission: `m0${i + 1}`, arrive: arriveId, at: start + i * 10 + 2 });
  });
  const s = computeState(room(config4, start, list), start + 1000);
  const sc = s.teams['東'].score;
  assert.equal(sc.filled, 3);
  assert.equal(sc.stationBingo, 0);
  assert.equal(sc.missionCount, 3);
  assert.equal(sc.missionBingo, 1);
  assert.equal(sc.missionPt, 6);
  assert.equal(sc.total, 3 * 7);
});

test('void：元は残り、効果だけ消える。到着を void するとそのお題も消える', () => {
  const start = T0 + 10_000;
  const list = [
    join('u1', 'a', '東'), join('u2', 'b', '西'),
    arrive('u1', '東', 'A', start + 1),                                   // e002
    { type: 'mission', uid: 'u1', team: '東', mission: 'm01', arrive: 'e002', at: start + 2 }, // e003
    arrive('u1', '東', 'B', start + 3),                                   // e004
    { type: 'void', uid: 'u1', team: '東', ref: 'e002', at: start + 4 },
  ];
  const s = computeState(room(config3, start, list), start + 100);
  const east = s.teams['東'];
  assert.equal(east.score.filled, 1, 'B だけ');
  assert.equal(east.missions.length, 0);
  assert.equal(s.log.length, 6, 'ログは全部残る');
  assert.equal(s.log[2].voided, true);
  assert.equal(s.log[3].ok, false);
});

test('順位と優勝：同点なら両方優勝', () => {
  const start = T0 + 10_000;
  const list = [
    join('u1', 'a', '東'), join('u2', 'b', '西'),
    arrive('u1', '東', 'A', start + 1),
    arrive('u2', '西', 'B', start + 2),
    arrive('u2', '西', 'C', start + 3),
  ];
  const playing = computeState(room(config3, start, list), start + 100);
  assert.deepEqual(playing.ranking.map((t) => t.name), ['西', '東']);
  assert.deepEqual(playing.winners, [], '終了前は優勝なし');
  const ended = computeState(room(config3, start, list), start + 2 * H);
  assert.deepEqual(ended.winners, ['西']);

  const tie = computeState(room(config3, start, list.concat(arrive('u1', '東', 'D', start + 4))), start + 2 * H);
  assert.deepEqual(tie.winners, ['東', '西']);
});

test('カード：直近の札をチームごとに持つ', () => {
  const start = T0 + 10_000;
  const list = [
    join('u1', 'a', '東'), join('u2', 'b', '西'),
    { type: 'draw', uid: 'u1', team: '東', card: 'K', source: 'app', at: start + 1 },
    { type: 'draw', uid: 'u1', team: '東', card: 'JOKER', source: 'hand', at: start + 2 },
  ];
  const s = computeState(room(config3, start, list), start + 100);
  assert.equal(s.teams['東'].lastCard, 'JOKER');
  assert.equal(s.log[2].steps, 13);
  assert.equal(s.log[3].steps, null);
  assert.equal(s.teams['西'].lastCard, null);
});
