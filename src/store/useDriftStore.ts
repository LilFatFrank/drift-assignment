import { create } from 'zustand';
import { DriftClient, User } from '@drift-labs/sdk';

interface DriftStore {
  driftClient: DriftClient | null;
  setDriftClient: (client: DriftClient) => void;
  subaccounts: User[];
  setSubaccounts: (subaccounts: User[]) => void;
  selectedSubaccount: number;
  setSelectedSubaccount: (index: number) => void;
  activeSubaccountId: number | null;
  setActiveSubaccountId: (subaccountId: number) => void;
  lastBalanceUpdate: number;
  refreshBalances: () => void;
}

export const useDriftStore = create<DriftStore>((set, get) => ({
  driftClient: null,
  setDriftClient: (client) => set({ driftClient: client }),
  subaccounts: [],
  setSubaccounts: (subaccounts) => set({ subaccounts }),
  selectedSubaccount: 0,
  setSelectedSubaccount: (index) => set({ selectedSubaccount: index }),
  activeSubaccountId: null,
  setActiveSubaccountId: (subaccountId) => set({ activeSubaccountId: subaccountId }),
  lastBalanceUpdate: Date.now(),
  refreshBalances: () => set({ lastBalanceUpdate: Date.now() }),
}));
