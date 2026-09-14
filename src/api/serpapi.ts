import { ShoppingPrices, ShoppingResult } from "../types";

interface SerpApiShoppingResult {
  title: string;
  source: string;
  price: string;
  link: string;
}

interface SerpApiResponse {
  error?: string;
  shopping_results?: SerpApiShoppingResult[];
}

const QUOTA_PATTERNS = ["credit", "quota", "limit", "plan"];

function isQuotaError(data: SerpApiResponse): boolean {
  if (!data.error) return false;
  const lower = data.error.toLowerCase();
  return QUOTA_PATTERNS.some((p) => lower.includes(p));
}

function parsePrice(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.,]/g, "").replace(",", ".");
  const value = parseFloat(cleaned);
  return isNaN(value) ? null : value;
}

function detectCurrency(raw: string): string {
  if (raw.includes("€")) return "EUR";
  if (raw.includes("£")) return "GBP";
  return "USD";
}

async function fetchRegion(
  query: string,
  gl: string,
  apiKey: string,
): Promise<{ results: ShoppingResult[]; exhausted: boolean }> {
  const url = `https://serpapi.com/search.json?engine=google_shopping&api_key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(query)}&gl=${gl}`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    return { results: [], exhausted: false };
  }

  if (response.status === 429) {
    return { results: [], exhausted: true };
  }

  if (!response.ok) {
    return { results: [], exhausted: false };
  }

  const data = (await response.json()) as SerpApiResponse;

  if (isQuotaError(data)) {
    return { results: [], exhausted: true };
  }

  const items = (data.shopping_results ?? []).slice(0, 5);
  const results: ShoppingResult[] = items.flatMap((item) => {
    const price = parsePrice(item.price);
    if (price === null) return [];
    return [{ store: item.source, price, currency: detectCurrency(item.price), link: item.link }];
  });

  return { results, exhausted: false };
}

export async function fetchShoppingPrices(query: string, apiKey: string): Promise<ShoppingPrices> {
  const [us, nl] = await Promise.all([fetchRegion(query, "us", apiKey), fetchRegion(query, "nl", apiKey)]);

  return {
    us: us.results,
    nl: nl.results,
    exhausted: us.exhausted || nl.exhausted,
  };
}
