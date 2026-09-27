import { AnimatePresence, motion } from 'framer-motion';
import { useState, type ReactNode } from 'react';
import { rpc } from '@/src/lib/rpc';
import { passwordProblem } from '@/src/lib/validate';
import { AppIcon } from '../../components/Avatars';
import { ActionSheet, Capsule, CircleButton, cx, LargeTitle, TextField } from '../../components/ui';
import { BoltFill, ChartBarFill, ChevronLeft, PeopleOutline, ShieldCheckFill } from '../../icons';
import { useStore } from '../../store';
import { ConfirmSeed, ImportSeed, ShowSeed } from '../../components/seed';
import { IS_PANEL } from '../../surface';

type Step =
  | { id: 'welcome' }
  | { id: 'showSeed'; mnemonic: string }
  | { id: 'confirmSeed'; mnemonic: string }
  | { id: 'import' }
  | { id: 'password'; mnemonic: string; back: Step };

export function Onboarding() {
  const [step, setStep] = useState<Step>({ id: 'welcome' });
  const guard = useStore((s) => s.guard);

  const startCreate = () =>
    guard(async () => {
      setStep({ id: 'showSeed', mnemonic: await rpc('generateMnemonic') });
    });

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={step.id}
        className="absolute inset-0"
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -24 }}
        transition={{ duration: 0.18 }}
      >
        {step.id === 'welcome' && <Welcome onCreate={startCreate} onImport={() => setStep({ id: 'import' })} />}
        {step.id === 'showSeed' && (
          <ShowSeed
            frame={Page}
            mnemonic={step.mnemonic}
            onBack={() => setStep({ id: 'welcome' })}
            onNext={() => setStep({ id: 'confirmSeed', mnemonic: step.mnemonic })}
          />
        )}
        {step.id === 'confirmSeed' && (
          <ConfirmSeed
            frame={Page}
            mnemonic={step.mnemonic}
            onBack={() => setStep({ id: 'showSeed', mnemonic: step.mnemonic })}
            onNext={() => setStep({ id: 'password', mnemonic: step.mnemonic, back: step })}
          />
        )}
        {step.id === 'import' && (
          <ImportSeed frame={Page} onBack={() => setStep({ id: 'welcome' })} onNext={(m) => setStep({ id: 'password', mnemonic: m, back: step })} />
        )}
        {step.id === 'password' && <CreatePassword mnemonic={step.mnemonic} onBack={() => setStep(step.back)} />}
      </motion.div>
    </AnimatePresence>
  );
}

/* Handoff screen 1 — compressed vertically for the 600px popup. */
function Welcome({ onCreate, onImport }: { onCreate: () => void; onImport: () => void }) {
  const [choose, setChoose] = useState(false);
  return (
    <div className="relative flex h-full flex-col px-9 pt-8 pb-6 panel:pt-[88px] panel:pb-10">
      <AppIcon size={IS_PANEL ? 84 : 72} />
      <h1 className="m-0 mt-4 panel:mt-7 text-center text-large-title leading-[1.12]">
        Welcome to
        <br />
        <span className="text-accent">DTMS Wallet</span>
      </h1>
      <div className="mt-6 flex flex-col gap-4 panel:mt-11 panel:gap-7">
        <Feature icon={<ShieldCheckFill />} tint="text-accent" title="Yours, and only yours" body="Your keys stay on this device. No one else can move your money." />
        <Feature icon={<BoltFill />} tint="text-positive" title="Send in a second" body="Ethereum, Arbitrum, Base, Polygon and Solana — from one wallet." />
        <Feature icon={<ChartBarFill />} tint="text-warning" title="Everything at a glance" body="All your coins in one calm, clear view." />
      </div>
      <div className="mt-auto flex flex-col items-center gap-3 pt-4">
        <span className="flex text-accent">
          <PeopleOutline />
        </span>
        <p className="m-0 text-center text-caption leading-[1.4] text-label-2">
          DTMS Wallet never sees your recovery phrase. It's encrypted with your password and stays on this device.
        </p>
        <Capsule onClick={() => setChoose(true)}>Continue</Capsule>
      </div>

      <ActionSheet open={choose} onClose={() => setChoose(false)} title="Get started">
        <Capsule
          onClick={() => {
            setChoose(false);
            onCreate();
          }}
        >
          Create a New Wallet
        </Capsule>
        <Capsule
          variant="gray"
          onClick={() => {
            setChoose(false);
            onImport();
          }}
        >
          I Already Have a Wallet
        </Capsule>
      </ActionSheet>
    </div>
  );
}

function Feature({ icon, tint, title, body }: { icon: ReactNode; tint: string; title: string; body: string }) {
  return (
    <div className="flex items-start gap-[18px]">
      <span className={cx('flex', tint)}>{icon}</span>
      <div className="flex flex-col gap-[3px]">
        <span className="text-callout font-semibold">{title}</span>
        <span className="text-callout leading-[1.35] text-label-2">{body}</span>
      </div>
    </div>
  );
}

/** Onboarding page chrome: back button, large title, subtitle, scrollable body, bottom capsule. */
function Page({ title, subtitle, onBack, children, footer }: { title: string; subtitle?: string; onBack?: () => void; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-[60px] shrink-0 items-end px-4">
        {onBack && (
          <CircleButton aria-label="Back" onClick={onBack}>
            <ChevronLeft />
          </CircleButton>
        )}
      </div>
      <div className="scroll-area flex min-h-0 flex-1 flex-col gap-[14px] px-4 pt-3 pb-4">
        <div className="px-1">
          <LargeTitle className="text-title">{title}</LargeTitle>
          {subtitle && <p className="m-0 mt-1 text-callout leading-[1.35] text-label-2">{subtitle}</p>}
        </div>
        {children}
      </div>
      <div className="shrink-0 px-4 pb-6">{footer}</div>
    </div>
  );
}

function CreatePassword({ mnemonic, onBack }: { mnemonic: string; onBack: () => void }) {
  const { setWallet, guard } = useStore();
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const problem = pw ? passwordProblem(pw) : null;
  const mismatch = confirm.length > 0 && confirm !== pw;
  const ok = !passwordProblem(pw) && pw === confirm;

  const submit = () =>
    guard(async () => {
      setBusy(true);
      try {
        setWallet(await rpc('createWallet', { mnemonic, password: pw }));
      } finally {
        setBusy(false);
      }
    });

  return (
    <Page
      title="Create Password"
      subtitle="You'll use it to unlock DTMS Wallet on this device."
      onBack={busy ? undefined : onBack}
      footer={
        <Capsule onClick={submit} disabled={!ok} loading={busy}>
          {busy ? 'Encrypting…' : 'Create Wallet'}
        </Capsule>
      }
    >
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (ok) void submit();
        }}
      >
        <TextField type="password" autoFocus placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} invalid={!!problem} />
        <TextField type="password" placeholder="Confirm password" value={confirm} onChange={(e) => setConfirm(e.target.value)} invalid={mismatch} />
        <p className="m-0 min-h-[18px] px-4 text-footnote text-negative-text">{problem ?? (mismatch ? 'Passwords do not match' : '')}</p>
        <button type="submit" hidden />
      </form>
    </Page>
  );
}
