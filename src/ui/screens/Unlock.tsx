import { motion } from 'framer-motion';
import { useState } from 'react';
import { rpc } from '@/src/lib/rpc';
import { AppIcon } from '../components/Avatars';
import { ActionSheet, Capsule, TextField } from '../components/ui';
import { useStore } from '../store';

export function Unlock() {
  const { setWallet, guard } = useStore();
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resetOpen, setResetOpen] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      setWallet(await rpc('unlock', { password: pw }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unlock failed');
      setPw('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex h-full flex-col px-9 pt-16 pb-6">
      <motion.div initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="self-center">
        <AppIcon />
      </motion.div>
      <h1 className="m-0 mt-6 text-center text-large-title leading-[1.12]">
        Welcome back
      </h1>
      <p className="m-0 mt-2 text-center text-callout text-label-2">Enter your password to unlock DTMS Wallet.</p>

      <form
        className="mt-auto flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (pw) void submit();
        }}
      >
        <motion.div key={error} animate={error ? { x: [0, -8, 8, -6, 6, 0] } : {}} transition={{ duration: 0.35 }}>
          <TextField
            type="password"
            autoFocus
            placeholder="Password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            invalid={!!error}
          />
        </motion.div>
        <p className="m-0 min-h-[18px] px-4 text-footnote text-negative-text">{error}</p>
        <Capsule type="submit" disabled={!pw} loading={busy}>
          Unlock
        </Capsule>
        <button type="button" onClick={() => setResetOpen(true)} className="border-0 bg-transparent py-1 text-callout text-link">
          Forgot password?
        </button>
      </form>

      <ActionSheet open={resetOpen} onClose={() => setResetOpen(false)} title="Reset Wallet">
        <p className="m-0 px-2 text-callout leading-[1.4] text-label-2">
          Your password can't be recovered. Reset this wallet and import it again with your recovery phrase. Without the phrase, your funds are
          lost.
        </p>
        <Capsule variant="destructive" onClick={() => guard(async () => setWallet(await rpc('resetWallet')))}>
          Reset and Remove Wallet
        </Capsule>
      </ActionSheet>
    </div>
  );
}
