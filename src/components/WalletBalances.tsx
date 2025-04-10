"use client";
import { useWalletBalances } from "@/hooks/useWalletBalances";

export function WalletBalances() {
  const { balances, loading, error } = useWalletBalances();

  if (loading) return <p>Loading wallet token balances...</p>;
  if (error) return <p className="text-red-500">Error: {error}</p>;
  if (balances.length === 0) return <p>No depositable balances in wallet.</p>;

  return (
    <div className="mt-4">
      <h4 className="font-semibold mb-1">Wallet Token Balances</h4>
      <ul className="text-sm space-y-1">
        {balances.map((bal) => (
          <li key={bal.mint}>
            {bal.symbol}: {bal.amount.toFixed(4)}
          </li>
        ))}
      </ul>
    </div>
  );
}
