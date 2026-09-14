export interface SetMetadata {
  setNum: string;
  name: string;
  pieces: number;
  year: number;
  imageUrl: string;
}

export interface RetailPrices {
  usUsd: number | null;
  nlEur: number | null;
}

export interface ShoppingResult {
  store: string;
  price: number;
  currency: string;
  link: string;
}

export interface ShoppingPrices {
  us: ShoppingResult[];
  nl: ShoppingResult[];
  exhausted: boolean;
}

export interface MarketPrices {
  newAvgUsd: number | null;
  usedAvgUsd: number | null;
}

export interface ExchangeRates {
  usdToBrl: number;
  eurToBrl: number;
}

export interface Preferences {
  rebrickableApiKey: string;
  bricksetApiKey?: string;
  bricklinkConsumerKey?: string;
  bricklinkConsumerSecret?: string;
  bricklinkTokenKey?: string;
  bricklinkTokenSecret?: string;
  serpapiKey: string;
}
