import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { rpc } from '@/src/lib/rpc';
import { EyeFill } from '../icons';
import { Capsule, copyText, cx } from './ui';

/** Page chrome for the phrase screens: onboarding uses a full screen, Add Account uses a sheet. */
export interface FrameProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  footer: ReactNode;
  children: ReactNode;
}
export type Frame = (props: FrameProps) => ReactNode;

export function SeedGrid({ words, blurred }: { words: string[]; blurred?: boolean }) {
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

export function ShowSeed({ frame: Page, mnemonic, onBack, onNext }: { frame: Frame; mnemonic: string; onBack: () => void; onNext: () => void }) {
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

export function ConfirmSeed({ frame: Page, mnemonic, onBack, onNext }: { frame: Frame; mnemonic: string; onBack: () => void; onNext: () => void }) {
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

export function ImportSeed({
  frame: Page,
  title = 'Import Wallet',
  onBack,
  onNext,
}: {
  frame: Frame;
  title?: string;
  onBack: () => void;
  onNext: (m: string) => void;
}) {
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
      title={title}
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
