import { convertToUiDecimals, decodeSymbol } from "./format";
import type { User, DriftClient } from "@drift-labs/sdk";

export function getSpotBalances(user: User, driftClient: DriftClient) {
  const spotMarkets = driftClient.getSpotMarketAccounts();
  const positions = user.getUserAccount().spotPositions;

  return positions
    .filter((pos) => !pos.scaledBalance.eqn(0))
    .map((pos) => {
      const marketIndex = pos.marketIndex;
      const market = spotMarkets[marketIndex];
      const symbol = market?.name
        ? decodeSymbol(market.name)
        : `Token ${marketIndex}`;
      const decimals = market?.decimals || 6;

      const isBorrow = pos.scaledBalance.ltn(0);
      const amount = convertToUiDecimals(pos.scaledBalance.abs(), decimals);

      return {
        marketIndex,
        symbol,
        amount,
        isBorrow,
      };
    });
}

export function getAllSpotMarkets(driftClient: DriftClient) {
  const spotMarkets = driftClient.getSpotMarketAccounts();

  return Object.values(spotMarkets).map((market) => {
    const symbol = decodeSymbol(market.name);

    return {
      marketIndex: market.marketIndex,
      symbol,
      mint: market.mint.toBase58(),
    };
  });
}
