// config + startedAt + events から、盤・得点・ログ・残り時間を計算する純関数。
// ここは Firebase を知らない。入力は読んだままの値、出力は画面が使う形。

import { bingoCount, freeIndex, toGrid } from './board.js';
import { steps } from './cards.js';

export const PHASE = { LOBBY: 'lobby', PLAYING: 'playing', ENDED: 'ended' };

/** events は {id: event} の辞書でも、[{id, ...event}] の配列でもよい。push id 順に並べる。 */
export function sortEvents(events) {
  const list = Array.isArray(events)
    ? events
    : Object.entries(events || {}).map(([id, e]) => ({ id, ...e }));
  return list.slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * @param {object} room  { config, startedAt, events }
 * @param {number} now   ミリ秒
 */
export function computeState(room, now) {
  const { config } = room;
  if (!config) return null;
  const events = sortEvents(room.events);
  const voided = new Set(events.filter((e) => e.type === 'void' && e.ref).map((e) => e.ref));
  const live = events.filter((e) => !voided.has(e.id));

  const startedAt = room.startedAt || null;
  const endsAt = startedAt ? startedAt + config.duration : null;
  const phase = !startedAt ? PHASE.LOBBY : now >= endsAt ? PHASE.ENDED : PHASE.PLAYING;
  const remainingMs = endsAt ? Math.max(0, endsAt - now) : null;
  const hideOpponents = phase === PHASE.PLAYING && now >= endsAt - config.duration / 6;

  // 参加者：uid ごとに最後の join が有効
  const members = {};
  for (const e of live) {
    if (e.type === 'join' && config.teams.includes(e.team)) {
      members[e.uid] = { uid: e.uid, name: e.name, team: e.team };
    }
  }
  const memberList = Object.values(members);

  const size = config.size;
  const grid = toGrid(config.board, size);
  const free = freeIndex(size);
  const missionIds = Array.isArray(config.missions) ? config.missions : [];
  const missionSize = config.missionSize || 0;

  const teams = {};
  for (const name of config.teams) {
    teams[name] = {
      name,
      members: memberList.filter((m) => m.team === name),
      filled: grid.map((cell, i) => i === free),
      arrivals: [],
      missions: [],
      missionFilled: missionIds.map(() => false),
      lastCard: null,
    };
  }

  const usedArrivals = new Set();
  const log = [];
  for (const e of events) {
    const team = teams[e.team];
    const entry = { id: e.id, at: e.at, type: e.type, team: e.team, uid: e.uid, voided: voided.has(e.id), ok: true };
    if (e.type === 'join') {
      entry.name = e.name;
    } else if (!team || phase === PHASE.LOBBY) {
      entry.ok = false;
    } else if (e.type === 'draw') {
      entry.card = e.card;
      entry.source = e.source;
      entry.steps = steps(e.card);
      if (!entry.voided) team.lastCard = e.card;
    } else if (e.type === 'arrive') {
      entry.station = e.station;
      const idx = grid.indexOf(e.station);
      entry.ok = idx >= 0;
      if (entry.ok && !entry.voided) {
        team.filled[idx] = true;
        team.arrivals.push({ id: e.id, station: e.station, at: e.at });
      }
    } else if (e.type === 'mission') {
      entry.mission = e.mission;
      // 直近の到着1つにつきお題1つ。到着が void されればそのお題も消える
      const arrival = team.arrivals[team.arrivals.length - 1];
      const mi = missionIds.indexOf(e.mission);
      entry.ok = !!arrival && arrival.id === e.arrive && mi >= 0 && !usedArrivals.has(e.arrive) && !team.missionFilled[mi];
      if (entry.ok && !entry.voided) {
        usedArrivals.add(e.arrive);
        team.missionFilled[mi] = true;
        team.missions.push({ id: e.id, mission: e.mission, arrive: e.arrive, station: arrival.station, at: e.at });
      }
    } else if (e.type === 'void') {
      entry.ref = e.ref;
    }
    log.push(entry);
  }

  for (const t of Object.values(teams)) {
    const filledCount = t.filled.filter((f, i) => f && i !== free).length;
    const stationBingo = bingoCount(t.filled, size);
    const missionCount = t.missions.length;
    const missionBingo = missionSize > 0 ? bingoCount(t.missionFilled, missionSize) : 0;
    t.score = {
      filled: filledCount,
      stationBingo,
      stationPt: filledCount + stationBingo * 3,
      missionCount,
      missionBingo,
      missionPt: missionCount + missionBingo * 3,
    };
    t.score.total = t.score.stationPt * (t.score.missionPt + 1);
  }

  const ranking = config.teams
    .map((n) => teams[n])
    .slice()
    .sort((a, b) => b.score.total - a.score.total || b.score.filled - a.score.filled || config.teams.indexOf(a.name) - config.teams.indexOf(b.name));
  const topScore = ranking[0]?.score.total ?? 0;
  const winners = phase === PHASE.ENDED ? ranking.filter((t) => t.score.total === topScore).map((t) => t.name) : [];

  const teamsWithMembers = config.teams.filter((n) => teams[n].members.length > 0);
  const canStart = phase === PHASE.LOBBY && teamsWithMembers.length >= 2;

  return {
    phase,
    startedAt,
    endsAt,
    remainingMs,
    hideOpponents,
    canStart,
    members,
    teams,
    ranking,
    winners,
    grid,
    size,
    free,
    missionIds,
    missionSize,
    log,
  };
}

/** uid の所属（名前・チーム）。未参加なら null。 */
export function memberOf(state, uid) {
  return (state && state.members[uid]) || null;
}

/** この到着でまだお題を記録できるか（直近の到着1つにつき1つ）。 */
export function openArrival(state, teamName) {
  const team = state.teams[teamName];
  if (!team || team.arrivals.length === 0) return null;
  const last = team.arrivals[team.arrivals.length - 1];
  return team.missions.some((m) => m.arrive === last.id) ? null : last;
}
