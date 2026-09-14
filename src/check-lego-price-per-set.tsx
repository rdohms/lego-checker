import { Action, ActionPanel, Color, Detail, Form, Icon, Toast, getPreferenceValues, showToast } from "@raycast/api";
import { useState } from "react";
import { fetchExchangeRates } from "./api/exchange-rates";
import { fetchMarketPrices } from "./api/bricklink";
import { fetchRetailPrices } from "./api/brickset";
import { fetchSetMetadata } from "./api/rebrickable";
import { fetchShoppingPrices } from "./api/serpapi";
import { ExchangeRates, MarketPrices, Preferences, RetailPrices, SetMetadata, ShoppingPrices } from "./types";
import { calculatePpp } from "./utils/ppp";

interface DetailData {
  metadata: SetMetadata;
  retail: RetailPrices;
  market: MarketPrices;
  shopping: ShoppingPrices;
  rates: ExchangeRates | null;
}

type ViewState = { mode: "form" } | { mode: "loading" } | { mode: "detail"; data: DetailData };

interface PriceEntry {
  source: string;
  brlPrice: number;
  originalStr: string;
  pppBrl: number | null;
  pppOriginalStr: string;
  link?: string;
}

function normalizeSetNum(input: string): string {
  const trimmed = input.trim();
  return /^\d+-\d+$/.test(trimmed) ? trimmed : `${trimmed}-1`;
}

function fmt(value: number, decimals = 2): string {
  return value.toFixed(decimals);
}

function collectPriceEntries(data: DetailData): PriceEntry[] {
  const { metadata, retail, market, shopping, rates } = data;
  if (!rates) return [];

  const { usdToBrl, eurToBrl } = rates;
  const entries: PriceEntry[] = [];

  const addUsd = (source: string, usd: number, link?: string) => {
    const brl = usd * usdToBrl;
    const pppUsd = calculatePpp(usd, metadata.pieces);
    entries.push({
      source,
      brlPrice: brl,
      originalStr: `$${fmt(usd)}`,
      pppBrl: calculatePpp(brl, metadata.pieces),
      pppOriginalStr: pppUsd ? `$${fmt(pppUsd, 3)}/pc` : "—",
      link,
    });
  };

  const addEur = (source: string, eur: number, link?: string) => {
    const brl = eur * eurToBrl;
    const pppEur = calculatePpp(eur, metadata.pieces);
    entries.push({
      source,
      brlPrice: brl,
      originalStr: `€${fmt(eur)}`,
      pppBrl: calculatePpp(brl, metadata.pieces),
      pppOriginalStr: pppEur ? `€${fmt(pppEur, 3)}/pc` : "—",
      link,
    });
  };

  if (retail.usUsd) addUsd("LEGO US Store", retail.usUsd);
  if (retail.nlEur) addEur("LEGO NL Store", retail.nlEur);

  for (const r of shopping.us) {
    if (r.currency === "EUR") addEur(r.store, r.price, r.link);
    else addUsd(r.store, r.price, r.link);
  }
  for (const r of shopping.nl) {
    if (r.currency === "EUR") addEur(r.store, r.price, r.link);
    else addUsd(r.store, r.price, r.link);
  }

  if (market.newAvgUsd) addUsd("BrickLink (new)", market.newAvgUsd);
  if (market.usedAvgUsd) addUsd("BrickLink (used)", market.usedAvgUsd);

  return entries.sort((a, b) => a.brlPrice - b.brlPrice);
}

function buildMarkdown(metadata: SetMetadata): string {
  return [
    `![${metadata.name}](${metadata.imageUrl})`,
    "",
    `# ${metadata.setNum} — ${metadata.name}`,
    `**Pieces:** ${metadata.pieces.toLocaleString()} | **Year:** ${metadata.year}`,
  ].join("\n");
}

function priceText(brl: number, originalStr: string, pppBrl: number | null, pppOriginalStr: string): string {
  const pppPart = pppBrl ? `R$${fmt(pppBrl, 3)}/pc` : "—";
  return `R$${fmt(brl)}  ·  ${originalStr} (${pppOriginalStr} / ${pppPart})`;
}

function PriceLabel({
  title,
  brl,
  originalStr,
  pppBrl,
  pppOriginalStr,
  isCheapest,
}: {
  title: string;
  brl: number;
  originalStr: string;
  pppBrl: number | null;
  pppOriginalStr: string;
  isCheapest: boolean;
}) {
  const text = priceText(brl, originalStr, pppBrl, pppOriginalStr);
  return (
    <Detail.Metadata.Label
      title={isCheapest ? `🏆 ${title}` : title}
      text={isCheapest ? { value: text, color: Color.Green } : text}
    />
  );
}

