// 画面3：プレイ。残り時間 → 札 → 盤（到着）→ お題 → 相手の盤 → ログ。

import { CARDS, JOKER, draw, steps } from '../cards.js';
import { toGrid } from '../board.js';
import { openArrival } from '../state.js';
import { missionText } from '../data/missions.js';
import { appendEvent } from '../firebase.js';
import { h, dia, sheet, toast, fmtClock, fmtTime } from './dom.js';

function fail(e) {
  toast(e && e.code === 'PERMISSION_DENIED' ? '記録できなかった' : '通信エラー', 'err');
}

function cardFace(card) {
  if (!card) return h('div', { class: 'card empty' }, h('div', { class: 'rank' }, '—'));
  const n = steps(card);
  return h('div', { class: 'card' },
    h('div', { class: `rank ${card === JOKER ? 'joker' : ''}` }, card),
    h('div', { class: 'steps' }, n == null ? '好きな駅' : `${n}駅`));
}

/** 盤。onCell があればマスはボタン。 */
export function boardGrid(state, team, { mini = false, veil = false, onCell = null } = {}) {
  const cls = `board s${state.size} ${mini ? 'mini' : ''}`;
  return h('div', { class: cls },
    state.grid.map((name, i) => {
      const free = i === state.free;
      const on = team.filled[i] && !veil;
      const classes = `cell ${free ? 'free' : ''} ${on && !free ? 'on' : ''} ${veil ? 'veil' : ''}`;
      if (onCell && !free) {
        return h('button', { type: 'button', class: classes, onClick: () => onCell(name) }, name);
      }
      return h('div', { class: classes }, free ? 'FREE' : mini ? '' : name);
    }));
}

function missionGrid(state, team) {
  const n = state.missionSize;
  if (!n) return null;
  return h('div', { class: `board mini s${n}` },
    state.missionIds.map((id, i) => h('div', { class: `cell ${team.missionFilled[i] ? 'on' : ''}` })));
}

export function renderPlay(ctx, state, me) {
  const team = state.teams[me.team];
  const others = Object.values(state.teams).filter((t) => t.name !== me.team);
  const open = openArrival(state, me.team);
  const hasMissions = state.missionIds.length > 0;
  const send = (body) => appendEvent(ctx.code, ctx.uid, { team: me.team, ...body });

  const recordDraw = (card, source) => send({ type: 'draw', card, source }).catch(fail);

  const pickHand = () => sheet('手持ちの札', (close) => h('div', { class: 'cards14' },
    CARDS.map((c) => h('button', { type: 'button', class: c === JOKER ? 'joker' : '', onClick: () => { close(); recordDraw(c, 'hand'); } }, c))));

  const pickMission = (arriveId, station) => {
    const left = state.missionIds.filter((id, i) => !team.missionFilled[i]);
    if (left.length === 0) return;
    sheet(station, (close) => h('div', { class: 'missions' },
      left.map((id) => h('button', {
        type: 'button', class: 'mission',
        onClick: () => { close(); send({ type: 'mission', mission: id, arrive: arriveId }).catch(fail); },
      }, dia(), missionText(id)))));
  };

  const arriveAt = (station) => sheet(station, (close) => h('button', {
    type: 'button', class: 'btn',
    onClick: () => {
      close();
      const r = send({ type: 'arrive', station });
      r.catch(fail);
      if (hasMissions) pickMission(r.key, station);
    },
  }, '到着'));

  const undo = (id) => send({ type: 'void', ref: id }).catch(fail);

  return h('div', { class: 'section', style: 'gap:24px' },
    h('div', { class: 'hud' },
      h('div', { class: `clock ${state.remainingMs < 10 * 60 * 1000 ? 'warn' : ''}` }, fmtClock(state.remainingMs)),
      h('div', { class: 'me' },
        h('div', { class: 'team' }, me.team),
        h('div', { class: 'pt' }, team.score.total, h('small', {}, 'pt')))),

    h('div', { class: 'card-area' },
      cardFace(team.lastCard),
      h('div', { class: 'card-btns' },
        h('button', { type: 'button', class: 'btn', onClick: () => recordDraw(draw(), 'app') }, '引く'),
        h('button', { type: 'button', class: 'btn outline', onClick: pickHand }, '手持ち'))),

    h('div', { class: 'section' },
      h('div', { class: 'label' }, '盤', h('span', { class: 'count num' }, `${team.score.filled} / ${state.grid.length - (state.free >= 0 ? 1 : 0)}`)),
      boardGrid(state, team, { onCell: arriveAt })),

    hasMissions && h('div', { class: 'section' },
      h('div', { class: 'label' }, 'お題', h('span', { class: 'count num' }, `${team.score.missionCount} / ${state.missionIds.length}`)),
      state.missionSize ? h('div', { style: 'width:72px' }, missionGrid(state, team)) : null,
      h('div', { class: 'missions' },
        state.missionIds.map((id, i) => h('div', { class: `mission ${team.missionFilled[i] ? 'on' : ''}` }, dia(), missionText(id)))),
      open && h('button', { type: 'button', class: 'btn gold', onClick: () => pickMission(open.id, open.station) }, `${open.station}でお題`)),

    h('div', { class: 'breakdown' },
      kpi(team.score.filled, '駅'),
      kpi(team.score.stationBingo, 'ビンゴ'),
      kpi(team.score.missionCount, 'お題'),
      kpi(team.score.missionBingo, 'お題ビンゴ')),

    others.length > 0 && h('div', { class: 'section' },
      h('div', { class: 'label' }, '相手'),
      h('div', { class: 'others' },
        others.map((t) => h('div', { class: 'other' },
          h('div', { class: 't' }, t.name, h('span', { class: 'num' }, state.hideOpponents ? '—' : `${t.score.total}pt`)),
          boardGrid(state, t, { mini: true, veil: state.hideOpponents }))))),

    h('div', { class: 'section' },
      h('div', { class: 'label' }, '記録'),
      logList(state, me, undo)),
  );
}

function kpi(v, k) {
  return h('div', { class: 'kpi' }, h('div', { class: 'v' }, v), h('div', { class: 'k' }, k));
}

function describe(e) {
  switch (e.type) {
    case 'join': return `${e.name} 参加`;
    case 'start': return '開始';
    case 'draw': return e.card === JOKER ? 'JOKER' : `${e.card} → ${e.steps}駅`;
    case 'arrive': return `${e.station} 到着`;
    case 'mission': return missionText(e.mission);
    case 'void': return '取消';
    default: return e.type;
  }
}

export function logList(state, me, undo) {
  // 終盤は相手の盤を隠すので、記録も自分のチームの分だけにする
  const visible = state.hideOpponents && me ? state.log.filter((e) => e.team === me.team) : state.log;
  const rows = visible.slice().reverse().slice(0, 60);
  const names = state.members;
  return h('div', { class: 'log' },
    rows.map((e) => {
      const who = names[e.uid] ? names[e.uid].name : '';
      const mine = me && e.team === me.team && !e.voided && e.ok && ['draw', 'arrive', 'mission'].includes(e.type);
      return h('div', { class: `log-row ${e.voided ? 'off' : ''} ${!e.ok ? 'ng' : ''}` },
        h('span', { class: 'time' }, e.at ? fmtTime(e.at) : ''),
        h('span', {}, h('span', { class: 'who' }, e.team || who), describe(e)),
        mine && undo ? h('button', { type: 'button', class: 'undo', onClick: () => undo(e.id) }, '取消') : h('span'));
    }));
}
