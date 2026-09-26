import { useEffect, useState } from 'react';
import { getNetwork, getToken } from '@/src/lib/networks';
import { formatAmount, shortAddress, timeAgo } from '@/src/lib/format';
import { rpc, type ActivityItem } from '@/src/lib/rpc';
import { cx, LargeTitle, openTab, Separator, Skeleton } from '../components/ui';
import { ArrowUpCircleFill, ClockFill } from '../icons';
import { useStore } from '../store';

export function Activity() {
  const { wallet, guard } = useStore();
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const accountIndex = wallet!.selectedAccount;

  useEffect(() => {
    let live = true;
    const load = () =>
      guard(async () => {
        const res = await rpc('getActivity', { accountIndex });
        if (live) setItems(res);
      });
    void load();
    const t = setInterval(load, 8000); // refresh pending statuses
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [accountIndex, wallet!.networkMode]);

  return (
    <div className="scroll-area h-full">
      <div className="flex min-h-full flex-col gap-[14px] px-4 pt-[60px] pb-[110px]">
        <LargeTitle className="px-1">Activity</LargeTitle>
        {items === null && <Skeleton className="h-[180px] rounded-card" />}
        {items?.length === 0 && (
          <EmptyState icon={<ClockFill size={30} />} title="No Activity Yet" body="Transactions you send from this wallet will appear here." />
        )}
        {items && items.length > 0 && (
          <div className="overflow-hidden rounded-card glass-surface">
            {items.map((it, i) => (
              <div key={it.hash}>
                {i > 0 && <Separator inset={66} />}
                <ActivityRow item={it} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const network = getNetwork(item.networkId);
  const token = getToken(item.networkId, item.token);
  const statusCls = { pending: 'text-warning-text', confirmed: 'text-positive-text', failed: 'text-negative-text' }[item.status];
  return (
    <button
      onClick={() => openTab(network.txUrl(item.hash))}
      className="flex w-full items-center gap-3 border-0 bg-transparent px-4 py-[11px] text-left active:bg-pressed"
    >
      <div className="flex size-[38px] shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
        <ArrowUpCircleFill size={26} />
      </div>
      <div className="flex min-w-0 grow flex-col">
        <span className="text-headline">Sent {token.symbol}</span>
        <span className="truncate text-footnote text-label-2">
          To {shortAddress(item.to)} · {network.name}
        </span>
      </div>
      <div className="flex shrink-0 flex-col items-end">
        <span className="text-body tabular-nums">
          −{formatAmount(BigInt(item.amount), token.decimals)} {token.symbol}
        </span>
        <span className={cx('text-footnote capitalize', statusCls)}>
          {item.status} · {timeAgo(item.timestamp)}
        </span>
      </div>
    </button>
  );
}

export function EmptyState({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center rounded-card glass-surface px-6 py-10 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-fill-3 text-label-3">{icon}</div>
      <div className="mt-4 text-headline">{title}</div>
      <div className="mt-1 max-w-[240px] text-callout leading-[1.35] text-label-2">{body}</div>
    </div>
  );
}
