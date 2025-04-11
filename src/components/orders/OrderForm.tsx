"use client";

import { useOrderForm } from "@/hooks/useOrderForm";
import { useDriftStore } from "@/store/useDriftStore";
import { decodeSymbol } from "@/utils/format";
import { useState } from "react";
import Link from "next/link";

interface Props {
  isLimit: boolean;
  onClose: () => void;
}

export function OrderForm({ isLimit, onClose }: Props) {
  const [state, actions] = useOrderForm(isLimit, onClose);
  const driftClient = useDriftStore((s) => s.driftClient);
  const subaccounts = useDriftStore((s) => s.subaccounts);
  const activeSubaccountId = useDriftStore((s) => s.activeSubaccountId);
  
  // Get the active subaccount or fall back to the first one
  const user = activeSubaccountId !== null 
    ? subaccounts.find((u) => u.getUserAccount().subAccountId === activeSubaccountId)
    : subaccounts.find((u) => u.getUserAccount().subAccountId === 0);
    
  const perpMarkets = Object.values(driftClient?.getPerpMarketAccounts() || {});
  const [showConfirmation, setShowConfirmation] = useState(false);

  const estimatedSize = state.quoteAmount && (isLimit ? state.limitPrice : state.markPrice)
    ? (parseFloat(state.quoteAmount) / (isLimit ? parseFloat(state.limitPrice) : state.markPrice)).toFixed(4)
    : null;

  // Calculate current leverage - handle BN return value from getLeverage()
  let currentLeverage = "0.00";
  if (user) {
    const leverageBN = user.getLeverage();
    // Convert BN to number and format
    currentLeverage = leverageBN.toNumber().toFixed(2);
  }

  // Calculate estimated new leverage if we have position data
  const currentPosition = user?.getPerpPosition(state.selectedMarketIndex);
  const currentPositionSize = currentPosition?.baseAssetAmount.toString() || "0";
  
  // Get oracle price for leverage calculation
  const oraclePrice = driftClient?.getOracleDataForPerpMarket(state.selectedMarketIndex)?.price.toNumber() / 1e6 || 0;
  
  // Calculate estimated new leverage based on current position and new order
  let estimatedNewLeverage = "0.00";
  if (user && estimatedSize && oraclePrice) {
    const currentPositionValue = parseFloat(currentPositionSize) * oraclePrice;
    const newPositionValue = parseFloat(estimatedSize) * oraclePrice;
    const totalPositionValue = currentPositionValue + newPositionValue;
    const totalCollateral = user.getTotalCollateral().toNumber() / 1e6;
    
    if (totalCollateral > 0) {
      estimatedNewLeverage = (totalPositionValue / totalCollateral).toFixed(2);
    }
  }

  const handleSubmitClick = () => {
    if (!state.quoteAmount || (isLimit && !state.limitPrice)) {
      return;
    }
    if (!user) {
      actions.handleSubmit();
      return;
    }
    setShowConfirmation(true);
  };

  const handleConfirmOrder = () => {
    if (!user) {
      actions.handleSubmit();
      return;
    }
    actions.handleSubmit();
    setShowConfirmation(false);
  };

  const handleCancelOrder = () => {
    setShowConfirmation(false);
  };

  // Add a link to manage subaccounts when no subaccount is selected
  const renderSubaccountWarning = () => (
    <div className="mb-4 p-2 bg-red-100 rounded">
      <p className="text-sm text-red-800">
        <strong>Warning:</strong> No active subaccount selected. Please select a subaccount before placing orders.
      </p>
      <Link 
        href="/subaccounts" 
        className="text-blue-600 hover:text-blue-800 text-sm mt-2 inline-block"
      >
        Manage Subaccounts
      </Link>
    </div>
  );

  if (showConfirmation) {
    if (!user) {
      return renderSubaccountWarning();
    }
    const selectedMarket = perpMarkets.find(m => m.marketIndex === state.selectedMarketIndex);
    const marketName = selectedMarket?.name ? decodeSymbol(selectedMarket.name) : `Market ${state.selectedMarketIndex}`;
    
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
        <div className="bg-white w-full max-w-md p-6 rounded-xl shadow-xl relative">
          <h3 className="text-xl font-semibold mb-4">Confirm Order</h3>
          
          <div className="mb-4">
            <p><strong>Market:</strong> {marketName}</p>
            <p><strong>Side:</strong> {state.side === "long" ? "Long" : "Short"}</p>
            <p><strong>Quote Amount:</strong> {state.quoteAmount} USDC</p>
            {isLimit && <p><strong>Limit Price:</strong> {state.limitPrice}</p>}
            {isLimit && <p><strong>Post Only:</strong> {state.postOnly ? "Yes" : "No"}</p>}
            {estimatedSize && <p><strong>Estimated Position Size:</strong> {estimatedSize} base units</p>}
            {user && (
              <>
                <p><strong>Current Position Size:</strong> {currentPositionSize} base units</p>
                <p><strong>Current Leverage:</strong> {currentLeverage}x</p>
                {estimatedNewLeverage !== "0.00" && (
                  <p><strong>Estimated New Leverage:</strong> {estimatedNewLeverage}x</p>
                )}
                <p><strong>Subaccount:</strong> {user.getUserAccount().subAccountId}</p>
              </>
            )}
          </div>
          
          <div className="flex gap-4">
            <button
              onClick={handleConfirmOrder}
              className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
            >
              Confirm
            </button>
            <button
              onClick={handleCancelOrder}
              className="flex-1 bg-gray-300 text-gray-800 py-2 rounded hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
          
          <button
            onClick={handleCancelOrder}
            className="absolute top-2 right-2 text-gray-500"
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white w-full max-w-md p-6 rounded-xl shadow-xl relative">
        <h3 className="text-xl font-semibold mb-4">
          Place {isLimit ? "Limit" : "Market"} Order
        </h3>

        {user ? (
          <div className="mb-4 p-2 bg-gray-100 rounded">
            <p className="text-sm">
              <strong>Subaccount:</strong> {activeSubaccountId}
            </p>
          </div>
        ) : (
          renderSubaccountWarning()
        )}

        <label className="block mb-2 text-sm font-medium">Perp Market</label>
        <select
          className="w-full border p-2 rounded mb-4"
          value={state.selectedMarketIndex}
          onChange={(e) => actions.setSelectedMarketIndex(Number(e.target.value))}
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
              state.side === "long" ? "bg-green-600 text-white" : "border"
            }`}
            onClick={() => actions.setSide("long")}
          >
            Long
          </button>
          <button
            className={`px-4 py-2 rounded ${
              state.side === "short" ? "bg-red-600 text-white" : "border"
            }`}
            onClick={() => actions.setSide("short")}
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
          value={state.quoteAmount}
          onChange={(e) => actions.setQuoteAmount(e.target.value)}
        />

        {isLimit && (
          <>
            <label className="block mb-2 text-sm font-medium">Limit Price</label>
            <input
              type="number"
              className="w-full border p-2 rounded mb-4"
              placeholder="0.0"
              value={state.limitPrice}
              onChange={(e) => actions.setLimitPrice(e.target.value)}
            />

            <label className="inline-flex items-center mb-4">
              <input
                type="checkbox"
                className="mr-2"
                checked={state.postOnly}
                onChange={(e) => actions.setPostOnly(e.target.checked)}
              />
              Post Only
            </label>
          </>
        )}

        {estimatedSize && (
          <div className="text-sm mb-4">
            <p>
              <strong>Estimated Position Size:</strong> {estimatedSize} base units
            </p>
            {user && (
              <>
                <p>
                  <strong>Current Position Size:</strong>{" "}
                  {currentPositionSize} base units
                </p>
                <p>
                  <strong>Current Leverage:</strong> {currentLeverage}x
                </p>
                {estimatedNewLeverage !== "0.00" && (
                  <p>
                    <strong>Estimated New Leverage:</strong> {estimatedNewLeverage}x
                  </p>
                )}
              </>
            )}
          </div>
        )}

        <button
          onClick={handleSubmitClick}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
          disabled={state.status === "loading" || !state.quoteAmount || (isLimit && !state.limitPrice) || !user}
        >
          {state.status === "loading"
            ? "Placing..."
            : `Submit ${isLimit ? "Limit" : "Market"} Order`}
        </button>

        {state.error && (
          <p className="text-red-500 text-sm mt-2">{state.error}</p>
        )}
        {state.status === "done" && (
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