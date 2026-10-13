// 時間 → 盤の大きさ・路線の本数・お題の盤。選んだ路線の駅だけから盤を作る。

export const HOURS = [2, 4, 8];

const SETTINGS = {
  2: { size: 3, lineMin: 1, lineMax: 2, missionSize: 0, missionCount: 6 },
  4: { size: 4, lineMin: 3, lineMax: 4, missionSize: 3, missionCount: 9 },
  8: { size: 5, lineMin: Infinity, lineMax: Infinity, missionSize: 4, missionCount: 16 },
};

export function settingsFor(hours) {
  const s = SETTINGS[hours];
  if (!s) throw new Error(`unsupported hours: ${hours}`);
  return s;
}

export function durationMs(hours) {
  return hours * 3600 * 1000;
}

/** 盤に必要な駅数。奇数の盤は中央が FREE。 */
export function cellCount(size) {
  return size * size - (size % 2 === 1 ? 1 : 0);
}

export function hasFree(size) {
  return size % 2 === 1;
}

export function freeIndex(size) {
  return hasFree(size) ? Math.floor((size * size) / 2) : -1;
}

export function visibleLines(data) {
  return data.lines.filter((l) => !l.hidden);
}

/** 選んだ路線のどれかが乗り入れる駅（名前の重複なし）。 */
export function candidateStations(data, lineIds) {
  const set = new Set(lineIds);
  return data.stations.filter((s) => s.lines.some((id) => set.has(id)));
}

/** 時間に対して路線の選び方が正しいか。8時間は全路線固定。 */
export function lineSelectionError(data, hours, lineIds) {
  const s = settingsFor(hours);
  if (hours === 8) return null;
  if (lineIds.length < s.lineMin) return `路線を${s.lineMin}本以上`;
  if (lineIds.length > s.lineMax) return `路線は${s.lineMax}本まで`;
  const need = cellCount(s.size);
  const have = candidateStations(data, lineIds).length;
  if (have < need) return `駅が足りない（${have}/${need}）`;
  return null;
}

export function shuffle(items, random) {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 盤を作る。戻り値は駅名の配列（行優先・FREE は含まない。表示側が中央に入れる）。
 */
export function makeBoard(data, lineIds, size, random = Math.random) {
  const need = cellCount(size);
  const names = candidateStations(data, lineIds).map((s) => s.name);
  if (names.length < need) throw new Error(`駅が足りない（${names.length}/${need}）`);
  return shuffle(names, random).slice(0, need);
}

/** 盤（FREE 抜き）→ size×size のマス配列。FREE は null。 */
export function toGrid(board, size) {
  const free = freeIndex(size);
  const cells = [];
  let k = 0;
  for (let i = 0; i < size * size; i++) {
    cells.push(i === free ? null : board[k++]);
  }
  return cells;
}

/** 行・列・斜めの一覧（マス番号の配列）。 */
export function lines(size) {
  const out = [];
  for (let r = 0; r < size; r++) out.push(Array.from({ length: size }, (_, c) => r * size + c));
  for (let c = 0; c < size; c++) out.push(Array.from({ length: size }, (_, r) => r * size + c));
  out.push(Array.from({ length: size }, (_, i) => i * size + i));
  out.push(Array.from({ length: size }, (_, i) => i * size + (size - 1 - i)));
  return out;
}

/** 埋まったマス（FREE は埋まっている扱い）からビンゴ列の数。 */
export function bingoCount(filled, size) {
  const free = freeIndex(size);
  return lines(size).filter((line) => line.every((i) => i === free || filled[i])).length;
}

/** 決定的な乱数（テスト・再現用）。 */
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
