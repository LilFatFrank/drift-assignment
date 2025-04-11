"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import WalletButton from "./WalletButton";
import { useDriftStore } from "@/store/useDriftStore";
import { ViewerControl } from "./ViewerControl";
import Link from "next/link";

export function Header() {
  const { publicKey } = useWallet();
  const subaccounts = useDriftStore((s) => s.subaccounts);
  const activeSubaccountId = useDriftStore((s) => s.activeSubaccountId);

  return (
    <header className="w-full bg-white border-b border-gray-200 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href={`/`}>
            <h1 className="text-xl font-bold">Drift</h1>
          </Link>
          {publicKey && subaccounts.length > 0 && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">
                Active: Subaccount{" "}
                {activeSubaccountId !== null ? activeSubaccountId : 0}
              </span>
              <Link
                href="/subaccounts"
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Manage Subaccounts
              </Link>
            </div>
          )}
        </div>

        <div className="flex-1 flex justify-center">
          <ViewerControl />
        </div>

        <div className="flex items-center space-x-4">
          <WalletButton />
        </div>
      </div>
    </header>
  );
}
