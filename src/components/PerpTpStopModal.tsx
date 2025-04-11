"use client";

import { useState, useEffect } from "react";
import { useDriftStore } from "@/store/useDriftStore";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  getUserAccountPublicKey,
  OrderType,
  PositionDirection,
  OrderTriggerCondition,
  User,
  BN,
} from "@drift-labs/sdk";
import { decodeSymbol } from "@/utils/format";

export default function PerpTPStopModal({ onClose }: { onClose: () => void }) {
  const driftClient = useDriftStore((s) => s.driftClient);
  const subaccounts = useDriftStore((s) => s.subaccounts);
  const activeSubaccountId = useDriftStore((s) => s.activeSubaccountId);
  const { publicKey } = useWallet();

  // Get the active subaccount or fall back to the first one
  const user = activeSubaccountId !== null 
    ? subaccounts.find((u) => u.getUserAccount().subAccountId === activeSubaccountId)
    : subaccounts.find((u) => u.getUserAccount().subAccountId === 0);
    
  const perpMarkets = Object.values(driftClient?.getPerpMarketAccounts() || {});

  // Find markets with open positions
  const marketsWithPositions = user ? 
    perpMarkets.filter(market => {
      const position = user.getPerpPosition(market.marketIndex);
      return position && !position.baseAssetAmount.isZero();
    }) : [];

  // Default to the first market with a position, or the first market if none have positions
  const [selectedMarketIndex, setSelectedMarketIndex] = useState(
    marketsWithPositions.length > 0 ? marketsWithPositions[0].marketIndex : (perpMarkets[0]?.marketIndex || 0)
  );
  
  const [triggerPrice, setTriggerPrice] = useState("");
  const [sizeType, setSizeType] = useState<"percentage" | "exact">("percentage");
  const [sizeValue, setSizeValue] = useState("100"); // Default to 100% of position
  const [type, setType] = useState<"tp" | "sl">("tp");
  const [postOnly, setPostOnly] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  // Get current position for the selected market
  const currentPosition = user?.getPerpPosition(selectedMarketIndex);
  const isLong = currentPosition?.baseAssetAmount.gt(0) || false;
  const positionSize = currentPosition ? Math.abs(currentPosition.baseAssetAmount.toNumber() / 1e9) : 0;
  
  // Get market name safely
  const selectedMarket = perpMarkets.find(m => m.marketIndex === selectedMarketIndex);
  const marketName = selectedMarket?.name ? decodeSymbol(selectedMarket.name) : `Market ${selectedMarketIndex}`;

  // If no markets with positions, show a message and close button
  if (marketsWithPositions.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
        <div className="bg-white w-full max-w-md p-6 rounded-xl shadow-xl relative">
          <h3 className="text-xl font-semibold mb-4">Set Take Profit / Stop Loss</h3>
          <div className="mb-4 p-2 bg-yellow-100 rounded">
            <p className="text-sm text-yellow-800">
              <strong>No Open Positions:</strong> You don't have any open positions to set TP/SL for.
            </p>
          </div>
          <p className="mb-4">Please open a position first before setting Take Profit or Stop Loss.</p>
          <button
            onClick={onClose}
            className="w-full bg-gray-300 text-gray-800 py-2 rounded hover:bg-gray-400"
          >
            Close
          </button>
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

  const handleSubmit = async () => {
    if (!driftClient || !user || !publicKey) return;
    try {
      setStatus("loading");

      const price = parseFloat(triggerPrice);
      if (!price || price <= 0) {
        throw new Error("Invalid trigger price");
      }

      // Get current position and its orders
      const position = user.getPerpPosition(selectedMarketIndex);
      if (!position) {
        throw new Error("No position found for this market");
      }
      
      const isLong = position.baseAssetAmount.gt(0);
      const currentSize = Math.abs(position.baseAssetAmount.toNumber());
      
      // Get the original order that opened this position
      const openOrders = user.getOpenOrders();
      const positionOrder = openOrders.find(order => 
        order.marketIndex === selectedMarketIndex && 
        !order.reduceOnly
      );
      
      // Determine if we should use TRIGGER_LIMIT based on original order
      const shouldUseTriggerLimit = positionOrder?.orderType === OrderType.LIMIT;
      
      // Calculate base asset amount based on size type
      let baseAssetAmount: BN;
      if (sizeType === "percentage") {
        const percentage = parseFloat(sizeValue) / 100;
        if (percentage <= 0 || percentage > 1) {
          throw new Error("Percentage must be between 0 and 100");
        }
        // Calculate the size in base asset units
        const sizeInBaseAsset = currentSize * percentage;
        // Use convertToPerpPrecision to get the correct BN
        baseAssetAmount = driftClient.convertToPerpPrecision(sizeInBaseAsset);
      } else {
        // Exact size in base asset terms
        const exactSize = parseFloat(sizeValue);
        if (exactSize <= 0) {
          throw new Error("Size must be greater than 0");
        }
        // Use convertToPerpPrecision to get the correct BN
        baseAssetAmount = driftClient.convertToPerpPrecision(exactSize);
        
        // Ensure we're not trying to close more than we have
        if (baseAssetAmount.toNumber() > currentSize) {
          baseAssetAmount = new BN(currentSize);
        }
      }
      
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
      
      // For TP/SL, we want to close the position, so direction should be opposite of current position
      const direction = isLong ? PositionDirection.SHORT : PositionDirection.LONG;
      
      // Set trigger condition based on TP/SL type and current position
      let triggerCondition: OrderTriggerCondition;
      if (type === "tp") {
        // For take profit, trigger when price moves in our favor
        triggerCondition = isLong ? OrderTriggerCondition.ABOVE : OrderTriggerCondition.BELOW;
      } else {
        // For stop loss, trigger when price moves against us
        triggerCondition = isLong ? OrderTriggerCondition.BELOW : OrderTriggerCondition.ABOVE;
      }

      const orderParams = {
        orderType: shouldUseTriggerLimit ? OrderType.TRIGGER_LIMIT : OrderType.TRIGGER_MARKET,
        marketIndex: selectedMarketIndex,
        direction,
        baseAssetAmount: baseAssetAmount,
        triggerPrice: nativeTriggerPrice,
        price: shouldUseTriggerLimit ? nativeTriggerPrice : undefined, // Set limit price if using TRIGGER_LIMIT
        triggerCondition,
        reduceOnly: true,
        ...(shouldUseTriggerLimit ? { triggerLimit: {} } : { triggerMarket: {} }),
      };

      await driftClient.placePerpOrder(orderParams);
      
      // Update user's orders
      await user.fetchAccounts();
      
      setStatus("done");
      setSizeValue("100");
      setTriggerPrice("");
      
      // Only close modal on success after a delay
      setTimeout(() => {
        setStatus("idle");
        onClose();
      }, 2000);
    } catch (err: any) {
      console.error("TP/SL Error:", err);
      setError(err.message || "Transaction failed");
      setStatus("error");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white w-full max-w-md p-6 rounded-xl shadow-xl relative">
        <h3 className="text-xl font-semibold mb-4">Set Take Profit / Stop Loss</h3>

        <div className="mb-4 p-2 bg-gray-100 rounded">
          <p className="text-sm">
            <strong>Current Position:</strong> {positionSize.toFixed(4)} {marketName} ({isLong ? "Long" : "Short"})
          </p>
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

        <label className="block mb-2 text-sm font-medium">Size Type</label>
        <div className="flex gap-4 mb-2">
          <button
            className={`px-4 py-2 rounded ${sizeType === "percentage" ? "bg-blue-600 text-white" : "border"}`}
            onClick={() => setSizeType("percentage")}
          >
            Percentage
          </button>
          <button
            className={`px-4 py-2 rounded ${sizeType === "exact" ? "bg-blue-600 text-white" : "border"}`}
            onClick={() => setSizeType("exact")}
          >
            Exact Size
          </button>
        </div>

        <label className="block mb-2 text-sm font-medium">
          {sizeType === "percentage" ? "Percentage of Position" : `Size in ${marketName}`}
        </label>
        <input
          type="number"
          className="w-full border p-2 rounded mb-4"
          placeholder={sizeType === "percentage" ? "100" : "0.01"}
          value={sizeValue}
          onChange={(e) => setSizeValue(e.target.value)}
        />
        {sizeType === "percentage" && (
          <p className="text-xs text-gray-500 mb-4">
            Enter a value between 1 and 100 to specify what percentage of your position to close
          </p>
        )}
        {sizeType === "exact" && (
          <p className="text-xs text-gray-500 mb-4">
            Enter the exact size in {marketName} to close (max: {positionSize.toFixed(4)})
          </p>
        )}

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
