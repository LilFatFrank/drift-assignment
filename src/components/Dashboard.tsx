"use client";

import { useDriftInit } from "@/hooks/useDriftInit";
import { useDriftStore } from "@/store/useDriftStore";
import { convertToNumber, convertToUiDecimals } from "@/utils/format";
import { getSubaccountRisk } from "@/utils/getSubAccountRisk";
import { calculateEntryPrice } from "@drift-labs/sdk";
import { getSpotBalances } from "@/utils/getSpotBalances";

export default function Dashboard() {
  const { loading, error } = useDriftInit();
  const subaccounts = useDriftStore((s) => s.subaccounts);
  const driftClient = useDriftStore((s) => s.driftClient);

  if (loading) return <p>Loading Drift data...</p>;
  if (error) return <p className="text-red-500">Error: {error}</p>;
  if (!subaccounts.length) return <p>No subaccounts found.</p>;
  if (!driftClient) return <p>Drift client not initialized.</p>;

  return (
    <div className="grid grid-cols-1 gap-4 p-4">
      {subaccounts.map((user, i) => {
        const positions = user.getActivePerpPositions();
        const risk = getSubaccountRisk(user);
        const spotBalances = getSpotBalances(user, driftClient);

        return (
          <div key={i} className="border p-4 rounded-xl shadow bg-white">
            <h2 className="font-semibold text-lg">Subaccount {i}</h2>
            <p>
              Collateral: $
              {convertToUiDecimals(user.getTotalCollateral(), 6).toFixed(2)}
            </p>
            <p>Perp Positions: {positions.length}</p>

            <hr className="my-2" />

            <p>
              <strong>Leverage:</strong> {risk.leverage.toFixed(2)}x
            </p>
            <p>
              <strong>Margin Ratio:</strong> {risk.marginRatio.toFixed(2)}%
            </p>
            <p>
              <strong>Free Collateral:</strong> $
              {risk.freeCollateral.toFixed(2)}
            </p>
            <p>
              <strong>Liquidatable:</strong>{" "}
              {risk.canBeLiquidated ? "Yes" : "No"}
            </p>

            {spotBalances.length > 0 && (
              <div className="mt-4">
                <h4 className="font-semibold">Spot Balances</h4>
                <ul className="text-sm mt-1 space-y-1">
                  {spotBalances.map((bal) => (
                    <li key={bal.marketIndex}>
                      {bal.symbol}: {bal.amount.toFixed(4)}{" "}
                      {bal.isBorrow ? "(Borrow)" : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {positions.length > 0 && (
              <div className="mt-4 space-y-2">
                <h4 className="font-semibold">Perp Positions</h4>
                {positions.map((pos) => {
                  const baseSize = convertToNumber(
                    pos.baseAssetAmount.abs(),
                    9
                  );
                  const side = pos.baseAssetAmount.gtn(0) ? "Long" : "Short";
                  const entry = convertToNumber(calculateEntryPrice(pos), 6);
                  const pnl = convertToNumber(
                    user.getUnrealizedPNL(),
                    6
                  );

                  return (
                    <div key={pos.marketIndex} className="text-sm">
                      <p>Market Index: {pos.marketIndex}</p>
                      <p>Side: {side}</p>
                      <p>Size: {baseSize}</p>
                      <p>Entry Price: ${entry}</p>
                      <p>Unrealized PnL: ${pnl}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
