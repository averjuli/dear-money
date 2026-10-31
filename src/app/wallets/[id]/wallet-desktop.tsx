import Link from "next/link";
import { DesktopScreen, Panel } from "@/components/desktop";
import { CloseIcon } from "@/components/icons";
import { formatMoney } from "@/domain/money";
import { toAllocationInput, type WalletView } from "@/server/queries";
import { EnvelopeForm } from "../../envelopes/envelope-form";
import { envelopeFormProps } from "../../envelopes/envelope-form-props";
import type { StatusInfo } from "./envelope-priorities";
import { EnvelopeTable } from "./envelope-table";

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[16px] bg-surface px-4 py-2.5">
      <div className="text-[13px] text-ink-muted">{label}</div>
      <div className="text-lg font-semibold">{formatMoney(value)}</div>
    </div>
  );
}

/**
 * «new» opens a full-width form for a new envelope in place of the table;
 * an id opens that envelope in the side panel.
 */
function SettingsPanel({
  wallet,
  selected,
}: {
  wallet: WalletView;
  selected: string;
}) {
  const isNew = selected === "new";
  const form = envelopeFormProps(wallet, isNew ? null : selected);
  if (!form) return null;
  return (
    <div
      className={
        isNew ? "min-w-0 grow" : "min-w-0 max-w-[420px] flex-[1_1_320px]"
      }
    >
      <Panel>
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <div className="text-[13px] text-ink-muted">
              {isNew
                ? `${wallet.name} · конверт`
                : `Конверт · приоритет ${form.priority} из ${form.priorityCount}`}
            </div>
            <h2 className="m-0 text-xl font-semibold">
              {form.envelope?.name ?? "Новый конверт"}
            </h2>
          </div>
          <Link
            href={`/wallets/${wallet.id}`}
            scroll={false}
            aria-label="Закрыть настройку"
            className="-mr-2 flex size-10 shrink-0 items-center justify-center text-ink"
          >
            <CloseIcon size={18} />
          </Link>
        </div>
        <EnvelopeForm
          key={selected}
          {...form}
          variant={isNew ? "wide" : "panel"}
        />
      </Panel>
    </div>
  );
}

export function WalletDesktop({
  wallet,
  selected,
}: {
  wallet: WalletView;
  selected: string | null;
}) {
  const { envelopes } = toAllocationInput([wallet]);
  const statuses: Record<string, StatusInfo> = Object.fromEntries(
    wallet.envelopes.map((e) => [
      e.id,
      {
        status: e.status,
        times: e.times,
        contribution: e.contribution,
        ceiling: e.ceiling,
      },
    ]),
  );

  return (
    <DesktopScreen
      back={{ href: "/", label: "Все кошельки" }}
      title={wallet.name}
      action={
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/wallets/${wallet.id}/edit`}
            className="px-2 text-sm font-semibold"
          >
            Изменить кошелёк
          </Link>
          <Tile label="Сейчас в кошельке" value={wallet.total} />
          <Tile label="Откладывать в месяц" value={wallet.contributions} />
        </div>
      }
    >
      {selected === "new" ? (
        <SettingsPanel wallet={wallet} selected={selected} />
      ) : (
        <EnvelopeTable
          walletId={wallet.id}
          envelopes={envelopes}
          statuses={statuses}
          selectedId={selected}
          aside={
            selected && <SettingsPanel wallet={wallet} selected={selected} />
          }
        />
      )}
    </DesktopScreen>
  );
}
