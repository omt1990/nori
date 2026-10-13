// 画面2：参加（名前・チーム）と、開始前のロビー。

import { appendEvent, startRoom } from '../firebase.js';
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

export function renderJoin(ctx, state) {
  const ok = draft.name.trim().length > 0 && draft.team && !draft.busy;
  const join = async () => {
    draft.busy = true; ctx.render();
    try {
      await appendEvent(ctx.code, ctx.uid, { type: 'join', name: draft.name.trim().slice(0, 20), team: draft.team });
      ctx.rejoin = false;
    } catch { toast('参加できなかった', 'err'); } finally { draft.busy = false; ctx.render(); }
  };
  return h('div', { class: 'section', style: 'gap:24px' },
    h('div', { class: 'code' }, ctx.code),
    h('div', { class: 'section' },
      h('div', { class: 'label' }, '名前'),
      h('input', {
        class: 'input', type: 'text', maxLength: 20, autocomplete: 'nickname', value: draft.name, 'data-keep': 'name',
        onInput: (e) => { draft.name = e.target.value; ctx.render(); },
        onKeydown: (e) => { if (e.key === 'Enter' && ok) join(); },
      })),
    h('div', { class: 'section' },
      h('div', { class: 'label' }, 'チーム'),
      teamCards(state, draft.team, (name) => { draft.team = name; ctx.render(); })),
    h('button', { type: 'button', class: 'btn', disabled: !ok, onClick: join }, '参加'));
}

export function renderLobby(ctx, state, me) {
  const start = async () => {
    try { await startRoom(ctx.code, ctx.uid, me.team); } catch { toast('開始できなかった', 'err'); }
  };
  return h('div', { class: 'section', style: 'gap:24px' },
    shareBlock(ctx),
    h('div', { class: 'section' },
      h('div', { class: 'label' }, 'チーム', h('span', { class: 'count' }, `${Object.keys(state.members).length}人`)),
      teamCards(state, me.team, null),
      h('button', { type: 'button', class: 'btn outline sm', onClick: () => { draft.name = me.name; draft.team = null; ctx.rejoin = true; ctx.render(); } }, 'チームを変える')),
    h('button', { type: 'button', class: 'btn gold', disabled: !state.canStart, onClick: start },
      state.canStart ? '開始' : '相手チーム待ち'));
}
