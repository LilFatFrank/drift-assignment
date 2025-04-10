"use client";

import { useState } from "react";
import { useDriftStore } from "@/store/useDriftStore";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  getUserAccountPublicKey,
  OrderType,
  PositionDirection,
  OrderTriggerCondition,
  User,
} from "@drift-labs/sdk";
import { decodeSymbol } from "@/utils/format";

export default function PerpTPStopModal({ onClose }: { onClose: () => void }) {
  const driftClient = useDriftStore((s) => s.driftClient);
  const subaccounts = useDriftStore((s) => s.subaccounts);
  const { publicKey } = useWallet();

  const user = subaccounts.find((u) => u.getUserAccount().subAccountId === 0);
  const perpMarkets = Object.values(driftClient?.getPerpMarketAccounts() || {});

  const [selectedMarketIndex, setSelectedMarketIndex] = useState(
    perpMarkets[0]?.marketIndex || 0
  );
  const [side, setSide] = useState<"long" | "short">("long");
  const [triggerPrice, setTriggerPrice] = useState("");
  const [quoteAmount, setQuoteAmount] = useState("");
  const [type, setType] = useState<"tp" | "sl">("tp");
  const [postOnly, setPostOnly] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!driftClient || !user || !publicKey) return;
    try {
      setStatus("loading");

      const quote = parseFloat(quoteAmount);
      const price = parseFloat(triggerPrice);
      if (!quote || !price || quote <= 0 || price <= 0) {
        throw new Error("Invalid input");
      }

      const markPrice =
        driftClient.getOracleDataForPerpMarket(selectedMarketIndex).price.toNumber() / 1e6;

      const baseAmountUi = quote / markPrice;
      const baseAssetAmount = driftClient.convertToPerpPrecision(baseAmountUi);
      const nativeTriggerPrice = driftClient.convertToPricePrecision(price);

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
        const accountInfo = await driftClient.connection.getAccountInfo(userPda);
        if (!accountInfo) await driftClient.initializeUserAccount(subAccountId);
        await driftClient.addUser(subAccountId, authority);
        driftUser = driftClient.getUser(subAccountId, authority);
      }

      if (!driftUser.isSubscribed) await driftUser.subscribe();

      const direction = side === "long" ? PositionDirection.LONG : PositionDirection.SHORT;
      let triggerCondition: OrderTriggerCondition;

      if (side === "long" && type === "tp") triggerCondition = OrderTriggerCondition.ABOVE;
      else if (side === "long" && type === "sl") triggerCondition = OrderTriggerCondition.BELOW;
      else if (side === "short" && type === "tp") triggerCondition = OrderTriggerCondition.BELOW;
      else triggerCondition = OrderTriggerCondition.ABOVE;

      const orderParams = {
        orderType: OrderType.TRIGGER_LIMIT,
        marketIndex: selectedMarketIndex,
        direction,
        baseAssetAmount,
        price: nativeTriggerPrice,
        triggerPrice: nativeTriggerPrice,
        triggerCondition,
        postOnly,
        reduceOnly: true,
      } as const;

      await driftClient.placePerpOrder(orderParams);

      setStatus("done");
      setQuoteAmount("");
      setTriggerPrice("");
    } catch (err: any) {
      console.error("TP/SL Error:", err);
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
        <h3 className="text-xl font-semibold mb-4">Set Take Profit / Stop Loss</h3>

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

        <label className="block mb-2 text-sm font-medium">Position Side</label>
        <div className="flex gap-4 mb-4">
          <button
            className={`px-4 py-2 rounded ${side === "long" ? "bg-green-600 text-white" : "border"}`}
            onClick={() => setSide("long")}
          >
            Long
          </button>
          <button
            className={`px-4 py-2 rounded ${side === "short" ? "bg-red-600 text-white" : "border"}`}
            onClick={() => setSide("short")}
          >
            Short
          </button>
        </div>

        <label className="block mb-2 text-sm font-medium">Type</label>
        <div className="flex gap-4 mb-4">
          <button
            className={`px-4 py-2 rounded ${type === "tp" ? "bg-blue-600 text-white" : "border"}`}
            onClick={() => setType("tp")}
          >
            Take Profit
          </button>
          <button
            className={`px-4 py-2 rounded ${type === "sl" ? "bg-yellow-600 text-white" : "border"}`}
            onClick={() => setType("sl")}
          >
            Stop Loss
          </button>
        </div>

        <label className="block mb-2 text-sm font-medium">Trigger Price</label>
        <input
          type="number"
          className="w-full border p-2 rounded mb-4"
          placeholder="0.0"
          value={triggerPrice}
          onChange={(e) => setTriggerPrice(e.target.value)}
        />

        <label className="block mb-2 text-sm font-medium">Quote Amount (USDC)</label>
        <input
          type="number"
          className="w-full border p-2 rounded mb-4"
          placeholder="0.0"
          value={quoteAmount}
          onChange={(e) => setQuoteAmount(e.target.value)}
        />

        <label className="inline-flex items-center mb-4">
          <input
            type="checkbox"
            className="mr-2"
            checked={postOnly}
            onChange={(e) => setPostOnly(e.target.checked)}
          />
          Post Only
        </label>

        <button
          onClick={handleSubmit}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
          disabled={status === "loading"}
        >
          {status === "loading" ? "Placing..." : "Submit TP/SL Order"}
        </button>

        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        {status === "done" && (
          <p className="text-green-600 text-sm mt-2">
            TP/SL order placed successfully!
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
