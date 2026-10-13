// 画面4：結果。順位・優勝・各チームの盤・X に投稿。

import { h, dia } from './dom.js';
import { boardGrid, logList } from './play.js';

const PLACE = ['1ST', '2ND', '3RD', '4TH'];

export function renderResult(ctx, state, me) {
  const hours = state.endsAt && state.startedAt ? Math.round((state.endsAt - state.startedAt) / 3600000) : '';
  const text = [
    `NORI ◇ ${hours}h`,
    ...state.ranking.map((t, i) => `${i + 1}位 ${t.name} ${t.score.total}pt`),
    '#TokyoOnFoot #NORI',
  ].join('\n');
  const tweet = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;

  return h('div', { class: 'section', style: 'gap:24px' },
    h('div', { class: 'section' },
      state.ranking.map((t, i) => {
        const win = state.winners.includes(t.name);
        return h('div', { class: `rank-card ${win ? 'win' : ''}` },
          h('div', { class: 'section', style: 'gap:6px' },
            h('div', { class: 'place' }, win ? 'WINNER' : PLACE[i]),
            h('div', { class: 'tname' }, dia(win ? 'gold' : 'sm'), t.name),
            h('div', { class: 'total' }, t.score.total, h('small', {}, 'pt')),
            h('div', { class: 'members' }, t.members.map((m) => m.name).join('・')),
            h('div', { class: 'breakdown' },
              kpi(t.score.filled, '駅'), kpi(t.score.stationBingo, '駅の列'), kpi(t.score.missionCount, 'お題'), kpi(t.score.missionBingo, 'お題の列'))),
          boardGrid(state, t, { mini: true }));
      })),
    h('div', { class: 'row' },
      h('a', { class: 'btn outline', href: tweet, target: '_blank', rel: 'noopener', style: 'display:flex;align-items:center;justify-content:center;text-decoration:none' }, 'Xに投稿'),
      h('button', { type: 'button', class: 'btn outline', onClick: () => ctx.go(null) }, '部屋を作る')),
    h('div', { class: 'section' },
      h('div', { class: 'label' }, '記録'),
      logList(state, me, null)),
  );
}

function kpi(v, k) {
  return h('div', { class: 'kpi' }, h('div', { class: 'v' }, v), h('div', { class: 'k' }, k));
}
