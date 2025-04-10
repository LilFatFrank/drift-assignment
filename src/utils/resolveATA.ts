import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";

export async function resolveATA(mint: PublicKey, owner: PublicKey) {
    return await getAssociatedTokenAddress(mint, owner);
  }
  