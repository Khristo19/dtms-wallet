import { useEffect, useState } from 'react';
import { rpc } from '@/src/lib/rpc';
import { Capsule, copyText, SheetPage, TextField } from '../components/ui';
import { useStore } from '../store';

export function RevealSeed() {
  const pop = useStore((s) => s.pop);
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [words, setWords] = useState<string[] | null>(null);

  // Drop the phrase from memory when leaving the screen.
  useEffect(() => () => setWords(null), []);

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      setWords((await rpc('revealSeed', { password: pw })).split(' '));
      setPw('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SheetPage
      title="Recovery Phrase"
      onBack={pop}
      footer={
        words ? (
          <Capsule variant="gray" onClick={pop}>
            Done
          </Capsule>
        ) : (
          <Capsule disabled={!pw} loading={busy} onClick={submit}>
            Reveal
          </Capsule>
        )
      }
    >
      <p className="m-0 rounded-card bg-negative/10 px-4 py-3 text-callout leading-[1.35] text-negative-text">
        Anyone with this phrase can take all your funds. Never share it — DTMS will never ask for it.
      </p>
      {words ? (
        <>
          <div className="grid shrink-0 grid-cols-3 gap-2 rounded-card glass-surface p-3">
            {words.map((w, i) => (
              <div key={i} className="flex items-center gap-[6px] rounded-full bg-fill-3 px-3 py-2 text-subhead">
                <span className="w-4 text-right text-caption text-label-3 tabular-nums">{i + 1}</span>
                <span className="font-semibold">{w}</span>
              </div>
            ))}
          </div>
          <button onClick={() => copyText(words.join(' '), 'Recovery phrase copied')} className="self-center border-0 bg-transparent text-callout text-link">
            Copy to Clipboard
          </button>
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (pw) void submit();
          }}
        >
          <TextField type="password" autoFocus placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} invalid={!!error} />
          <p className="m-0 mt-2 min-h-[18px] px-4 text-footnote text-negative-text">{error}</p>
        </form>
      )}
    </SheetPage>
  );
}
