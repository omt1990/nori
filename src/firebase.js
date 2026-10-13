// Firebase との接続。読むのは onValue、書くのは push / set（1回だけ）/ update（多経路）。全体 set は書かない。

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, connectAuthEmulator } from 'firebase/auth';
import {
  getDatabase, ref, push, set, update, onValue, serverTimestamp, connectDatabaseEmulator,
} from 'firebase/database';
import { firebaseConfig } from './firebase.config.js';

const USE_EMULATOR = import.meta.env.VITE_EMULATOR === '1';

const app = initializeApp(USE_EMULATOR
  ? { apiKey: 'demo', authDomain: 'demo-nori.firebaseapp.com', databaseURL: 'http://127.0.0.1:9000?ns=demo-nori', projectId: 'demo-nori' }
  : firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
if (USE_EMULATOR) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectDatabaseEmulator(db, '127.0.0.1', 9000);
}

export const configured = USE_EMULATOR || Boolean(firebaseConfig.databaseURL);

/** 匿名ログイン。uid を返す。 */
export function signIn() {
  return new Promise((resolve, reject) => {
    const off = onAuthStateChanged(auth, (user) => {
      if (user) { off(); resolve(user.uid); }
    }, reject);
    signInAnonymously(auth).catch(reject);
  });
}

let serverOffset = 0;
onValue(ref(db, '.info/serverTimeOffset'), (snap) => { serverOffset = snap.val() || 0; });
export const now = () => Date.now() + serverOffset;

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function randomCode() {
  const a = new Uint8Array(6);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

/** 部屋を作る。コードが衝突したら作り直す（config は存在すると書けない）。 */
export async function createRoom(config) {
  for (let i = 0; i < 5; i++) {
    const code = randomCode();
    try {
      await set(ref(db, `rooms/${code}/config`), { ...config, createdAt: serverTimestamp() });
      return code;
    } catch (e) {
      if (e.code !== 'PERMISSION_DENIED') throw e;
    }
  }
  throw new Error('部屋を作れなかった');
}

export function subscribeRoom(code, onRoom, onError) {
  return onValue(ref(db, `rooms/${code}`), (snap) => onRoom(snap.val()), onError);
}

export function appendEvent(code, uid, body) {
  return push(ref(db, `rooms/${code}/events`), { ...body, uid, at: serverTimestamp() });
}

/** 開始：startedAt と start イベントを1回の update で。 */
export function startRoom(code, uid, team) {
  const key = push(ref(db, `rooms/${code}/events`)).key;
  return update(ref(db, `rooms/${code}`), {
    startedAt: serverTimestamp(),
    [`events/${key}`]: { type: 'start', team, uid, at: serverTimestamp() },
  });
}
