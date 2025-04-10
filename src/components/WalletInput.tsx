"use client";
import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useViewerStore } from "@/store/useViewerStore";
import { useWallet } from "@solana/wallet-adapter-react";

export function WalletInput() {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const setViewedWallet = useViewerStore((s) => s.setViewedWallet);
  const viewedWallet = useViewerStore((s) => s.viewedWallet);
  const { connected } = useWallet();

  const validatePublicKey = (value: string): boolean => {
    try {
      // Check if it's a valid base58 string
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)) {
        return false;
      }
      
      // Try to create a PublicKey object
      const pubkey = new PublicKey(value);
      
      // Check if it's on the Ed25519 curve
      return PublicKey.isOnCurve(pubkey);
    } catch {
      return false;
    }
  };

  const handleSubmit = () => {
    const trimmedInput = input.trim();
    
    if (!trimmedInput) {
      setError("Please enter a wallet address");
      return;
    }
    
    if (!validatePublicKey(trimmedInput)) {
      setError("Invalid Solana wallet address. Please enter a valid public key.");
      return;
    }
    
    try {
      const pubkey = new PublicKey(trimmedInput);
      setViewedWallet(pubkey);
      setError(null);
    } catch {
      setError("Invalid wallet address");
    }
  };

  const handleViewMyWallet = () => {
    setViewedWallet(null);
    setInput("");
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mb-4">
      <input
        type="text"
        placeholder="Enter wallet address"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        className="border rounded px-3 py-2 w-full sm:w-96"
      />
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          View Wallet
        </button>
        {viewedWallet && connected && (
          <button
            onClick={handleViewMyWallet}
            className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
          >
            View My Wallet
          </button>
        )}
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
    </div>
  );
}
