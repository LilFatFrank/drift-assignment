"use client";

import { useState, useEffect } from "react";
import { useDriftStore } from "@/store/useDriftStore";
import { useWallet } from "@solana/wallet-adapter-react";
import { User, OrderType, PositionDirection } from "@drift-labs/sdk";
import { getUserAccountPublicKey } from "@drift-labs/sdk";

interface OrderFormState {
  selectedMarketIndex: number;
  side: "long" | "short";
  quoteAmount: string;
  limitPrice: string;
  postOnly: boolean;
  markPrice: number;
  status: "idle" | "loading" | "done" | "error";
  error: string | null;
}

interface OrderFormActions {
  setSelectedMarketIndex: (index: number) => void;
  setSide: (side: "long" | "short") => void;
  setQuoteAmount: (amount: string) => void;
  setLimitPrice: (price: string) => void;
  setPostOnly: (postOnly: boolean) => void;
  handleSubmit: () => Promise<void>;
}

export function useOrderForm(
  isLimit: boolean,
  onClose: () => void
): [OrderFormState, OrderFormActions] {
  const driftClient = useDriftStore((s) => s.driftClient);
  const { publicKey } = useWallet();
  const subaccounts = useDriftStore((s) => s.subaccounts);
  const activeSubaccountId = useDriftStore((s) => s.activeSubaccountId);

  const perpMarkets = Object.values(driftClient?.getPerpMarketAccounts() || {});

  const [state, setState] = useState<OrderFormState>({
    selectedMarketIndex: perpMarkets[0]?.marketIndex || 0,
    side: "long",
    quoteAmount: "",
    limitPrice: "",
    postOnly: false,
    markPrice: 0,
    status: "idle",
    error: null,
  });

  useEffect(() => {
    if (!driftClient) return;

    try {
      const oraclePrice =
        driftClient
          .getOracleDataForPerpMarket(state.selectedMarketIndex)
          .price.toNumber() / 1e6;
      setState((prev) => ({ ...prev, markPrice: oraclePrice }));
    } catch (err) {
      console.error("Error getting oracle price:", err);
    }
  }, [driftClient, state.selectedMarketIndex]);

  const handleSubmit = async () => {
    const user = subaccounts.find(
      (u) => u.getUserAccount().subAccountId === activeSubaccountId
    );
    if (!driftClient || !user || !publicKey) return;

    try {
      setState((prev) => ({ ...prev, status: "loading", error: null }));

      const quote = parseFloat(state.quoteAmount);
      if (!quote || quote <= 0) {
        throw new Error("Invalid quote amount");
      }

      if (isLimit) {
        const price = parseFloat(state.limitPrice);
        if (!price || price <= 0) {
          throw new Error("Invalid limit price");
        }
      }

      // Get latest oracle price
      const oraclePrice = driftClient.getOracleDataForPerpMarket(state.selectedMarketIndex).price;
      const market = driftClient.getPerpMarketAccount(state.selectedMarketIndex);
      if (!market) {
        throw new Error("Market not found");
      }

      const baseAmountUi =
        quote / (isLimit ? parseFloat(state.limitPrice) : oraclePrice.toNumber() / 1e6);
      const baseAssetAmount = driftClient.convertToPerpPrecision(baseAmountUi);

      console.log('Market Info:', {
        marketIndex: state.selectedMarketIndex,
        oraclePrice: oraclePrice.toString(),
        baseAssetAmount: baseAssetAmount.toString(),
        limitPrice: isLimit ? driftClient.convertToPricePrecision(parseFloat(state.limitPrice)).toString() : undefined,
        marketStatus: market.status,
      });

      // Check user's collateral
      const freeCollateral = user.getFreeCollateral().toString();
      console.log('User Info:', {
        subAccountId: user.getUserAccount().subAccountId,
        freeCollateral,
      });

      const authority = publicKey;
      const subAccountId = user.getUserAccount().subAccountId;

      let driftUser: User;

      try {
        driftUser = driftClient.getUser(subAccountId, authority);
      } catch {
        const userPda = await getUserAccountPublicKey(
          driftClient.program.programId,
          authority,
          subAccountId
        );
        const accountInfo = await driftClient.connection.getAccountInfo(
          userPda
        );

        if (!accountInfo) {
          await driftClient.initializeUserAccount(subAccountId);
        }

        await driftClient.addUser(subAccountId, authority);
        driftUser = driftClient.getUser(subAccountId, authority);
      }

      if (!driftUser.isSubscribed) {
        await driftUser.subscribe();
      }

      const orderParams = {
        orderType: isLimit ? OrderType.LIMIT : OrderType.MARKET,
        marketIndex: state.selectedMarketIndex,
        direction: state.side === "long" ? PositionDirection.LONG : PositionDirection.SHORT,
        baseAssetAmount: baseAssetAmount,
        ...(isLimit && {
          price: driftClient.convertToPricePrecision(parseFloat(state.limitPrice)),
        }),
        reduceOnly: false,
      };

      try {
        await driftClient.placePerpOrder(orderParams);
        setState(prev => ({
          ...prev,
          status: "done",
          quoteAmount: "",
          limitPrice: "",
          error: null
        }));
      } catch (err: any) {
        console.error('Detailed Error:', {
          message: err.message,
          logs: err.logs,
          error: err
        });
        throw err;
      }

      setTimeout(() => {
        setState((prev) => ({ ...prev, status: "idle" }));
        onClose();
      }, 2000);
    } catch (err: any) {
      console.error(
        isLimit ? "Limit Order Error:" : "Market Order Error:",
        err
      );
      setState((prev) => ({
        ...prev,
        status: "error",
        error: err.message || "Transaction failed",
      }));
    }
  };

  const actions: OrderFormActions = {
    setSelectedMarketIndex: (index) =>
      setState((prev) => ({ ...prev, selectedMarketIndex: index })),
    setSide: (side) => setState((prev) => ({ ...prev, side })),
    setQuoteAmount: (amount) =>
      setState((prev) => ({ ...prev, quoteAmount: amount })),
    setLimitPrice: (price) =>
      setState((prev) => ({ ...prev, limitPrice: price })),
    setPostOnly: (postOnly) => setState((prev) => ({ ...prev, postOnly })),
    handleSubmit,
  };

  return [state, actions];
}
