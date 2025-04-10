import { useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import type { Wallet as AnchorWallet } from "@coral-xyz/anchor";
import { useDriftStore } from "@/store/useDriftStore";
import { PublicKey, Connection } from "@solana/web3.js";

const connection = new Connection(
  `https://mainnet.helius-rpc.com/?api-key=${process.env.NEXT_PUBLIC_RPC_API_KEY}`,
  {
    commitment: "confirmed",
    confirmTransactionInitialTimeout: 60000,
    wsEndpoint:
      `wss://mainnet.helius-rpc.com/?api-key=${process.env.NEXT_PUBLIC_RPC_API_KEY}`,
  }
);

export function useDriftInit() {
  const { wallet, publicKey, connected } = useWallet();
  const setDriftClient = useDriftStore((s) => s.setDriftClient);
  const setSubaccounts = useDriftStore((s) => s.setSubaccounts);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoaded = useRef<string | null>(null);

  useEffect(() => {
    if (!wallet?.adapter || !connected || !publicKey) return;

    const pubkeyBase58 = publicKey.toBase58();
    if (hasLoaded.current === pubkeyBase58) return;
    hasLoaded.current = pubkeyBase58;

    const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const { DriftClient, DRIFT_PROGRAM_ID, getUserAccountPublicKey, User } =
          await import("@drift-labs/sdk");

        const PROGRAM_ID = new PublicKey(DRIFT_PROGRAM_ID);

        const driftClient = new DriftClient({
          connection,
          wallet: wallet.adapter as unknown as AnchorWallet,
          programID: PROGRAM_ID,
          env: "mainnet-beta",
        });

        await driftClient.accountSubscriber.subscribe();
        setDriftClient(driftClient);

        const users: InstanceType<typeof User>[] = [];

        for (let i = 0; i < 9; i++) {
          try {
            const userAccountPublicKey = await getUserAccountPublicKey(
              PROGRAM_ID,
              publicKey,
              i
            );

            const user = new User({
              driftClient,
              userAccountPublicKey,
            });

            if (i === 0) {
              await user.subscribe();
            } else {
              await user.fetchAccounts();
            }

            if (user.getUserAccount()) {
              users.push(user);
            }

            if (i < 7) {
              await delay(250);
            }
          } catch (err: any) {
            if (err.message?.includes("Account does not exist")) continue;
            console.warn(`Subaccount ${i} error:`, err.message);
          }
        }

        setSubaccounts(users);
      } catch (err: any) {
        console.error("Drift SDK load error:", err);
        setError(err.message || "Failed to initialize Drift client");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [wallet, connected, publicKey]);

  return { loading, error };
}
