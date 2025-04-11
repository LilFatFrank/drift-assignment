"use client";

import { SubaccountManagement } from "@/components/subaccounts/SubaccountManagement";

export default function SubaccountsPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Subaccount Management</h1>
      <SubaccountManagement />
    </div>
  );
} 