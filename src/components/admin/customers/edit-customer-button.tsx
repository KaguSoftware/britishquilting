"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconPencil } from "@/components/icons";
import type { ManualCustomer } from "@/lib/invoices";
import { Button } from "../ui";
import { CustomerModal } from "./customer-modal";

/** "Edit details" on a customer's page: opens the customer form and refreshes the page once saved. */
export function EditCustomerButton({ customer }: { customer: ManualCustomer }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <IconPencil className="size-4" /> Edit details
      </Button>
      <CustomerModal open={open} customer={customer} onClose={() => setOpen(false)} onSaved={() => router.refresh()} />
    </>
  );
}
