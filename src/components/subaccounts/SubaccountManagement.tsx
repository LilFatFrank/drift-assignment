"use client";

import { useDriftStore } from "@/store/useDriftStore";
import { useState } from "react";
import { PerpPosition } from "@drift-labs/sdk";

export function SubaccountManagement() {
  const subaccounts = useDriftStore((s) => s.subaccounts);
  const [selectedSubaccountId, setSelectedSubaccountId] = useState<number | null>(null);
  
  // Set the selected subaccount in the global state
  const setActiveSubaccountId = useDriftStore((s) => s.setActiveSubaccountId);
  
  const handleSelectSubaccount = (subaccountId: number) => {
    setSelectedSubaccountId(subaccountId);
    setActiveSubaccountId(subaccountId);
  };
  
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Subaccount Management</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {subaccounts.map((subaccount) => {
          const userAccount = subaccount.getUserAccount();
          const subaccountId = userAccount.subAccountId;
          const isSelected = selectedSubaccountId === subaccountId;
          
          // Calculate key metrics
          const totalCollateral = subaccount.getTotalCollateral().toNumber() / 1e6;
          const leverage = subaccount.getLeverage().toNumber().toFixed(2);
          
          // Count open positions - iterate through all market indices
          let openPositions = 0;
          for (let i = 0; i < 20; i++) { // Assuming max 20 markets
            const position = subaccount.getPerpPosition(i);
            if (position && position.baseAssetAmount.toString() !== "0") {
              openPositions++;
            }
          }
          
          // Count open orders
          const openOrders = subaccount.getOpenOrders().length;
          
          return (
            <div 
              key={subaccountId}
              className={`border rounded-lg p-4 cursor-pointer transition-all ${
                isSelected ? 'border-blue-500 bg-blue-50' : 'hover:border-gray-400'
              }`}
              onClick={() => handleSelectSubaccount(subaccountId)}
            >
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-semibold">Subaccount {subaccountId}</h3>
                {isSelected && (
                  <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded">Selected</span>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-gray-500">Total Collateral</p>
                  <p className="font-medium">${totalCollateral.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Leverage</p>
                  <p className="font-medium">{leverage}x</p>
                </div>
                <div>
                  <p className="text-gray-500">Open Positions</p>
                  <p className="font-medium">{openPositions}</p>
                </div>
                <div>
                  <p className="text-gray-500">Open Orders</p>
                  <p className="font-medium">{openOrders}</p>
                </div>
              </div>
              
              <button 
                className="mt-4 w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectSubaccount(subaccountId);
                }}
              >
                {isSelected ? 'Currently Selected' : 'Select This Subaccount'}
              </button>
            </div>
          );
        })}
      </div>
      
      {subaccounts.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500">No subaccounts found. Create a subaccount to get started.</p>
        </div>
      )}
    </div>
  );
} 