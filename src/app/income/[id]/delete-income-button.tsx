"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmButton } from "@/components/confirm-button";
import { Notice } from "@/components/ui-kit";
import { deleteIncome } from "@/server/actions";

/** «Удалить доход» with a confirmation; leads back to where the income was opened from. */
export function DeleteIncomeButton({
  id,
  backHref,
  description,
}: {
  id: string;
  backHref: string;
  description: React.ReactNode;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      {error && <Notice tone="warn" title={error} />}
      <ConfirmButton
        label="Удалить доход"
        title="Удалить доход?"
        description={description}
        onConfirm={async () => {
          const result = await deleteIncome(id);
          if (result.ok) {
            router.push(backHref);
            router.refresh();
          } else {
            setError(result.error);
          }
        }}
      />
    </>
  );
}
