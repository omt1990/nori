import './styles.css';
import data from './data/stations.json';
import { configured, signIn, now, subscribeRoom } from './firebase.js';
import { computeState, memberOf, PHASE } from './state.js';
import { h, dia, toast, fmtClock } from './ui/dom.js';
import { renderCreate } from './ui/create.js';
import { renderJoin, renderLobby } from './ui/join.js';
import { renderPlay } from './ui/play.js';
import { renderResult } from './ui/result.js';

const app = document.getElementById('app');
const ctx = { uid: null, code: null, room: undefined, data, now, go, render };
let unsubscribe = null;
let tick = null;

function header() {
  return h('header', { class: 'brand' },
    h('div', { class: 'brand-name' }, dia(), 'NORI'),
    h('div', { class: 'brand-sub' }, 'Tokyo On Foot'));
}

function footer() {
  return h('footer', {},
    '駅データ：',
    h('a', { href: 'https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N02-2024.html', target: '_blank', rel: 'noopener' }, '国土数値情報（鉄道データ N02-24）'),
    '国土交通省 ／ CC BY 4.0');
}

function screen() {
  if (!configured) return h('div', { class: 'center' }, 'SETUP');
  if (!ctx.uid) return h('div', { class: 'center' }, '…');
  if (!ctx.code) return renderCreate(ctx);
  if (ctx.room === undefined) return h('div', { class: 'center' }, '…');
  if (ctx.room === null || !ctx.room.config) {
    return h('div', { class: 'section' },
      h('div', { class: 'code' }, ctx.code),
      h('div', { class: 'center' }, 'NOT FOUND'),
      h('button', { class: 'btn outline', onClick: () => go(null) }, '部屋を作る'));
  }
  const state = computeState(ctx.room, now());
  const me = memberOf(state, ctx.uid);
  if (state.phase === PHASE.ENDED) return renderResult(ctx, state, me);
  if (!me || (state.phase === PHASE.LOBBY && ctx.rejoin)) return renderJoin(ctx, state);
  if (state.phase === PHASE.LOBBY) return renderLobby(ctx, state, me);
  return renderPlay(ctx, state, me);
}

let lastKey = '';

function render() {
  const active = document.activeElement;
  const keep = active && active.dataset && active.dataset.keep;
  app.replaceChildren(header(), screen(), footer());
  if (keep) {
    const again = app.querySelector(`[data-keep="${keep}"]`);
    if (again) again.focus();
  }
  const state = ctx.room && ctx.room.config ? computeState(ctx.room, now()) : null;
  lastKey = state ? `${state.phase}|${state.hideOpponents}` : '';
  const playing = state && state.phase === PHASE.PLAYING;
  if (playing && !tick) tick = setInterval(onTick, 1000);
  if (!playing && tick) { clearInterval(tick); tick = null; }
}

/** 毎秒：時計だけ書き換える。局面（終了・終盤）が変わった時だけ全体を描き直す。 */
function onTick() {
  if (!ctx.room || !ctx.room.config) return;
  const state = computeState(ctx.room, now());
  const key = `${state.phase}|${state.hideOpponents}`;
  if (key !== lastKey) { render(); return; }
  const clock = app.querySelector('.clock');
  if (clock) {
    clock.textContent = fmtClock(state.remainingMs);
    clock.classList.toggle('warn', state.remainingMs < 10 * 60 * 1000);
  }
}

/** 部屋へ移動（null でトップ）。 */
function go(code) {
  const url = code ? `${location.pathname}?room=${code}` : location.pathname;
  history.pushState(null, '', url);
  route();
}

function route() {
  const code = (new URLSearchParams(location.search).get('room') || '').toUpperCase() || null;
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  ctx.code = code;
  ctx.room = undefined;
  render();
  if (code) {
    unsubscribe = subscribeRoom(code, (room) => { ctx.room = room; render(); }, (err) => {
      ctx.room = null;
      toast(err.code === 'PERMISSION_DENIED' ? 'この部屋は開けない' : '通信エラー', 'err');
      render();
    });
  }
}

window.addEventListener('popstate', route);
render();
signIn().then((uid) => { ctx.uid = uid; route(); }).catch(() => toast('接続できない', 'err'));
