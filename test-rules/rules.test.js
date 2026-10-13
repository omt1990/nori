// database.rules.json をエミュレータで検証する。
// 実行: npm run test:rules（firebase emulators:exec が DB エミュレータを立ててから走る）

import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { ref, set, push, update, get, serverTimestamp, remove } from 'firebase/database';

const DAY = 24 * 3600 * 1000;
let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-nori',
    database: {
      rules: readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8'),
      host: '127.0.0.1',
      port: 9000,
    },
  });
});
after(async () => env.cleanup());
beforeEach(async () => env.clearDatabase());

const db = (uid) => env.authenticatedContext(uid).database();
const anon = () => env.unauthenticatedContext().database();

const CODE = 'ABC234';
const baseConfig = {
  createdAt: serverTimestamp(),
  duration: 7200000,
  size: 3,
  board: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
  lines: ['東京地下鉄|3号線銀座線'],
  teams: ['東', '西'],
  missions: ['m01', 'm02'],
  missionSize: 0,
};

async function createRoom(uid = 'u1', code = CODE, extra = {}) {
  await assertSucceeds(set(ref(db(uid), `rooms/${code}/config`), { ...baseConfig, ...extra }));
}

/** エミュレータ側でルールを迂回して時刻を細工する（過去に作られた部屋の再現）。 */
async function seedRaw(path, value) {
  await env.withSecurityRulesDisabled(async (ctx) => set(ref(ctx.database(), path), value));
}

const ev = (uid, body) => ({ uid, at: serverTimestamp(), ...body });

test('匿名認証なしでは読めない・書けない', async () => {
  await createRoom();
  await assertFails(get(ref(anon(), `rooms/${CODE}`)));
  await assertFails(set(ref(anon(), `rooms/ZZZ999/config`), baseConfig));
});

test('部屋の一覧は読めない。部屋単位なら読める', async () => {
  await createRoom();
  await assertFails(get(ref(db('u2'), 'rooms')));
  await assertSucceeds(get(ref(db('u2'), `rooms/${CODE}`)));
  await assertSucceeds(get(ref(db('u2'), `rooms/NPQ234`)), '無い部屋は null で読める');
});

test('config は1回だけ書ける。上書き・削除は不可', async () => {
  await createRoom();
  await assertFails(set(ref(db('u1'), `rooms/${CODE}/config`), { ...baseConfig, duration: 14400000 }));
  await assertFails(set(ref(db('u2'), `rooms/${CODE}/config`), baseConfig));
  await assertFails(remove(ref(db('u1'), `rooms/${CODE}/config`)));
  await assertFails(set(ref(db('u1'), `rooms/${CODE}/config/duration`), 14400000));
});

test('config の中身：時間は3種、サイズは3種、createdAt はサーバー時刻、コードは6文字', async () => {
  await assertFails(set(ref(db('u1'), `rooms/${CODE}/config`), { ...baseConfig, duration: 1000 }));
  await assertFails(set(ref(db('u1'), `rooms/${CODE}/config`), { ...baseConfig, size: 6 }));
  await assertFails(set(ref(db('u1'), `rooms/${CODE}/config`), { ...baseConfig, createdAt: Date.now() - 1000 }));
  await assertFails(set(ref(db('u1'), `rooms/abc`, ), { config: baseConfig }));
  await assertFails(set(ref(db('u1'), `rooms/ABC2340/config`), baseConfig));
  await assertFails(set(ref(db('u1'), `rooms/${CODE}/config`), { ...baseConfig, teams: ['とても長いチームの名前'] }));
  await createRoom();
});

test('startedAt は1回だけ・サーバー時刻・config がある部屋だけ', async () => {
  await assertFails(set(ref(db('u1'), `rooms/${CODE}/startedAt`), serverTimestamp()), 'config が無い');
  await createRoom();
  await assertFails(set(ref(db('u2'), `rooms/${CODE}/startedAt`), Date.now()), '端末時刻');
  await assertSucceeds(set(ref(db('u2'), `rooms/${CODE}/startedAt`), serverTimestamp()), '参加者の誰でも押せる');
  await assertFails(set(ref(db('u1'), `rooms/${CODE}/startedAt`), serverTimestamp()), '2回目');
  await assertFails(remove(ref(db('u1'), `rooms/${CODE}/startedAt`)));
});

