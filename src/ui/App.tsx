import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { AppIcon } from '@/src/ui/components/Avatars';
import { GradientBackground } from '@/src/ui/components/GradientBackground';
import { TabBar } from '@/src/ui/components/TabBar';
import { cx, ToastHost } from '@/src/ui/components/ui';
import { Activity } from '@/src/ui/screens/Activity';
import { Collectibles } from '@/src/ui/screens/Collectibles';
import { Home } from '@/src/ui/screens/Home';
import { Onboarding } from '@/src/ui/screens/onboarding/Onboarding';
import { Receive } from '@/src/ui/screens/Receive';
import { RevealSecret } from '@/src/ui/screens/RevealSecret';
import { AddAccount } from '@/src/ui/screens/AddAccount';
import { Search } from '@/src/ui/screens/Search';
import { Send } from '@/src/ui/screens/Send';
import { Settings } from '@/src/ui/screens/Settings';
import { TokenDetail } from '@/src/ui/screens/TokenDetail';
import { Unlock } from '@/src/ui/screens/Unlock';
import { useStore, type Page } from '@/src/ui/store';

const BALANCE_POLL_MS = 20_000;

export default function App() {
  const { wallet, refreshState, refreshBalances, guard } = useStore();
  const unlocked = !!wallet?.unlocked;

  useEffect(() => {
    void guard(refreshState);
  }, []);

  // Poll balances while the popup is open and unlocked.
  useEffect(() => {
    if (!unlocked) return;
    void refreshBalances();
    const t = setInterval(() => void refreshBalances(), BALANCE_POLL_MS);
    return () => clearInterval(t);
  }, [unlocked, wallet?.selectedAccount, wallet?.networkMode]);

  let body;
  if (!wallet) body = <Splash />;
  else if (!wallet.initialized) body = <Onboarding />;
  else if (!wallet.unlocked) body = <Unlock />;
  else body = <Main />;

  return (
    <>
      <GradientBackground />
      {body}
      <ToastHost />
    </>
  );
}

function Splash() {
  return (
    <div className="flex h-full items-center justify-center">
      <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ repeat: Infinity, duration: 1.4 }}>
        <AppIcon />
      </motion.div>
    </div>
  );
}

function Main() {
  const { tab, stack } = useStore();
  const top = stack[stack.length - 1];
  // Sheets are translucent glass over the dimmed gradient, so once one has slid in the tab
  // content underneath is hidden (the design shows only the gradient behind a sheet).
  const [covered, setCovered] = useState(false);
  useEffect(() => {
    if (!top) setCovered(false);
  }, [top]);
  // Pause the background drift while a full-screen glass sheet covers it: the sheet would
  // otherwise re-blur the whole moving gradient every frame, and it's dimmed anyway.
  useEffect(() => {
    document.documentElement.toggleAttribute('data-sheet-open', covered);
  }, [covered]);

  return (
    <div className="relative h-full">
      <div className={cx('h-full', covered && 'invisible')}>
        {tab === 'wallet' && <Home />}
        {tab === 'collectibles' && <Collectibles />}
        {tab === 'activity' && <Activity />}
        <TabBar />
      </div>

      {/* Pushed pages slide up as sheets over the tabs. */}
      <AnimatePresence>
        {top && (
          <motion.div
            key={stack.length + top.name}
            className="absolute inset-0 z-30"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 34, stiffness: 340 }}
            // Fires for exit too; only the slide-in (target y: 0) should cover the tabs.
            onAnimationComplete={(def: { y?: number | string }) => def.y === 0 && setCovered(true)}
          >
            <PageView page={top} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PageView({ page }: { page: Page }) {
  switch (page.name) {
    case 'send':
      return <Send asset={page.asset} />;
    case 'receive':
      return <Receive initialKind={page.kind} />;
    case 'token':
      return <TokenDetail asset={page.asset} />;
    case 'search':
      return <Search />;
    case 'settings':
      return <Settings />;
    case 'revealSecret':
      return <RevealSecret keyringId={page.keyringId} />;
    case 'addAccount':
      return <AddAccount />;
  }
}
