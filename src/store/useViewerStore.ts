import { create } from 'zustand';
import { PublicKey } from '@solana/web3.js';

interface ViewerStore {
  viewedWallet: PublicKey | null;
  setViewedWallet: (key: PublicKey | null) => void;
}

export const useViewerStore = create<ViewerStore>((set) => ({
  viewedWallet: null,
  setViewedWallet: (key) => set({ viewedWallet: key }),
}));
