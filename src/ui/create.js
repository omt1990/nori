// 画面1：作る。時間・お題・チーム数 → 部屋を作って参加リンクへ。路線はアプリが東京メトロから決める。

import { HOURS, settingsFor, durationMs, autoLines, makeBoard, shuffle } from '../board.js';
import { MISSIONS } from '../data/missions.js';
import { createRoom } from '../firebase.js';
import { h, toast } from './dom.js';

export const TEAM_NAMES = ['東', '西', '南', '北'];
const draft = { hours: 2, missions: true, teams: 2, busy: false };

export function renderCreate(ctx) {
  const root = h('div', { class: 'section', style: 'gap:24px' },
    h('div', { class: 'section' },
      h('div', { class: 'label' }, '時間'),
      h('div', { class: 'seg', role: 'group' },
        HOURS.map((hr) => h('button', {
          type: 'button', 'aria-pressed': String(draft.hours === hr),
          onClick: () => { draft.hours = hr; ctx.render(); },
        }, `${hr}h`)))),

    h('div', { class: 'section' },
      h('div', { class: 'label' }, 'お題'),
      h('div', { class: 'toggle' },
        h('span', {}, draft.missions ? 'あり' : 'なし'),
        h('button', {
          type: 'button', class: 'switch', role: 'switch', 'aria-checked': String(draft.missions), 'aria-label': 'お題',
          onClick: () => { draft.missions = !draft.missions; ctx.render(); },
        }))),

    h('div', { class: 'section' },
      h('div', { class: 'label' }, 'チーム'),
      h('div', { class: 'seg', role: 'group' },
        [2, 3, 4].map((n) => h('button', {
          type: 'button', 'aria-pressed': String(draft.teams === n),
          onClick: () => { draft.teams = n; ctx.render(); },
        }, n)))),

    h('button', { type: 'button', class: 'btn', disabled: draft.busy, onClick: () => create(ctx) }, '部屋を作る'),
  );
  return root;
}

async function create(ctx) {
  const s = settingsFor(draft.hours);
  const lineIds = autoLines(ctx.data, draft.hours);
  draft.busy = true;
  ctx.render();
  try {
    const config = {
      duration: durationMs(draft.hours),
      size: s.size,
      board: makeBoard(ctx.data, lineIds, s.size),
      lines: lineIds,
      teams: TEAM_NAMES.slice(0, draft.teams),
      missionSize: draft.missions ? s.missionSize : 0,
    };
    if (draft.missions) config.missions = shuffle(MISSIONS.map((m) => m.id), Math.random).slice(0, s.missionCount);
    const code = await createRoom(config);
    ctx.go(code);
  } catch (e) {
    toast('部屋を作れなかった', 'err');
  } finally {
    draft.busy = false;
  }
}
