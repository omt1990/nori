// 画面1：作る。時間・路線・お題・チーム数 → 部屋を作って参加リンクへ。

import { HOURS, settingsFor, durationMs, cellCount, visibleLines, candidateStations, lineSelectionError, makeBoard, shuffle } from '../board.js';
import { MISSIONS } from '../data/missions.js';
import { createRoom } from '../firebase.js';
import { h, toast } from './dom.js';

export const TEAM_NAMES = ['東', '西', '南', '北'];
const OPERATOR_ORDER = ['東京地下鉄', '東京都', '東日本旅客鉄道'];

const draft = { hours: 2, lines: new Set(), missions: true, teams: 2, busy: false };

export function renderCreate(ctx) {
  const data = ctx.data;
  const s = settingsFor(draft.hours);
  const all = visibleLines(data);
  const allIds = all.map((l) => l.id);
  const chosen = draft.hours === 8 ? allIds : [...draft.lines];
  const have = candidateStations(data, chosen).length;
  const need = cellCount(s.size);
  const err = lineSelectionError(data, draft.hours, chosen);

  const operators = [...new Set(all.map((l) => l.operator))].sort((a, b) => {
    const ia = OPERATOR_ORDER.indexOf(a); const ib = OPERATOR_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b, 'ja');
  });

  const root = h('div', { class: 'section', style: 'gap:24px' },
    h('div', { class: 'section' },
      h('div', { class: 'label' }, '時間'),
      h('div', { class: 'seg', role: 'group' },
        HOURS.map((hr) => h('button', {
          type: 'button', 'aria-pressed': String(draft.hours === hr),
          onClick: () => { draft.hours = hr; ctx.render(); },
        }, `${hr}h`)))),

    h('div', { class: 'section' },
      h('div', { class: 'label' }, '路線',
        h('span', { class: `count num ${err ? 'warn' : ''}` },
          draft.hours === 8 ? `全路線 ${data.stations.length}駅` : `${have} / ${need}駅`)),
      draft.hours === 8
        ? null
        : operators.map((op) => h('div', { class: 'group' },
          h('div', { class: 'group-name' }, op),
          h('div', { class: 'chips' },
            all.filter((l) => l.operator === op).map((l) => h('button', {
              type: 'button', class: 'chip', 'aria-pressed': String(draft.lines.has(l.id)),
              onClick: () => { draft.lines.has(l.id) ? draft.lines.delete(l.id) : draft.lines.add(l.id); ctx.render(); },
            }, l.name, h('span', { class: 'n' }, l.stations.length))))))),

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

    h('button', { type: 'button', class: 'btn', disabled: Boolean(err) || draft.busy, onClick: () => create(ctx, chosen) },
      err || '部屋を作る'),
  );
  return root;
}

async function create(ctx, lineIds) {
  const s = settingsFor(draft.hours);
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
    draft.lines = new Set();
    ctx.go(code);
  } catch (e) {
    toast('部屋を作れなかった', 'err');
  } finally {
    draft.busy = false;
  }
}
