"use client";

import { useState } from "react";
import { useDriftStore } from "@/store/useDriftStore";
import { useWallet } from "@solana/wallet-adapter-react";
import { BN } from "@coral-xyz/anchor";
import { convertToNative, decodeSymbol } from "@/utils/format";
import {
  getUserAccountPublicKey,
  User,
  OrderType,
  PositionDirection,
} from "@drift-labs/sdk";

type Props = {
  onClose: () => void;
};

export default function PerpMarketOrderModal({ onClose }: Props) {
  const driftClient = useDriftStore((s) => s.driftClient);
  const subaccounts = useDriftStore((s) => s.subaccounts);
  const { publicKey } = useWallet();

  const user = subaccounts.find((u) => u.getUserAccount().subAccountId === 0);
  const perpMarkets = Object.values(driftClient?.getPerpMarketAccounts() || {});
  const [selectedMarketIndex, setSelectedMarketIndex] = useState(
    perpMarkets[0]?.marketIndex || 0
  );
  const [markPrice, setMarkPrice] = useState(0);
  const [side, setSide] = useState<"long" | "short">("long");
  const [quoteAmount, setQuoteAmount] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!driftClient || !user || !publicKey) return;

    try {
      setStatus("loading");

      const quote = parseFloat(quoteAmount);
      if (!quote || quote <= 0) {
        throw new Error("Invalid quote amount");
      }

      const market = driftClient.getPerpMarketAccount(selectedMarketIndex);

      const markPrice =
        driftClient
          .getOracleDataForPerpMarket(market?.marketIndex ?? 0)
          .price.toNumber() / 1e6;
      setMarkPrice(markPrice);
      const baseAmountUi = quote / markPrice;

      const baseAssetAmount = driftClient.convertToPerpPrecision(baseAmountUi);

      const authority = publicKey;
      const subAccountId = user.getUserAccount().subAccountId;

      let driftUser: User;

      try {
        driftUser = driftClient.getUser(subAccountId, authority);
      } catch {
        const userPda = await getUserAccountPublicKey(
          driftClient.program.programId,
          authority,
          subAccountId
        );
        const accountInfo = await driftClient.connection.getAccountInfo(
          userPda
        );

        if (!accountInfo) {
          await driftClient.initializeUserAccount(subAccountId);
        }

        await driftClient.addUser(subAccountId, authority);
        driftUser = driftClient.getUser(subAccountId, authority);
      }

      if (!driftUser.isSubscribed) {
        await driftUser.subscribe();
      }

      const orderParams = {
        orderType: OrderType.MARKET,
        marketIndex: selectedMarketIndex,
        direction:
          side === "long" ? PositionDirection.LONG : PositionDirection.SHORT,
        baseAssetAmount: baseAssetAmount,
        reduceOnly: false,
      };

      await driftClient.placePerpOrder(orderParams);

      setStatus("done");
      setQuoteAmount("");
    } catch (err: any) {
      console.error("Market Order Error:", err);
      setError(err.message || "Transaction failed");
      setStatus("error");
    } finally {
      setTimeout(() => {
        setStatus("idle");
        onClose();
      }, 2000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white w-full max-w-md p-6 rounded-xl shadow-xl relative">
        <h3 className="text-xl font-semibold mb-4">Place Market Order</h3>

        <label className="block mb-2 text-sm font-medium">Perp Market</label>
        <select
          className="w-full border p-2 rounded mb-4"
          value={selectedMarketIndex}
          onChange={(e) => setSelectedMarketIndex(Number(e.target.value))}
        >
          {perpMarkets.map((m) => (
            <option key={m.marketIndex} value={m.marketIndex}>
              {m.name ? decodeSymbol(m.name) : `Market ${m.marketIndex}`}
            </option>
          ))}
        </select>

        <label className="block mb-2 text-sm font-medium">Side</label>
        <div className="flex gap-4 mb-4">
          <button
            className={`px-4 py-2 rounded ${
              side === "long" ? "bg-green-600 text-white" : "border"
            }`}
            onClick={() => setSide("long")}
          >
            Long
          </button>
          <button
            className={`px-4 py-2 rounded ${
              side === "short" ? "bg-red-600 text-white" : "border"
            }`}
            onClick={() => setSide("short")}
          >
            Short
          </button>
        </div>

        <label className="block mb-2 text-sm font-medium">
          Quote Amount (USDC)
        </label>
        <input
          type="number"
          className="w-full border p-2 rounded mb-4"
          placeholder="0.0"
          value={quoteAmount}
          onChange={(e) => setQuoteAmount(e.target.value)}
        />

        {quoteAmount && markPrice ? (
          <div className="text-sm mb-4">
            <p>
              <strong>Estimated Position Size:</strong>{" "}
              {(parseFloat(quoteAmount) / markPrice).toFixed(4)} base units
            </p>
            <p>
              <strong>Estimated Leverage:</strong>{" "}
              {(
                parseFloat(quoteAmount) / user?.getTotalCollateral().toNumber()
              ).toFixed(2)}
              x
            </p>
          </div>
        ) : null}

        <button
          onClick={handleSubmit}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
          disabled={status === "loading"}
        >
          {status === "loading" ? "Placing..." : "Submit Market Order"}
        </button>

        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        {status === "done" && (
          <p className="text-green-600 text-sm mt-2">
            Order placed successfully!
          </p>
        )}

        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-500"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