test('開始は startedAt と start イベントを1回の update で書ける', async () => {
  await createRoom();
  const key = push(ref(db('u2'), `rooms/${CODE}/events`)).key;
  await assertSucceeds(update(ref(db('u2'), `rooms/${CODE}`), {
    startedAt: serverTimestamp(),
    [`events/${key}`]: ev('u2', { type: 'start', team: '西' }),
  }));
  const snap = await get(ref(db('u2'), `rooms/${CODE}`));
  assert.equal(typeof snap.val().startedAt, 'number');
  assert.equal(snap.val().events[key].type, 'start');
});

test('events は追加のみ。更新・削除は不可。uid と at は偽れない', async () => {
  await createRoom();
  const r = push(ref(db('u2'), `rooms/${CODE}/events`));
  await assertSucceeds(set(r, ev('u2', { type: 'join', name: 'さくら', team: '東' })));
  await assertFails(set(r, ev('u2', { type: 'join', name: 'さくら', team: '西' })), '更新');
  await assertFails(remove(r), '削除');
  await assertFails(update(r, { name: 'たろう' }), '部分更新');
  await assertFails(push(ref(db('u2'), `rooms/${CODE}/events`), ev('u9', { type: 'join', name: 'x', team: '東' })), '他人の uid');
  await assertFails(push(ref(db('u2'), `rooms/${CODE}/events`), { uid: 'u2', at: Date.now(), type: 'join', name: 'x', team: '東' }), '端末時刻');
  await assertFails(push(ref(db('u2'), `rooms/${CODE}/events`), ev('u2', { type: 'join', name: '', team: '東' })), '名前なし');
  await assertFails(push(ref(db('u2'), `rooms/${CODE}/events`), ev('u2', { type: 'hack', team: '東' })), '知らない type');
  await assertFails(push(ref(db('u2'), `rooms/${CODE}/events`), ev('u2', { type: 'join', name: 'x', team: '東', photo: 'data:...' })), '知らない項目');
});

test('開始前は join だけ。開始後は draw / arrive / mission / void も書ける', async () => {
  await createRoom();
  const events = ref(db('u2'), `rooms/${CODE}/events`);
  await assertFails(push(events, ev('u2', { type: 'arrive', team: '東', station: 'A' })), '開始前の到着');
  await assertFails(push(events, ev('u2', { type: 'draw', team: '東', card: 'K', source: 'app' })), '開始前のカード');
  await assertSucceeds(set(ref(db('u1'), `rooms/${CODE}/startedAt`), serverTimestamp()));
  await assertSucceeds(push(events, ev('u2', { type: 'draw', team: '東', card: 'K', source: 'app' })));
  const a = push(events);
  await assertSucceeds(set(a, ev('u2', { type: 'arrive', team: '東', station: 'A' })));
  await assertSucceeds(push(events, ev('u2', { type: 'mission', team: '東', mission: 'm01', arrive: a.key })));
  await assertSucceeds(push(events, ev('u2', { type: 'void', team: '東', ref: a.key })));
  await assertSucceeds(push(ref(db('u3'), `rooms/${CODE}/events`), ev('u3', { type: 'join', name: '途中参加', team: '西' })), '開始後の参加');
});

test('終了後（開始＋時間）は何も書けない', async () => {
  const createdAt = Date.now() - 3 * 3600 * 1000;
  await seedRaw(`rooms/${CODE}`, {
    config: { ...baseConfig, createdAt },
    startedAt: createdAt + 1000, // 2時間の部屋が1時間前に終わっている
  });
  const events = ref(db('u2'), `rooms/${CODE}/events`);
  await assertFails(push(events, ev('u2', { type: 'arrive', team: '東', station: 'A' })));
  await assertFails(push(events, ev('u2', { type: 'join', name: 'x', team: '東' })));
  await assertSucceeds(get(ref(db('u2'), `rooms/${CODE}`)), '読むのはできる');
});

test('作成から30日で読めなくなる', async () => {
  await seedRaw(`rooms/${CODE}`, { config: { ...baseConfig, createdAt: Date.now() - 31 * DAY } });
  await assertFails(get(ref(db('u2'), `rooms/${CODE}`)));
  await assertFails(push(ref(db('u2'), `rooms/${CODE}/events`), ev('u2', { type: 'join', name: 'x', team: '東' })));
  await seedRaw(`rooms/XYZ789`, { config: { ...baseConfig, createdAt: Date.now() - 29 * DAY } });
  await assertSucceeds(get(ref(db('u2'), `rooms/XYZ789`)));
});

test('部屋の直下に別の項目は作れない', async () => {
  await createRoom();
  await assertFails(set(ref(db('u1'), `rooms/${CODE}/admin`), true));
  await assertFails(set(ref(db('u1'), `rooms/${CODE}/photos/x`), 'data'));
});
