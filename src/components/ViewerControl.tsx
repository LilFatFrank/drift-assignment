"use client";

import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useViewerStore } from "@/store/useViewerStore";
import { useWallet } from "@solana/wallet-adapter-react";

export function ViewerControl() {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const setViewedWallet = useViewerStore((s) => s.setViewedWallet);
  const viewedWallet = useViewerStore((s) => s.viewedWallet);
  const { connected, publicKey } = useWallet();

  const validatePublicKey = (value: string): boolean => {
    try {
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)) {
        return false;
      }
      const pubkey = new PublicKey(value);
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
      setError("Invalid Solana wallet address");
      return;
    }
    
    try {
      const pubkey = new PublicKey(trimmedInput);
      setViewedWallet(pubkey);
      setError(null);
      setInput(""); // Clear input after successful submission
    } catch {
      setError("Invalid wallet address");
    }
  };

  const handleViewMyWallet = () => {
    setViewedWallet(null);
    setInput("");
    setError(null);
  };

  return (
    <div className="flex items-center gap-2">
      {/* Current Wallet Display */}
      {viewedWallet && (
        <div className="text-sm text-gray-600">
          Viewing: {viewedWallet.toBase58().slice(0, 4)}...{viewedWallet.toBase58().slice(-4)}
        </div>
      )}
      
      {/* Input and Controls */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Enter wallet address"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="border rounded px-2 py-1 w-64 text-sm"
        />
        <button
          onClick={handleSubmit}
          className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
        >
          View
        </button>
        {viewedWallet && connected && publicKey && (
          <button
            onClick={handleViewMyWallet}
            className="bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-700"
          >
            My Wallet
          </button>
        )}
      </div>
      
      {/* Error Display */}
      {error && (
        <div className="text-red-500 text-xs absolute mt-8">
          {error}
        </div>
      )}
    </div>
  );
} 