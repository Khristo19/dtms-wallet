import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { rpc } from '@/src/lib/rpc';
import { passwordProblem } from '@/src/lib/validate';
import { AppIcon } from '../../components/Avatars';
import { ActionSheet, Capsule, CircleButton, copyText, cx, LargeTitle, TextField } from '../../components/ui';
import { BoltFill, ChartBarFill, ChevronLeft, EyeFill, PeopleOutline, ShieldCheckFill } from '../../icons';
import { useStore } from '../../store';
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
            mnemonic={step.mnemonic}
            onBack={() => setStep({ id: 'welcome' })}
            onNext={() => setStep({ id: 'confirmSeed', mnemonic: step.mnemonic })}
          />
        )}
        {step.id === 'confirmSeed' && (
          <ConfirmSeed
            mnemonic={step.mnemonic}
            onBack={() => setStep({ id: 'showSeed', mnemonic: step.mnemonic })}
            onNext={() => setStep({ id: 'password', mnemonic: step.mnemonic, back: step })}
          />
        )}
        {step.id === 'import' && (
          <ImportSeed onBack={() => setStep({ id: 'welcome' })} onNext={(m) => setStep({ id: 'password', mnemonic: m, back: step })} />
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

function SeedGrid({ words, blurred }: { words: string[]; blurred?: boolean }) {
  return (
    <div className={cx('grid grid-cols-3 gap-2 rounded-card glass-surface p-3 transition-[filter]', blurred && 'blur-md select-none')}>
      {words.map((w, i) => (
        <div key={i} className="flex items-center gap-[6px] rounded-full bg-fill-3 px-3 py-2 text-subhead">
          <span className="w-4 text-right text-caption text-label-3 tabular-nums">{i + 1}</span>
          <span className="font-semibold">{w}</span>
        </div>
      ))}
    </div>
  );
}

function ShowSeed({ mnemonic, onBack, onNext }: { mnemonic: string; onBack: () => void; onNext: () => void }) {
  const [revealed, setRevealed] = useState(false);
  const [saved, setSaved] = useState(false);
  return (
    <Page
      title="Recovery Phrase"
      subtitle="Write these 12 words down in order. They're the only way to recover your wallet — never share them."
      onBack={onBack}
      footer={
        <Capsule onClick={onNext} disabled={!revealed || !saved}>
          Continue
        </Capsule>
      }
    >
      <div className="relative shrink-0">
        <SeedGrid words={mnemonic.split(' ')} blurred={!revealed} />
        {!revealed && (
          <button
            onClick={() => setRevealed(true)}
            className="absolute inset-0 flex flex-col items-center justify-center gap-[6px] rounded-card border-0 bg-transparent text-callout font-semibold"
          >
            <EyeFill /> Tap to reveal
          </button>
        )}
      </div>
      {revealed && (
        <button onClick={() => copyText(mnemonic, 'Recovery phrase copied')} className="self-center border-0 bg-transparent text-callout text-link">
          Copy to Clipboard
        </button>
      )}
      <label className="flex shrink-0 cursor-pointer items-center gap-3 rounded-card glass-surface px-4 py-[13px] text-callout">
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="size-5 accent-accent" />
        I saved my recovery phrase
      </label>
    </Page>
  );
}

function ConfirmSeed({ mnemonic, onBack, onNext }: { mnemonic: string; onBack: () => void; onNext: () => void }) {
  const words = mnemonic.split(' ');
  // Three random positions, each with six shuffled candidates.
  const challenges = useMemo(() => {
    const idx = [...words.keys()].sort(() => Math.random() - 0.5).slice(0, 3).sort((a, b) => a - b);
    return idx.map((i) => {
      const decoys = words.filter((_, j) => j !== i).sort(() => Math.random() - 0.5).slice(0, 5);
      return { index: i, options: [...decoys, words[i]!].sort(() => Math.random() - 0.5) };
    });
  }, [mnemonic]);
  const [picked, setPicked] = useState<Record<number, string>>({});
  const allCorrect = challenges.every((c) => picked[c.index] === words[c.index]);
  const anyWrong = challenges.some((c) => picked[c.index] && picked[c.index] !== words[c.index]);

  return (
    <Page
      title="Confirm Phrase"
      subtitle="Select the correct word for each position."
      onBack={onBack}
      footer={
        <Capsule onClick={onNext} disabled={!allCorrect}>
          Continue
        </Capsule>
      }
    >
      {challenges.map((c) => (
        <div key={c.index} className="shrink-0 rounded-card glass-surface p-3">
          <div className="mb-2 px-1 text-footnote font-semibold text-label-2">Word #{c.index + 1}</div>
          <div className="grid grid-cols-3 gap-2">
            {c.options.map((w, k) => {
              const sel = picked[c.index] === w;
              const wrong = sel && w !== words[c.index];
              return (
                <button
                  key={k}
                  onClick={() => setPicked((p) => ({ ...p, [c.index]: w }))}
                  className={cx(
                    'h-9 rounded-full border-0 text-subhead font-semibold transition-colors',
                    !sel && 'bg-fill-3 text-label',
                    sel && !wrong && 'bg-accent text-on-accent',
                    wrong && 'bg-negative text-on-accent',
                  )}
                >
                  {w}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {anyWrong && <p className="m-0 px-4 text-footnote text-negative-text">That's not right — check your written phrase.</p>}
    </Page>
  );
}

function ImportSeed({ onBack, onNext }: { onBack: () => void; onNext: (m: string) => void }) {
  const [text, setText] = useState('');
  const [valid, setValid] = useState<boolean | null>(null);
  const words = text.trim().split(/\s+/).filter(Boolean);

  useEffect(() => {
    if (words.length !== 12 && words.length !== 24) return setValid(null);
    let live = true;
    void rpc('validateMnemonic', { mnemonic: text }).then((ok) => live && setValid(ok));
    return () => {
      live = false;
    };
  }, [text]);

  return (
    <Page
      title="Import Wallet"
      subtitle="Enter your 12 or 24-word recovery phrase, separated by spaces."
      onBack={onBack}
      footer={
        <Capsule onClick={() => onNext(words.join(' ').toLowerCase())} disabled={!valid}>
          Continue
        </Capsule>
      }
    >
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        autoComplete="off"
        rows={5}
        placeholder="word1 word2 word3 …"
        className={cx(
          'w-full shrink-0 resize-none rounded-card border-0 glass-surface p-4 font-mono text-callout leading-relaxed outline-none ring-2 ring-transparent focus:ring-accent/40',
          valid === false && 'ring-negative/50',
        )}
      />
      <div className="flex justify-between px-4 text-footnote">
        <span className={valid === false ? 'text-negative-text' : valid ? 'text-positive-text' : 'text-label-3'}>
          {valid === false ? 'Invalid recovery phrase' : valid ? 'Looks good' : ''}
        </span>
        <span className="text-label-3">{words.length} words</span>
      </div>
    </Page>
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
