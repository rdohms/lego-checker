export function calculatePpp(price: number | null, pieces: number): number | null {
  if (price === null || pieces === 0) return null;
  return price / pieces;
}

export function convertToReal(value: number | null, rate: number): number | null {
  if (value === null) return null;
  return value * rate;
}

export function formatCurrency(value: number | null, symbol: string): string {
  if (value === null) return "—";
  return `${symbol}${value.toFixed(2)}`;
}

export function formatPpp(value: number | null, symbol: string): string {
  if (value === null) return "—";
  return `${symbol}${value.toFixed(3)}/pc`;
}

export function formatReal(value: number | null): string {
  if (value === null) return "—";
  return `R$${value.toFixed(2)}`;
}

export function formatRealPpp(value: number | null): string {
  if (value === null) return "—";
  return `R$${value.toFixed(3)}/pc`;
}
