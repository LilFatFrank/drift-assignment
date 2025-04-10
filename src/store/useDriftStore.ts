import { create } from 'zustand';
import { DriftClient, User } from '@drift-labs/sdk';

interface DriftState {
  driftClient: DriftClient | null;
  subaccounts: User[];
  setDriftClient: (client: DriftClient) => void;
  setSubaccounts: (users: User[]) => void;
}

export const useDriftStore = create<DriftState>((set) => ({
  driftClient: null,
  subaccounts: [],
  setDriftClient: (client) => set({ driftClient: client }),
  setSubaccounts: (users) => set({ subaccounts: users }),
}));
