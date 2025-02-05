export interface TwitterKol {
  id: string;
  screenName: string;
  score?: number;
}

export const TWITTER_KOLS: TwitterKol[] = [
  {
    id: '1341802616565739521',
    screenName: 'CleanseSmart',
    score: 100,
  },
  {
    id: '1132684191097921536',
    screenName: 'cryptodraw_info',
    score: 100,
  },
  {
    id: '1357973275289280512',
    screenName: 'Manda_Coin',
    score: 100,
  },
  {
    id: '894191480834674688',
    screenName: 'TheCryptoExpres',
    score: 100,
  },
  {
    id: '1057747667860799488',
    screenName: 'Bitcoinmeraklsi',
    score: 100,
  },
  {
    id: '1571932891042422784',
    screenName: 'crypto_goos',
    score: 100,
  },
  {
    id: '1377672959041679367',
    screenName: 'Roman_Trading',
    score: 100,
  },
  {
    id: '1052756564459905025',
    screenName: 'CryptoFaibik',
    score: 100,
  },
  {
    id: '3696215239',
    screenName: 'Nebraskangooner',
    score: 100,
  },
  {
    id: '1647806180713168897',
    screenName: 'tradegym',
    score: 100,
  },
];

export function getTwitterScoreByKolId(id: string): number {
  const kol = TWITTER_KOLS.find((kol) => kol.id === id);
  return kol?.score ?? 0;
}
