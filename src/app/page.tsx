"use client";

import Dashboard from "@/components/Dashboard";
import WalletButton from "@/components/WalletButton";

export default function Home() {

  return (
    <div className="flex flex-col gap-4 items-center justify-center">
      <WalletButton />
      <Dashboard />
    </div>
  );
}
