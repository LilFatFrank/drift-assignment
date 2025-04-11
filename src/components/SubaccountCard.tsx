"use client";

import { useState } from "react";
import { User } from "@drift-labs/sdk";
import { DriftClient } from "@drift-labs/sdk";
import {
  convertToNumber,
  convertToUiDecimals,
  decodeSymbol,
} from "@/utils/format";
import { getSubaccountRisk } from "@/utils/getSubAccountRisk";
import { calculateEntryPrice } from "@drift-labs/sdk";
import { getSpotBalances } from "@/utils/getSpotBalances";
import Link from "next/link";
import { useDriftStore } from "@/store/useDriftStore";
import PerpTPStopModal from "./PerpTpStopModal";
import { OrderType } from "@drift-labs/sdk";
import {BN} from "@coral-xyz/anchor";

type Tab = "overview" | "spot" | "perp" | "orders";

interface Props {
  user: User;
  index: number;
  driftClient: DriftClient;
}

export function SubaccountCard({ user, index, driftClient }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [showTPStopModal, setShowTPStopModal] = useState(false);
  const positions = user.getActivePerpPositions();
  const risk = getSubaccountRisk(user);
  const spotBalances = getSpotBalances(user, driftClient);
  const activeSubaccountId = useDriftStore((s) => s.activeSubaccountId);

  const isActiveSubaccount =
    activeSubaccountId === user.getUserAccount().subAccountId;

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "spot", label: `Spot (${spotBalances.length})` },
    { id: "perp", label: `Perp (${positions.length})` },
    { id: "orders", label: "Orders" },
  ];

  return (
    <div className="border rounded-xl shadow bg-white overflow-hidden">
      <div className="border-b px-4 py-3 bg-gray-50 flex justify-between items-center">
        <h2 className="font-semibold text-lg">Subaccount {index}</h2>
        {isActiveSubaccount && (
          <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
            Active
          </span>
        )}
      </div>

      <div className="border-b">
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === tab.id
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        {activeTab === "overview" && (
          <div className="space-y-2">
            <p>
              <strong>Collateral:</strong> ${" "}
              {convertToUiDecimals(user.getTotalCollateral(), 6).toFixed(2)}
            </p>
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

            {!isActiveSubaccount && (
              <div className="mt-4">
                <Link
                  href="/subaccounts"
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  Switch to this subaccount
                </Link>
              </div>
            )}
          </div>
        )}

        {activeTab === "spot" && (
          <div className="space-y-2">
            {spotBalances.length === 0 ? (
              <p className="text-gray-500">No spot balances</p>
            ) : (
              <ul className="space-y-2">
                {spotBalances.map((bal) => (
                  <li
                    key={bal.marketIndex}
                    className="flex justify-between items-center"
                  >
                    <span className="font-medium">{bal.symbol}</span>
                    <span>
                      {bal.amount.toFixed(4)} {bal.isBorrow && "(Borrow)"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {activeTab === "perp" && (
          <div className="space-y-2">
            {positions.length === 0 ? (
              <p className="text-gray-500">No perp positions</p>
            ) : (
              <ul className="space-y-4">
                {positions.map((pos) => {
                  const market = driftClient.getPerpMarketAccount(
                    pos.marketIndex
                  );
                  const marketName = market?.name
                    ? decodeSymbol(market.name)
                    : `Market ${pos.marketIndex}`;

                  // Get prices
                  const entryPrice = Number(
                    convertToNumber(calculateEntryPrice(pos), 6)
                  );
                  const oraclePrice = Number(
                    convertToNumber(
                      driftClient.getOracleDataForPerpMarket(pos.marketIndex)
                        .price,
                      6
                    )
                  );

                  const baseSize = Number(
                    convertToNumber(pos.baseAssetAmount, 9)
                  );
                  const isLong = pos.baseAssetAmount.gt(0);

                  // Calculate PnL
                  const unrealizedPnL = Number(
                    convertToNumber(user.getUnrealizedPNL(), 6)
                  );
                  const totalPositionValue = Math.abs(baseSize * entryPrice);
                  const pnlPercent =
                    totalPositionValue === 0
                      ? 0
                      : (unrealizedPnL / totalPositionValue) * 100;

                  return (
                    <li
                      key={pos.marketIndex}
                      className="bg-white p-4 rounded-lg shadow"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center">
                          <span className="font-semibold text-lg">
                            {marketName}
                          </span>
                          <span
                            className={`ml-2 px-2 py-0.5 rounded text-sm ${
                              isLong
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {isLong ? "Long" : "Short"}
                          </span>
                        </div>
                        {Math.abs(baseSize) > 0 && (
                          <button
                            onClick={() => setShowTPStopModal(true)}
                            className="text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded-full hover:bg-blue-200 transition-colors"
                          >
                            Set TP/SL
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm text-gray-500">Size</div>
                          <div className="font-medium">
                            {Math.abs(baseSize).toFixed(4)} {marketName}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-500">
                            Entry Price
                          </div>
                          <div className="font-medium">
                            ${entryPrice.toFixed(2)}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-500">
                            Current Price
                          </div>
                          <div className="font-medium">
                            ${oraclePrice.toFixed(2)}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-500">PnL</div>
                          <div
                            className={`font-medium ${
                              unrealizedPnL >= 0
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            ${unrealizedPnL.toFixed(2)} ({pnlPercent.toFixed(2)}
                            %)
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {activeTab === "orders" && (
          <div className="p-4">
            {user.getOpenOrders().length === 0 ? (
              <p className="text-gray-500">No open orders</p>
            ) : (
              <ul className="space-y-4">
                {user.getOpenOrders().map((orderInfo, i) => {
                  const market = driftClient.getPerpMarketAccount(orderInfo.marketIndex);
                  const marketName = market?.name ? decodeSymbol(market.name) : `Market ${orderInfo.marketIndex}`;
                  
                  const baseAssetAmount = new BN(orderInfo.baseAssetAmount, 16);
                  const size = parseFloat(convertToNumber(baseAssetAmount, 9));
                  
                  const triggerPrice = orderInfo.triggerPrice !== "00" ? parseFloat(convertToNumber(new BN(orderInfo.triggerPrice, 16), 6)) : null;
                  const price = orderInfo.price !== "00" ? parseFloat(convertToNumber(new BN(orderInfo.price, 16), 6)) : null;
                  const direction = 'long' in orderInfo.direction ? "Long" : "Short";
                  const orderType = 'triggerMarket' in orderInfo.orderType ? "Trigger Market" :
                                  'triggerLimit' in orderInfo.orderType ? "Trigger Limit" :
                                  'market' in orderInfo.orderType ? "Market" : "Limit";
                  
                  return (
                    <li key={i} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="font-medium">{marketName}</h4>
                          <p className="text-sm text-gray-500">{orderType} {direction}</p>
                        </div>
                        <div className={`px-2 py-1 rounded text-sm ${orderInfo.reduceOnly ? "bg-yellow-100 text-yellow-800" : "bg-blue-100 text-blue-800"}`}>
                          {orderInfo.reduceOnly ? "Reduce Only" : "New Position"}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm text-gray-500">Size</div>
                          <div className="font-medium">{Math.abs(size).toFixed(4)} {marketName}</div>
                        </div>
                        {triggerPrice !== null && (
                          <div>
                            <div className="text-sm text-gray-500">Trigger Price</div>
                            <div className="font-medium">${triggerPrice.toFixed(2)}</div>
                          </div>
                        )}
                        {price !== null && (
                          <div>
                            <div className="text-sm text-gray-500">Limit Price</div>
                            <div className="font-medium">${price.toFixed(2)}</div>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      {showTPStopModal && (
        <PerpTPStopModal onClose={() => setShowTPStopModal(false)} />
      )}
    </div>
  );
}
