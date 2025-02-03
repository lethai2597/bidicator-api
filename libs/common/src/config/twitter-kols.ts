export interface TwitterKol {
  id: string;
  username: string;
  score?: number;
}

export const TWITTER_KOLS: TwitterKol[] = [
  {
    id: '1754897521141338112',
    username: 'bebitcoinize',
    score: 100,
  },
  {
    id: '1341802616565739521',
    username: 'CleanseSmart',
    score: 100,
  },
  {
    id: '1132684191097921536',
    username: 'cryptodraw_info',
    score: 100,
  },
  {
    id: '1357973275289280512',
    username: 'Manda_Coin',
    score: 100,
  },
  {
    id: '894191480834674688',
    username: 'TheCryptoExpres',
    score: 100,
  },
  {
    id: '1057747667860799488',
    username: 'Bitcoinmeraklsi',
    score: 100,
  },
  {
    id: '1571932891042422784',
    username: 'crypto_goos',
    score: 100,
  },
  {
    id: '1377672959041679367',
    username: 'Roman_Trading',
    score: 100,
  },
  {
    id: '1052756564459905025',
    username: 'CryptoFaibik',
    score: 100,
  },
  {
    id: '3696215239',
    username: 'Nebraskangooner',
    score: 100,
  },
  {
    id: '1647806180713168897',
    username: 'tradegym',
    score: 100,
  },
];

export function getTwitterScoreByKolId(id: string): number {
  const kol = TWITTER_KOLS.find((kol) => kol.id === id);
  return kol?.score ?? 0;
}