function buildMetadata(data: DetailData) {
  const { retail, market, shopping, rates } = data;
  const entries = collectPriceEntries(data);
  const cheapest = entries[0] ?? null;

  const isCheapest = (source: string, brl: number) =>
    cheapest !== null && cheapest.source === source && Math.abs(cheapest.brlPrice - brl) < 0.01;

  const usdToBrl = rates?.usdToBrl ?? null;
  const eurToBrl = rates?.eurToBrl ?? null;

  const brlFromUsd = (usd: number | null) => (usd !== null && usdToBrl ? usd * usdToBrl : null);
  const brlFromEur = (eur: number | null) => (eur !== null && eurToBrl ? eur * eurToBrl : null);

  const hasOfficialPrices = retail.usUsd !== null || retail.nlEur !== null;
  const hasRetailers = shopping.us.length > 0 || shopping.nl.length > 0;
  const hasMarket = market.newAvgUsd !== null || market.usedAvgUsd !== null;

  return (
    <Detail.Metadata>
      {cheapest && (
        <>
          <Detail.Metadata.TagList title="Best Price">
            <Detail.Metadata.TagList.Item
              text={`R$${fmt(cheapest.brlPrice)} — ${cheapest.source}`}
              color={Color.Green}
              icon={Icon.Star}
            />
          </Detail.Metadata.TagList>
          <Detail.Metadata.Label
            title="PPP (BRL)"
            text={{ value: cheapest.pppBrl ? `R$${fmt(cheapest.pppBrl, 3)}/pc` : "—", color: Color.Green }}
          />
          <Detail.Metadata.Label
            title="Original"
            text={{ value: `${cheapest.originalStr}  ·  ${cheapest.pppOriginalStr}`, color: Color.Green }}
          />
          {cheapest.link && <Detail.Metadata.Link title="Open" target={cheapest.link} text="View listing →" />}
          <Detail.Metadata.Separator />
        </>
      )}

      {hasOfficialPrices && (
        <>
          <Detail.Metadata.Label title="LEGO Official Store" text="" />
          {retail.usUsd !== null &&
            (() => {
              const brl = brlFromUsd(retail.usUsd)!;
              const pppUsd = calculatePpp(retail.usUsd, data.metadata.pieces);
              const pppBrl = calculatePpp(brl, data.metadata.pieces);
              return (
                <PriceLabel
                  title="🇺🇸 US"
                  brl={brl}
                  originalStr={`$${fmt(retail.usUsd)}`}
                  pppBrl={pppBrl}
                  pppOriginalStr={pppUsd ? `$${fmt(pppUsd, 3)}/pc` : "—"}
                  isCheapest={isCheapest("LEGO US Store", brl)}
                />
              );
            })()}
          {retail.nlEur !== null &&
            (() => {
              const brl = brlFromEur(retail.nlEur)!;
              const pppEur = calculatePpp(retail.nlEur, data.metadata.pieces);
              const pppBrl = calculatePpp(brl, data.metadata.pieces);
              return (
                <PriceLabel
                  title="🇳🇱 NL"
                  brl={brl}
                  originalStr={`€${fmt(retail.nlEur)}`}
                  pppBrl={pppBrl}
                  pppOriginalStr={pppEur ? `€${fmt(pppEur, 3)}/pc` : "—"}
                  isCheapest={isCheapest("LEGO NL Store", brl)}
                />
              );
            })()}
          <Detail.Metadata.Separator />
        </>
      )}

      {shopping.exhausted && (
        <>
          <Detail.Metadata.Label
            title="Online Retailers"
            text={{ value: "SerpApi free tier exhausted", color: Color.Orange }}
          />
          <Detail.Metadata.Separator />
        </>
      )}

      {!shopping.exhausted && hasRetailers && (
        <>
          {shopping.us.length > 0 && <Detail.Metadata.Label title="🛍️ Retailers — US" text="" />}
          {shopping.us.map((r, i) => {
            const brl = r.currency === "EUR" ? brlFromEur(r.price) : brlFromUsd(r.price);
            if (!brl) return null;
            const ppp = calculatePpp(r.price, data.metadata.pieces);
            const pppBrl = calculatePpp(brl, data.metadata.pieces);
            const symbol = r.currency === "EUR" ? "€" : "$";
            return (
              <PriceLabel
                key={`us-${i}-${r.store}`}
                title={r.store}
                brl={brl}
                originalStr={`${symbol}${fmt(r.price)}`}
                pppBrl={pppBrl}
                pppOriginalStr={ppp ? `${symbol}${fmt(ppp, 3)}/pc` : "—"}
                isCheapest={isCheapest(r.store, brl)}
              />
            );
          })}
          {shopping.nl.length > 0 && <Detail.Metadata.Label title="🛍️ Retailers — NL" text="" />}
          {shopping.nl.map((r, i) => {
            const brl = r.currency === "EUR" ? brlFromEur(r.price) : brlFromUsd(r.price);
            if (!brl) return null;
            const ppp = calculatePpp(r.price, data.metadata.pieces);
            const pppBrl = calculatePpp(brl, data.metadata.pieces);
            const symbol = r.currency === "EUR" ? "€" : "$";
            return (
              <PriceLabel
                key={`nl-${i}-${r.store}`}
                title={r.store}
                brl={brl}
                originalStr={`${symbol}${fmt(r.price)}`}
                pppBrl={pppBrl}
                pppOriginalStr={ppp ? `${symbol}${fmt(ppp, 3)}/pc` : "—"}
                isCheapest={isCheapest(r.store, brl)}
              />
            );
          })}
          <Detail.Metadata.Separator />
        </>
      )}

      {hasMarket && (
        <>
          <Detail.Metadata.Label title="📦 BrickLink Market" text="" />
          {market.newAvgUsd !== null &&
            (() => {
              const brl = brlFromUsd(market.newAvgUsd)!;
              const pppUsd = calculatePpp(market.newAvgUsd, data.metadata.pieces);
              const pppBrl = calculatePpp(brl, data.metadata.pieces);
              return (
                <PriceLabel
                  title="New (avg sold)"
                  brl={brl}
                  originalStr={`$${fmt(market.newAvgUsd)}`}
                  pppBrl={pppBrl}
                  pppOriginalStr={pppUsd ? `$${fmt(pppUsd, 3)}/pc` : "—"}
                  isCheapest={isCheapest("BrickLink (new)", brl)}
                />
              );
            })()}
          {market.usedAvgUsd !== null &&
            (() => {
              const brl = brlFromUsd(market.usedAvgUsd)!;
              const pppUsd = calculatePpp(market.usedAvgUsd, data.metadata.pieces);
              const pppBrl = calculatePpp(brl, data.metadata.pieces);
              return (
                <PriceLabel
                  title="Used (avg sold)"
                  brl={brl}
                  originalStr={`$${fmt(market.usedAvgUsd)}`}
                  pppBrl={pppBrl}
                  pppOriginalStr={pppUsd ? `$${fmt(pppUsd, 3)}/pc` : "—"}
                  isCheapest={isCheapest("BrickLink (used)", brl)}
                />
              );
            })()}
          <Detail.Metadata.Separator />
        </>
      )}

      {rates && (
        <>
          <Detail.Metadata.Label title="💱 1 USD" text={`R$${fmt(rates.usdToBrl)}`} />
          <Detail.Metadata.Label title="💱 1 EUR" text={`R$${fmt(rates.eurToBrl)}`} />
        </>
      )}
    </Detail.Metadata>
  );
}

