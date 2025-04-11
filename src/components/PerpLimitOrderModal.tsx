"use client";

import { OrderForm } from "./orders/OrderForm";

interface Props {
  onClose: () => void;
}

export default function PerpLimitOrderModal({ onClose }: Props) {
  return <OrderForm isLimit={true} onClose={onClose} />;
}
