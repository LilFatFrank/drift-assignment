"use client";
import { getUserAccountPublicKey, User } from "@drift-labs/sdk";
import { useState } from "react";
import { useDriftStore } from "@/store/useDriftStore";
import { useWallet } from "@solana/wallet-adapter-react";
import { getAllSpotMarkets } from "@/utils/getSpotBalances";
import { convertToNative } from "@/utils/format";
import { BN } from "@coral-xyz/anchor";
import { resolveATA } from "@/utils/resolveATA";

type Props = {
  onClose: () => void;
};

export function DepositWithdrawModal({ onClose }: Props) {
  const driftClient = useDriftStore((s) => s.driftClient);
  const subaccounts = useDriftStore((s) => s.subaccounts);
  const { publicKey } = useWallet();

  if (!driftClient || !publicKey) return null;
  const markets = getAllSpotMarkets(driftClient);
  const [selectedMarketIndex, setSelectedMarketIndex] = useState(
    markets[0]?.marketIndex || 0
  );
  const [selectedSubaccountIndex, setSelectedSubaccountIndex] = useState(0);
  const [mode, setMode] = useState<"deposit" | "withdraw">("deposit");
  const [amountUi, setAmountUi] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);

  const selectedMarket = driftClient.getSpotMarketAccount(selectedMarketIndex);
  if (!selectedMarket) return null;

  const decimals = selectedMarket.decimals;
  const user =
    subaccounts.find(
      (u) => u.getUserAccount().subAccountId === selectedSubaccountIndex
    ) ?? null;

  const handleSubmit = async () => {
    try {
      setStatus("loading");

      const nativeAmount = convertToNative(Number(amountUi), decimals);
      const subAccountId =
        user?.getUserAccount().subAccountId ?? selectedSubaccountIndex;
      const authority = publicKey!;

      const tokenATA = await resolveATA(selectedMarket.mint, authority);

      const userPda = await getUserAccountPublicKey(
        driftClient.program.programId,
        authority,
        subAccountId
      );

      const userAccountInfo = await driftClient.connection.getAccountInfo(
        userPda
      );

      if (!userAccountInfo) {
        await driftClient.initializeUserAccount(subAccountId);
      }
      
      let driftUser: User;
      try {
        driftUser = driftClient.getUser(subAccountId, authority);
      } catch {
        await driftClient.addUser(subAccountId, authority);
        driftUser = driftClient.getUser(subAccountId, authority);
      }
      if (!driftUser.isSubscribed) {
        await driftUser.subscribe();
      }

      if (mode === "deposit") {
        await driftClient.deposit(
          new BN(nativeAmount),
          selectedMarketIndex,
          tokenATA,
          subAccountId
        );
      } else {
        await driftClient.withdraw(
          new BN(nativeAmount),
          selectedMarketIndex,
          tokenATA,
          false, // reduceOnly
          subAccountId
        );
      }
      useDriftStore.getState().refreshBalances();
      setStatus("done");
      setAmountUi("");
      const updatedUser = driftClient.getUser(subAccountId, publicKey);

      if (updatedUser) {
        await updatedUser.fetchAccounts();
        const updatedSubaccounts = [...subaccounts];
        const idx = updatedSubaccounts.findIndex(
          (u) => u.getUserAccount().subAccountId === subAccountId
        );

        if (idx >= 0) {
          updatedSubaccounts[idx] = updatedUser;
        } else {
          updatedSubaccounts.push(updatedUser);
        }

        useDriftStore.getState().setSubaccounts(updatedSubaccounts);
      }

      // Force refresh wallet balances
      const { refreshBalances } = useDriftStore.getState();
      if (refreshBalances) {
        await refreshBalances();
      }

      // Close modal after successful update
      setTimeout(() => {
        setStatus("idle");
        onClose();
      }, 2000);
    } catch (err: any) {
      console.error("Deposit/Withdraw Error:", err);
      setError(err.message || "Unexpected error");
      setStatus("error");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center">
      <div className="bg-white w-full max-w-md p-6 rounded-xl shadow-xl relative z-50">
        <h3 className="text-xl font-semibold mb-4">Deposit / Withdraw</h3>

        {/* Subaccount Selector */}
        <label className="block mb-2 text-sm font-medium">Subaccount</label>
        <select
          className="w-full border p-2 rounded mb-4"
          value={selectedSubaccountIndex}
          onChange={(e) => setSelectedSubaccountIndex(Number(e.target.value))}
        >
          {subaccounts.map((u) => {
            const id = u.getUserAccount().subAccountId;
            return (
              <option key={id} value={id}>
                Subaccount {id}
              </option>
            );
          })}
        </select>

        {/* Asset Selector */}
        <label className="block mb-2 text-sm font-medium">Asset</label>
        <select
          className="w-full border p-2 rounded mb-4"
          value={selectedMarketIndex}
          onChange={(e) => setSelectedMarketIndex(Number(e.target.value))}
        >
          {markets.map((m) => (
            <option key={m.marketIndex} value={m.marketIndex}>
              {m.symbol}
            </option>
          ))}
        </select>

        {/* Amount */}
        <label className="block mb-2 text-sm font-medium">Amount</label>
        <input
          type="number"
          className="w-full border p-2 rounded mb-4"
          placeholder="0.00"
          value={amountUi}
          onChange={(e) => setAmountUi(e.target.value)}
        />

        {/* Mode Toggle */}
        <div className="flex gap-4 mb-4">
          <button
            className={`px-4 py-2 rounded ${
              mode === "deposit" ? "bg-blue-600 text-white" : "border"
            }`}
            onClick={() => setMode("deposit")}
          >
            Deposit
          </button>
          <button
            className={`px-4 py-2 rounded ${
              mode === "withdraw" ? "bg-blue-600 text-white" : "border"
            }`}
            onClick={() => setMode("withdraw")}
          >
            Withdraw
          </button>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700"
          disabled={status === "loading"}
        >
          {status === "loading" ? "Submitting..." : "Submit"}
        </button>

        {/* Status */}
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        {status === "done" && (
          <p className="text-green-600 text-sm mt-2">Success!</p>
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
