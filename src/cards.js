// トランプ。A=1、2〜10=その数、J=11、Q=12、K=13、JOKER=今いる路線の好きな駅。

export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const JOKER = 'JOKER';
export const CARDS = [...RANKS, JOKER];

/** 札 → 進む駅数。JOKER は null（任意の駅）。 */
export function steps(card) {
  if (card === JOKER) return null;
  const i = RANKS.indexOf(card);
  if (i < 0) throw new Error(`unknown card: ${card}`);
  return i + 1;
}

/** 54枚（13×4＋JOKER×2）から1枚。戻し有り。 */
export function draw(random = Math.random) {
  const n = Math.floor(random() * 54);
  return n >= 52 ? JOKER : RANKS[n % 13];
}

export function isCard(card) {
  return CARDS.includes(card);
}
