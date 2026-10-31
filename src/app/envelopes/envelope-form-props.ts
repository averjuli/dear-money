import { planWallet } from "@/domain/allocation";
import { toAllocationInput, type WalletView } from "@/server/queries";
import type { EnvelopeForm } from "./envelope-form";

type FormProps = Omit<React.ComponentProps<typeof EnvelopeForm>, "variant">;

/** Props of the envelope form for an existing envelope, or a new one when id is null. */
export function envelopeFormProps(
  wallet: WalletView,
  envelopeId: string | null,
): FormProps | null {
  if (envelopeId === null) {
    return {
      walletId: wallet.id,
      walletName: wallet.name,
      envelope: null,
      priority: wallet.envelopes.length + 1,
      priorityCount: wallet.envelopes.length + 1,
      surplusReceivers: [],
    };
  }
  const envelope = wallet.envelopes.find((e) => e.id === envelopeId);
  if (!envelope) return null;

  const plan = planWallet(toAllocationInput([wallet]).envelopes);
  const ownItem = plan.items.find((i) => i.sourceEnvelopeId === envelopeId);
  const receivers = (ownItem?.destinations ?? [])
    .filter((d) => d.kind === "surplus" && d.envelopeId !== null)
    .map(
      (d) => wallet.envelopes.find((e) => e.id === d.envelopeId)?.name ?? "",
    );

  return {
    walletId: wallet.id,
    walletName: wallet.name,
    envelope: {
      id: envelope.id,
      name: envelope.name,
      costPerTime: envelope.costPerTime,
      periodN: envelope.periodN,
      periodUnit: envelope.periodUnit,
      contributionOverride: envelope.contributionOverride,
      timesToSave: envelope.timesToSave,
      startBalance: envelope.startBalance,
      balance: envelope.balance,
      expenseCount: envelope.expenseCount,
    },
    priority: wallet.envelopes.findIndex((e) => e.id === envelopeId) + 1,
    priorityCount: wallet.envelopes.length,
    surplusReceivers: receivers,
  };
}
