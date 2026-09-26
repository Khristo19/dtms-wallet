import { LargeTitle } from '../components/ui';
import { GridFill } from '../icons';
import { EmptyState } from './Activity';

export function Collectibles() {
  return (
    <div className="scroll-area h-full">
      <div className="flex min-h-full flex-col gap-[14px] px-4 pt-[60px] pb-[110px]">
        <LargeTitle className="px-1">Collectibles</LargeTitle>
        <EmptyState icon={<GridFill size={28} />} title="Coming Soon" body="NFTs you own on Ethereum and Solana will show up here." />
      </div>
    </div>
  );
}
