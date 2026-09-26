import { ClockFill, GridFill, MagnifyingGlass, WalletFill } from '../icons';
import { useStore, type Tab } from '../store';
import { cx } from './ui';

const TABS: { id: Tab; label: string; Icon: typeof WalletFill }[] = [
  { id: 'wallet', label: 'Wallet', Icon: WalletFill },
  { id: 'collectibles', label: 'Collectibles', Icon: GridFill },
  { id: 'activity', label: 'Activity', Icon: ClockFill },
];

/** Floating glass tab bar (62 tall capsule, 16 inset, 26 from bottom) + separate 62×62 search button. */
export function TabBar() {
  const { tab, setTab, push } = useStore();
  return (
    <div className="absolute right-4 bottom-[26px] left-4 z-20 flex items-center gap-[10px]">
      <nav aria-label="Main" className="glass box-border grid h-[62px] grow grid-cols-3 rounded-full p-1">
        {TABS.map(({ id, label, Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              aria-current={active ? 'page' : undefined}
              className={cx(
                'flex flex-col items-center justify-center gap-[2px] rounded-full border-0 text-tab transition-colors',
                active ? 'bg-fill-3 text-accent' : 'bg-transparent text-label',
              )}
            >
              <Icon />
              {label}
            </button>
          );
        })}
      </nav>
      <button aria-label="Search" onClick={() => push({ name: 'search' })} className="glass flex size-[62px] shrink-0 items-center justify-center rounded-full">
        <MagnifyingGlass />
      </button>
    </div>
  );
}
