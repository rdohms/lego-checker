import { ExchangeRates } from "../types";

interface ExchangeRateResponse {
  result: string;
  rates: Record<string, number>;
}

export async function fetchExchangeRates(): Promise<ExchangeRates> {
  const response = await fetch("https://open.er-api.com/v6/latest/USD");
  if (!response.ok) {
    throw new Error(`Exchange rate API error: ${response.status}`);
  }

  const data = (await response.json()) as ExchangeRateResponse;

  if (data.result !== "success") {
    throw new Error("Exchange rate API returned unsuccessful result");
  }

  const usdToBrl = data.rates["BRL"];
  const usdToEur = data.rates["EUR"];

  if (!usdToBrl || !usdToEur) {
    throw new Error("Exchange rate API missing BRL or EUR rates");
  }

  return {
    usdToBrl,
    eurToBrl: usdToBrl / usdToEur,
  };
}
