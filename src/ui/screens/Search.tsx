import { useState } from 'react';
import { Grouped, Separator, SheetPage, TextField } from '../components/ui';
import { MagnifyingGlass } from '../icons';
import { useAssets, useStore } from '../store';
import { AssetRow } from './Home';

export function Search() {
  const { pop, push, hideBalance } = useStore();
  const assets = useAssets();
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const results = assets.filter(
    (a) => !needle || [a.meta.name, a.meta.symbol, a.network.name].some((s) => s.toLowerCase().includes(needle)),
  );

  return (
    <SheetPage title="Search" onClose={pop}>
      <div className="relative shrink-0">
        <span className="absolute top-1/2 left-4 flex -translate-y-1/2 text-label-3">
          <MagnifyingGlass size={18} />
        </span>
        <TextField autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tokens and networks" className="pl-11" />
      </div>
      {results.length === 0 ? (
        <p className="m-0 pt-10 text-center text-callout text-label-2">No results for “{q}”</p>
      ) : (
        <Grouped>
          {results.map((a, i) => (
            <div key={a.key}>
              {i > 0 && <Separator inset={66} />}
              <AssetRow asset={a} hidden={hideBalance} onClick={() => push({ name: 'token', asset: a })} />
            </div>
          ))}
        </Grouped>
      )}
    </SheetPage>
  );
}
