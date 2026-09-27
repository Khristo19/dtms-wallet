import { useEffect, useState } from 'react';
import { rpc, type KeyringInfo } from '@/src/lib/rpc';
import { Capsule, copyText, Grouped, Row, SectionHeader, Separator, SheetPage, TextField } from '../components/ui';
import { useStore } from '../store';

/** Reveal a recovery phrase or private key (password-gated). Lists the secrets when there are several. */
export function RevealSecret({ keyringId }: { keyringId?: string }) {
  const { pop, wallet } = useStore();
  const keyrings = wallet?.keyrings ?? [];
  const [chosen, setChosen] = useState<KeyringInfo | undefined>(() =>
    keyringId ? keyrings.find((k) => k.id === keyringId) : keyrings.length === 1 ? keyrings[0] : undefined,
  );
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [secret, setSecret] = useState<{ kind: 'mnemonic' | 'privateKey'; value: string } | null>(null);

  // Drop the secret from memory when leaving the screen.
  useEffect(() => () => setSecret(null), []);

  if (!chosen) {
    const phrases = keyrings.filter((k) => k.kind === 'mnemonic');
    const keys = keyrings.filter((k) => k.kind === 'privateKey');
    return (
      <SheetPage title="Recovery Phrases & Keys" onBack={pop}>
        {[
          { title: 'Recovery phrases', items: phrases },
          { title: 'Private keys', items: keys },
        ]
          .filter((s) => s.items.length > 0)
          .map((s) => (
            <div key={s.title} className="flex flex-col gap-[14px]">
              <SectionHeader>{s.title}</SectionHeader>
              <Grouped>
                {s.items.map((k, i) => (
                  <div key={k.id}>
                    {i > 0 && <Separator />}
                    <Row label={k.label} value={k.chain ? (k.chain === 'evm' ? 'EVM' : 'Solana') : undefined} chevron onClick={() => setChosen(k)} />
                  </div>
                ))}
              </Grouped>
            </div>
          ))}
      </SheetPage>
    );
  }

  const isPhrase = chosen.kind === 'mnemonic';
  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      setSecret(await rpc('revealSecret', { password: pw, keyringId: chosen.id }));
      setPw('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SheetPage
      title={chosen.label}
      onBack={keyrings.length > 1 && !keyringId ? () => (setSecret(null), setChosen(undefined)) : pop}
      footer={
        secret ? (
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
        Anyone with this {isPhrase ? 'phrase' : 'key'} can take all the funds it controls. Never share it — DTMS will never ask for it.
      </p>
      {secret ? (
        <>
          {secret.kind === 'mnemonic' ? (
            <div className="grid shrink-0 grid-cols-3 gap-2 rounded-card glass-surface p-3">
              {secret.value.split(' ').map((w, i) => (
                <div key={i} className="flex items-center gap-[6px] rounded-full bg-fill-3 px-3 py-2 text-subhead">
                  <span className="w-4 text-right text-caption text-label-3 tabular-nums">{i + 1}</span>
                  <span className="font-semibold">{w}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="m-0 shrink-0 rounded-card glass-surface p-4 font-mono text-subhead leading-relaxed break-all">{secret.value}</p>
          )}
          <button
            onClick={() => copyText(secret.value, isPhrase ? 'Recovery phrase copied' : 'Private key copied')}
            className="self-center border-0 bg-transparent text-callout text-link"
          >
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
