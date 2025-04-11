"use client";

import { useDriftInit } from "@/hooks/useDriftInit";
import { useDriftStore } from "@/store/useDriftStore";
import { useViewerStore } from "@/store/useViewerStore";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletBalances } from "./WalletBalances";
import { useState } from "react";
import { DepositWithdrawModal } from "./DepositWithdrawModal";
import PerpMarketOrderModal from "./PerpMarketOrderModal";
import PerpLimitOrderModal from "./PerpLimitOrderModal";
import { SubaccountCard } from "./SubaccountCard";
import Link from "next/link";

export default function Dashboard() {
  const { loading, error } = useDriftInit();
  const subaccounts = useDriftStore((s) => s.subaccounts);
  const driftClient = useDriftStore((s) => s.driftClient);
  const viewedWallet = useViewerStore((s) => s.viewedWallet);
  const { publicKey } = useWallet();
  const activeSubaccountId = useDriftStore((s) => s.activeSubaccountId);
  const [showModal, setShowModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showLimitOrderModal, setShowLimitOrderModal] = useState(false);

  if (loading) return <p>Loading Drift data...</p>;
  if (error) return <p className="text-red-500">Error: {error}</p>;
  if (!driftClient) return <p>Drift client not initialized.</p>;

  const isViewingOtherWallet =
    viewedWallet &&
    publicKey &&
    viewedWallet.toBase58() !== publicKey.toBase58();

  // Get the active subaccount or fall back to the first one
  const activeSubaccount = activeSubaccountId !== null 
    ? subaccounts.find((u) => u.getUserAccount().subAccountId === activeSubaccountId)
    : subaccounts.find((u) => u.getUserAccount().subAccountId === 0);

  return (
    <>
      <div className="w-full max-w-7xl mx-auto px-4 py-6">
        {isViewingOtherWallet && (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 p-4 rounded-lg mb-6">
            <p className="font-medium">Viewing another wallet</p>
            <p className="text-sm">
              You are currently viewing wallet: {viewedWallet.toBase58()}
            </p>
          </div>
        )}

        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <WalletBalances />
            
            {!isViewingOtherWallet && (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Deposit/Withdraw
                </button>
                <button
                  onClick={() => setShowOrderModal(true)}
                  className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                >
                  Market Order
                </button>
                <button
                  onClick={() => setShowLimitOrderModal(true)}
                  className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                >
                  Limit Order
                </button>
              </div>
            )}
          </div>

          {!subaccounts.length ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No subaccounts found</p>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">
                  Active Subaccount: {activeSubaccountId}
                </h2>
                <Link 
                  href="/subaccounts" 
                  className="text-blue-600 hover:text-blue-800"
                >
                  Manage All Subaccounts
                </Link>
              </div>
              
              {activeSubaccount && (
                <SubaccountCard
                  user={activeSubaccount}
                  index={activeSubaccount.getUserAccount().subAccountId}
                  driftClient={driftClient}
                />
              )}
            </>
          )}
        </div>
      </div>

      {showModal && <DepositWithdrawModal onClose={() => setShowModal(false)} />}
      {showOrderModal && <PerpMarketOrderModal onClose={() => setShowOrderModal(false)} />}
      {showLimitOrderModal && <PerpLimitOrderModal onClose={() => setShowLimitOrderModal(false)} />}
    </>
  );
}
