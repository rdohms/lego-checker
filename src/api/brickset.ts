import { RetailPrices } from "../types";

interface BricksetRetailPrice {
  retailPrice: number;
  dateFirstAvailable: string;
  dateLastAvailable: string;
}

interface BricksetSet {
  LEGOCom: {
    US?: BricksetRetailPrice;
    DE?: BricksetRetailPrice;
  };
}

interface BricksetResponse {
  status: string;
  message?: string;
  sets: BricksetSet[];
}

export async function fetchRetailPrices(setNum: string, apiKey: string | undefined): Promise<RetailPrices> {
  if (!apiKey) {
    return { usUsd: null, nlEur: null };
  }
  const params = JSON.stringify({ setNumber: setNum, pageSize: 1 });
  const url = `https://brickset.com/api/v3.asmx/getSets?apiKey=${encodeURIComponent(apiKey)}&userHash=&params=${encodeURIComponent(params)}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Brickset API error: ${response.status}`);
  }

  const data = (await response.json()) as BricksetResponse;

  if (data.status !== "success") {
    throw new Error(`Brickset API error: ${data.message ?? "unknown error"}`);
  }

  if (!data.sets.length) {
    throw new Error(`Set ${setNum} not found on Brickset`);
  }

  const legocom = data.sets[0].LEGOCom;

  return {
    usUsd: legocom.US?.retailPrice ?? null,
    nlEur: legocom.DE?.retailPrice ?? null,
  };
}
