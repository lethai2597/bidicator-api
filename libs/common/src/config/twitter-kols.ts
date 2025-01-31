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
    id: '1469101279',
    username: 'aantonop',
    score: 100,
  },
  {
    id: '339061487',
    username: 'APompliano',
    score: 100,
  },
  {
    id: '247857712',
    username: 'PeterLBrandt',
    score: 100,
  },
  {
    id: '1022821051187822593',
    username: 'glassnode',
    score: 100,
  },
  {
    id: '1134052146800922625',
    username: 'CryptoBullet1',
    score: 100,
  },
  {
    id: '1602562830812647424',
    username: 'JayLunox',
    score: 100,
  },
  {
    id: '1408528018981769218',
    username: 'ACCURAT_SIGNALS',
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
    id: '787634466',
    username: 'CryptoJelleNL',
    score: 100,
  },
  {
    id: '1246136623965843462',
    username: 'BtBanaLiz',
    score: 100,
  },
  {
    id: '2440507021',
    username: 'theKriptolik',
    score: 100,
  },
  {
    id: '782946231551131648',
    username: 'MartiniGuyYT',
    score: 100,
  },
  {
    id: '1371883902265069569',
    username: 'misterrcrypto',
    score: 100,
  },
  {
    id: '1757471548577849344',
    username: '0xFurkan_eth',
    score: 100,
  },
  {
    id: '146008010',
    username: 'CryptoMichNL',
    score: 100,
  },
  {
    id: '1353384573435056128',
    username: 'rovercrc',
    score: 100,
  },
  {
    id: '718794395470925824',
    username: 'ibrahimklczb',
    score: 100,
  },
  {
    id: '1083619608433704962',
    username: 'thescalpingpro',
    score: 100,
  },
  {
    id: '1602209694575202306',
    username: 'CryptoXLARG',
    score: 100,
  },
  {
    id: '1745359983926300673',
    username: 'haziFX',
    score: 100,
  },
  {
    id: '89994880',
    username: 'GokhanGark',
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
    id: '3185716686',
    username: 'Ashcryptoreal',
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
    id: '7489142',
    username: 'komochi4xamo',
    score: 100,
  },
  {
    id: '4441279246',
    username: 'IncomeSharks',
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
  {
    id: '2207129125',
    username: 'Cointelegraph',
    score: 100,
  }
];

export function getTwitterScoreByKolId(id: string): number {
  const kol = TWITTER_KOLS.find((kol) => kol.id === id);
  return kol?.score ?? 0;
}
