import { BN } from "@coral-xyz/anchor";

export function convertToNative(amount: number, decimals: number): BN {
  return new BN(Math.round(amount * 10 ** decimals));
}

export function formatNumber(value: number | string, decimals = 2): string {
  const num = typeof value === "string" ? parseFloat(value) : value;

  if (isNaN(num)) return "0";

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(num);
}

export function convertToNumber(value: any, decimals = 6): string {
  if (!value) return "0";

  const num =
    typeof value === "string"
      ? parseFloat(value)
      : typeof value === "object" && value.toString
      ? parseFloat(value.toString())
      : parseFloat(value);

  if (isNaN(num)) return "0";

  const adjustedValue = num / Math.pow(10, decimals);
  return formatNumber(adjustedValue, decimals);
}

export function convertToUiDecimals(value: BN, decimals: number): number {
  return value.toNumber() / Math.pow(10, decimals);
}

export function decodeSymbol(bytes: number[] | Uint8Array): string {
  return new TextDecoder()
    .decode(Uint8Array.from(bytes))
    .replace(/\0/g, "")
    .replace(/\s+$/g, "")
    .trim();
}
