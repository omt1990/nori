// 画面2：参加（名前・チーム）と、開始前のロビー。

import { appendEvent, startRoom } from '../firebase.js';
import { lineNames } from '../board.js';
import { h, dia, toast } from './dom.js';

const draft = { name: '', team: null, busy: false };

function teamCards(state, selected, onPick) {
  return h('div', { class: 'teams' },
    Object.values(state.teams).map((t) => h(onPick ? 'button' : 'div', {
      type: onPick ? 'button' : null, class: 'team-card', 'aria-pressed': String(selected === t.name), 'aria-label': t.name,
      onClick: onPick ? () => onPick(t.name) : null,
    },
    h('div', { class: 't' }, dia('sm'), t.name, h('span', { class: 'num' }, t.members.length)),
    h('div', { class: 'names' }, t.members.map((m) => m.name).join('・')))));
}

export function shareBlock(ctx) {
  const url = `${location.origin}${location.pathname}?room=${ctx.code}`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); toast('コピーした'); } catch { toast('コピーできない', 'err'); }
  };
  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: 'NORI', url }); } catch { /* 閉じただけ */ }
    } else copy();
  };
  return h('div', { class: 'share' },
    h('div', { class: 'code' }, ctx.code),
    h('div', { class: 'row' },
      h('button', { type: 'button', class: 'btn outline sm', onClick: copy }, 'リンクをコピー'),
      h('button', { type: 'button', class: 'btn outline sm', onClick: share }, '共有')));
}

const canJoin = () => draft.name.trim().length > 0 && Boolean(draft.team) && !draft.busy;

/** 選ばれた路線（表示だけ）。 */
export function linesBlock(ctx) {
  const names = lineNames(ctx.data, ctx.room.config.lines);
  return h('div', { class: 'chips' }, names.map((n) => h('span', { class: 'chip', 'aria-pressed': 'true' }, n)));
}

export function renderJoin(ctx, state) {
  const join = async () => {
    if (!canJoin()) return;
    draft.busy = true; ctx.render();
    try {
      await appendEvent(ctx.code, ctx.uid, { type: 'join', name: draft.name.trim().slice(0, 20), team: draft.team });
      ctx.rejoin = false;
    } catch { toast('参加できなかった', 'err'); } finally { draft.busy = false; ctx.render(); }
  };
  return h('div', { class: 'section', style: 'gap:24px' },
    h('div', { class: 'code' }, ctx.code),
    linesBlock(ctx),
    h('div', { class: 'section' },
      h('div', { class: 'label' }, '名前'),
      h('input', {
        class: 'input', type: 'text', maxLength: 20, autocomplete: 'nickname', value: draft.name, 'data-keep': 'name',
        // 1文字ごとに画面を描き直すと日本語の変換が切れるので、ボタンの有効・無効だけ切り替える
        onInput: (e) => {
          draft.name = e.target.value;
          const b = document.querySelector('[data-join]');
          if (b) b.disabled = !canJoin();
        },
        onKeydown: (e) => { if (e.key === 'Enter' && !e.isComposing) join(); },
      })),
    h('div', { class: 'section' },
      h('div', { class: 'label' }, 'チーム'),
      teamCards(state, draft.team, (name) => { draft.team = name; ctx.render(); })),
    h('button', { type: 'button', class: 'btn', 'data-join': '1', disabled: !canJoin(), onClick: join }, '参加'));
}

export function renderLobby(ctx, state, me) {
  const start = async () => {
    try { await startRoom(ctx.code, ctx.uid, me.team); } catch { toast('開始できなかった', 'err'); }
  };
  return h('div', { class: 'section', style: 'gap:24px' },
    shareBlock(ctx),
    linesBlock(ctx),
    h('div', { class: 'section' },
      h('div', { class: 'label' }, 'チーム', h('span', { class: 'count' }, `${Object.keys(state.members).length}人`)),
      teamCards(state, me.team, null),
      h('button', { type: 'button', class: 'btn outline sm', onClick: () => { draft.name = me.name; draft.team = null; ctx.rejoin = true; ctx.render(); } }, 'チームを変える')),
    h('button', { type: 'button', class: 'btn gold', disabled: !state.canStart, onClick: start },
      state.canStart ? '開始' : '相手チーム待ち'));
}
