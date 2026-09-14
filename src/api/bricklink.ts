import crypto from "crypto";
import OAuth from "oauth-1.0a";
import { MarketPrices, Preferences } from "../types";

interface BricklinkCredentials {
  bricklinkConsumerKey: string;
  bricklinkConsumerSecret: string;
  bricklinkTokenKey: string;
  bricklinkTokenSecret: string;
}

interface BricklinkPriceDetail {
  avg_price: string;
}

interface BricklinkPriceResponse {
  meta: { code: number; message: string };
  data: BricklinkPriceDetail;
}

function createOAuthClient(creds: BricklinkCredentials): OAuth {
  return new OAuth({
    consumer: { key: creds.bricklinkConsumerKey, secret: creds.bricklinkConsumerSecret },
    signature_method: "HMAC-SHA1",
    hash_function(base: string, key: string) {
      return crypto.createHmac("sha1", key).update(base).digest("base64");
    },
  });
}

async function fetchPrice(url: string, oauth: OAuth, creds: BricklinkCredentials): Promise<number | null> {
  const requestData = { url, method: "GET" };
  const token = { key: creds.bricklinkTokenKey, secret: creds.bricklinkTokenSecret };
  const authHeader = oauth.toHeader(oauth.authorize(requestData, token));

  const response = await fetch(url, {
    headers: { ...authHeader, "Content-Type": "application/json" },
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as BricklinkPriceResponse;

  if (data.meta.code !== 200) {
    return null;
  }

  const price = parseFloat(data.data.avg_price);
  return isNaN(price) ? null : price;
}

export async function fetchMarketPrices(setNum: string, prefs: Preferences): Promise<MarketPrices> {
  const { bricklinkConsumerKey, bricklinkConsumerSecret, bricklinkTokenKey, bricklinkTokenSecret } = prefs;

  if (!bricklinkConsumerKey || !bricklinkConsumerSecret || !bricklinkTokenKey || !bricklinkTokenSecret) {
    return { newAvgUsd: null, usedAvgUsd: null };
  }

  const creds: BricklinkCredentials = {
    bricklinkConsumerKey,
    bricklinkConsumerSecret,
    bricklinkTokenKey,
    bricklinkTokenSecret,
  };
  const base = `https://api.bricklink.com/api/store/v1/items/SET/${setNum}/price?guide_type=sold`;
  const oauth = createOAuthClient(creds);

  const [newAvgUsd, usedAvgUsd] = await Promise.all([
    fetchPrice(`${base}&new_or_used=N`, oauth, creds),
    fetchPrice(`${base}&new_or_used=U`, oauth, creds),
  ]);

  return { newAvgUsd, usedAvgUsd };
}
