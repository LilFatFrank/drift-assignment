import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { useDriftStore } from "@/store/useDriftStore";
import { getAllSpotMarkets } from "@/utils/getSpotBalances";
import { convertToUiDecimals } from "@/utils/format";
import { Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

const connection = new Connection(
  `https://mainnet.helius-rpc.com/?api-key=${process.env.NEXT_PUBLIC_RPC_API_KEY}`,
  {
    commitment: "confirmed",
    confirmTransactionInitialTimeout: 60000,
    wsEndpoint: `wss://mainnet.helius-rpc.com/?api-key=${process.env.NEXT_PUBLIC_RPC_API_KEY}`,
  }
);

type WalletTokenBalance = {
  symbol: string;
  mint: string;
  amount: number;
};

export function useWalletBalances(): {
  balances: WalletTokenBalance[];
  loading: boolean;
  error: string | null;
} {
  const { publicKey, connected } = useWallet();
  const driftClient = useDriftStore((s) => s.driftClient);
  const lastBalanceUpdate = useDriftStore((s) => s.lastBalanceUpdate);

  const [balances, setBalances] = useState<WalletTokenBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!connected || !publicKey || !driftClient) return;

    const loadBalances = async () => {
      setLoading(true);
      setError(null);

      try {
        const [tokenAccounts, lamports] = await Promise.all([
          connection.getParsedTokenAccountsByOwner(publicKey, {
            programId: TOKEN_PROGRAM_ID,
          }),
          connection.getBalance(publicKey),
        ]);

        const solAmount = lamports / LAMPORTS_PER_SOL;

        const spotMarkets = getAllSpotMarkets(driftClient);
        const mintToMarket = new Map<
          string,
          { symbol: string; marketIndex: number }
        >();

        for (const m of spotMarkets) {
          const existing = mintToMarket.get(m.mint);
          const isBetterCandidate =
            !existing ||
            m.symbol === "USDC" ||
            m.marketIndex < existing.marketIndex;

          if (isBetterCandidate) {
            mintToMarket.set(m.mint, {
              symbol: m.symbol,
              marketIndex: m.marketIndex,
            });
          }
        }

        const parsed = tokenAccounts.value
          .map(({ account }) => account.data.parsed.info)
          .map((info) => ({
            mint: info.mint,
            amountRaw: BigInt(info.tokenAmount.amount),
            decimals: info.tokenAmount.decimals,
          }))
          .filter((token) => mintToMarket.has(token.mint))
          .map((token) => {
            const { symbol } = mintToMarket.get(token.mint)!;
            const amount = convertToUiDecimals(
              new BN(token.amountRaw.toString()),
              token.decimals
            );
            return {
              mint: token.mint,
              symbol,
              amount,
            };
          })
          .filter((t) => t.amount > 0);

        // Insert SOL at the top
        parsed.unshift({
          mint: "SOL",
          symbol: "SOL",
          amount: solAmount,
        });

        setBalances(parsed);
      } catch (err: any) {
        console.error("Failed to load wallet token balances:", err);
        setError(err.message || "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    loadBalances();
  }, [connection, publicKey, connected, driftClient, lastBalanceUpdate]);

  return { balances, loading, error };
}
