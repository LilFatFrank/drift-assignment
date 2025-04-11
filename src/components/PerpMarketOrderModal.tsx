"use client";

import { OrderForm } from "./orders/OrderForm";

interface Props {
  onClose: () => void;
}

export default function PerpMarketOrderModal({ onClose }: Props) {
  return <OrderForm isLimit={false} onClose={onClose} />;
}