export default function Command() {
  const prefs = getPreferenceValues<Preferences>();
  const [state, setState] = useState<ViewState>({ mode: "form" });

  async function handleSubmit(values: { setNum: string }) {
    if (!values.setNum.trim()) return;

    const setNum = normalizeSetNum(values.setNum);
    setState({ mode: "loading" });

    const toast = await showToast({ style: Toast.Style.Animated, title: `Fetching prices for ${setNum}…` });

    const [metadataResult, retailResult, marketResult, shoppingResult, ratesResult] = await Promise.allSettled([
      fetchSetMetadata(setNum, prefs.rebrickableApiKey),
      fetchRetailPrices(setNum, prefs.bricksetApiKey),
      fetchMarketPrices(setNum, prefs),
      fetchShoppingPrices(`LEGO ${setNum}`, prefs.serpapiKey),
      fetchExchangeRates(),
    ]);

    if (metadataResult.status === "rejected") {
      await toast.hide();
      await showToast({
        style: Toast.Style.Failure,
        title: "Set not found",
        message: metadataResult.reason instanceof Error ? metadataResult.reason.message : String(metadataResult.reason),
      });
      setState({ mode: "form" });
      return;
    }

    await toast.hide();

    setState({
      mode: "detail",
      data: {
        metadata: metadataResult.value,
        retail: retailResult.status === "fulfilled" ? retailResult.value : { usUsd: null, nlEur: null },
        market: marketResult.status === "fulfilled" ? marketResult.value : { newAvgUsd: null, usedAvgUsd: null },
        shopping: shoppingResult.status === "fulfilled" ? shoppingResult.value : { us: [], nl: [], exhausted: false },
        rates: ratesResult.status === "fulfilled" ? ratesResult.value : null,
      },
    });
  }

  if (state.mode === "form" || state.mode === "loading") {
    return (
      <Form
        isLoading={state.mode === "loading"}
        actions={
          <ActionPanel>
            <Action.SubmitForm title="Check Prices" onSubmit={handleSubmit} />
          </ActionPanel>
        }
      >
        <Form.TextField
          id="setNum"
          title="Set Number"
          placeholder="42151"
          info="Enter the LEGO set number (e.g. 42151)"
          autoFocus
        />
      </Form>
    );
  }

  const { data } = state;
  const cheapest = collectPriceEntries(data)[0] ?? null;

  return (
    <Detail
      navigationTitle={data.metadata.name}
      markdown={buildMarkdown(data.metadata)}
      metadata={buildMetadata(data)}
      actions={
        <ActionPanel>
          {cheapest?.link && (
            <Action.OpenInBrowser title={`Open ${cheapest.source}`} url={cheapest.link} icon={Icon.Globe} />
          )}
          <Action.OpenInBrowser
            title="Open on Rebrickable"
            url={`https://rebrickable.com/sets/${data.metadata.setNum}/`}
            icon={Icon.Globe}
          />
        </ActionPanel>
      }
    />
  );
}
