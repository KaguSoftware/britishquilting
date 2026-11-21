"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconPencil } from "@/components/icons";
import type { Company } from "@/lib/companies";
import { Button } from "../ui";
import { CompanyModal } from "./company-modal";

export function EditCompanyButton({ company }: { company: Company }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <IconPencil className="size-4" /> Edit details
      </Button>
      <CompanyModal open={open} company={company} onClose={() => setOpen(false)} onSaved={() => router.refresh()} />
    </>
  );
}
