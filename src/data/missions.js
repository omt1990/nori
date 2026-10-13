// お題。Tokyo On Foot の目的（まだ知らない東京）に沿った暫定の一覧。
// 中身の作り直しは別の回で行う（docs/design-v1.md §5）。id は変えない。

export const MISSIONS = [
  { id: 'm01', text: '知らなかった店に入る' },
  { id: 'm02', text: '地元の人に道を聞く' },
  { id: 'm03', text: '坂の名前を見つける' },
  { id: 'm04', text: '商店街のアーケードをくぐる' },
  { id: 'm05', text: '神社か寺で手を合わせる' },
  { id: 'm06', text: '川か橋の名前を読む' },
  { id: 'm07', text: '昭和の看板を見つける' },
  { id: 'm08', text: '公園のベンチに3分座る' },
  { id: 'm09', text: '駅前の銅像か碑を見つける' },
  { id: 'm10', text: 'その街のパンを買う' },
  { id: 'm11', text: '踏切を渡る' },
  { id: 'm12', text: '銭湯の煙突を見つける' },
  { id: 'm13', text: '路地を一本奥へ入る' },
  { id: 'm14', text: '高い所から街を見る' },
  { id: 'm15', text: '猫を見つける' },
  { id: 'm16', text: '古い井戸かポンプを見つける' },
  { id: 'm17', text: '石段を登る' },
  { id: 'm18', text: '丁目の境を跨ぐ' },
  { id: 'm19', text: '街の音を10秒録る' },
  { id: 'm20', text: '赤い郵便ポストの古い型を見つける' },
];

export function missionText(id) {
  const m = MISSIONS.find((x) => x.id === id);
  return m ? m.text : id;
}
