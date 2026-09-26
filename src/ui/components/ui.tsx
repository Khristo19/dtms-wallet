import { AnimatePresence, motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { ChevronLeft, Chevron, XMark } from '../icons';
import { useStore } from '../store';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type Variant = 'primary' | 'gray' | 'destructive';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent',
  gray: 'bg-fill-3 text-accent',
  destructive: 'bg-fill-3 text-negative',
};

/** Full capsule button (radius 999, 52–54 tall). */
export function Capsule({
  variant = 'primary',
  loading,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cx(
        'flex h-[52px] w-full shrink-0 items-center justify-center gap-2 rounded-full border-0 text-headline transition-opacity active:opacity-75 disabled:opacity-40',
        VARIANTS[variant],
        className,
      )}
    >
      {loading && <Loader2 className="size-[18px] animate-spin" />}
      {children}
    </button>
  );
}

/** 44×44 circular gray button (sheet close / back). */
export function CircleButton({ children, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...rest} className={cx('flex size-11 shrink-0 items-center justify-center rounded-full border-0 bg-fill-3 active:opacity-70 disabled:opacity-40', className)}>
      {children}
    </button>
  );
}

export const TextField = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  ({ className, invalid, ...rest }, ref) => (
    <input
      ref={ref}
      {...rest}
      className={cx(
        'h-[52px] w-full rounded-field border-0 glass-surface px-4 text-body text-label outline-none ring-2 ring-transparent transition-shadow focus:ring-accent/40',
        invalid && 'ring-negative/50 focus:ring-negative/50',
        className,
      )}
    />
  ),
);

/**
 * Stacked modal sheet, as in the Send handoff: dark backdrop, the card behind peeking out,
 * top radius 38, 36×5 grabber, header grid of 44 | title | 44.
 */
export function SheetPage({
  title,
  onClose,
  onBack,
  right,
  children,
  footer,
  dense,
}: {
  title?: ReactNode;
  onClose?: () => void;
  onBack?: () => void;
  right?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Tighter vertical rhythm for screens that must fit the 600px popup without scrolling. */
  dense?: boolean;
}) {
  return (
    <div className="absolute inset-0 bg-sheet-dim">
      <div className="absolute top-[14px] right-[18px] left-[18px] h-10 rounded-t-sheet bg-sheet-behind" />
      <div className="absolute inset-x-0 top-6 bottom-0 flex flex-col rounded-t-sheet sheet-glass">
        <div className="mt-2 h-[5px] w-9 shrink-0 self-center rounded-[3px] bg-chevron" />
        <div className="grid shrink-0 grid-cols-[44px_1fr_44px] items-center px-4 pt-[14px]">
          {onBack ? (
            <CircleButton aria-label="Back" onClick={onBack}>
              <ChevronLeft />
            </CircleButton>
          ) : onClose ? (
            <CircleButton aria-label="Close" onClick={onClose}>
              <XMark />
            </CircleButton>
          ) : (
            <span />
          )}
          <h1 className="m-0 truncate px-2 text-center text-headline">{title}</h1>
          {right ?? <span />}
        </div>
        <div className={cx('scroll-area flex min-h-0 flex-1 flex-col px-4', dense ? 'gap-[10px] pt-3 pb-2' : 'gap-[14px] pt-[14px] pb-4')}>{children}</div>
        {footer && <div className={cx('shrink-0 px-4', dense ? 'pb-5' : 'pb-6')}>{footer}</div>}
      </div>
    </div>
  );
}

/** Inset grouped list card (radius 26) with hairlines inset by `inset` px. */
export function Grouped({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('shrink-0 overflow-hidden rounded-card glass-surface', className)}>{children}</div>;
}

export function Separator({ inset = 16 }: { inset?: number }) {
  return <div className="h-px bg-separator" style={{ marginLeft: inset }} />;
}

export function SectionHeader({ children }: { children: ReactNode }) {
  return <div className="-mb-2 px-4 text-footnote text-label-2 uppercase">{children}</div>;
}

/** Plain grouped row: label left, value/accessory right, optional chevron. */
export function Row({
  label,
  value,
  icon,
  onClick,
  chevron,
  tone = 'default',
  valueClassName,
}: {
  label: ReactNode;
  value?: ReactNode;
  icon?: ReactNode;
  onClick?: () => void;
  chevron?: boolean;
  tone?: 'default' | 'accent' | 'destructive';
  valueClassName?: string;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={cx(
        'flex min-h-[48px] w-full items-center gap-3 border-0 bg-transparent px-4 py-[12px] text-left text-body',
        onClick && 'active:bg-pressed',
        tone === 'destructive' ? 'text-negative' : tone === 'accent' ? 'text-accent' : 'text-label',
      )}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {value !== undefined && <span className={cx('min-w-0 truncate text-right text-label-2', valueClassName)}>{value}</span>}
      {chevron && <Chevron />}
    </Tag>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx('animate-spin text-label-3', className ?? 'size-5')} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-lg bg-skeleton', className)} />;
}

/** Small bottom action sheet (menus, confirmations). */
export function ActionSheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="absolute inset-0 z-40 bg-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="absolute inset-x-0 bottom-0 z-50 max-h-[88%] overflow-hidden rounded-t-sheet sheet-glass"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 340 }}
          >
            <div className="mx-auto mt-2 h-[5px] w-9 rounded-[3px] bg-chevron" />
            <div className="grid grid-cols-[44px_1fr_44px] items-center px-4 pt-[10px]">
              <span />
              <h2 className="m-0 text-center text-headline">{title}</h2>
              <CircleButton aria-label="Close" onClick={onClose}>
                <XMark />
              </CircleButton>
            </div>
            <div className="scroll-area flex max-h-[440px] flex-col gap-[14px] px-4 pt-[14px] pb-6">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export function ToastHost() {
  const toast = useStore((s) => s.toast);
  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-[60] flex justify-center px-4">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.96 }}
            className={cx(
              'glass max-w-full rounded-full px-4 py-[10px] text-subhead font-semibold',
              toast.tone === 'error' && 'text-negative-text',
              toast.tone === 'success' && 'text-positive-text',
              toast.tone === 'default' && 'text-label',
            )}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Capsule segmented control (handoff: 1D/1W/1M/1Y/All). */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  render = (o) => o,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  render?: (o: T) => ReactNode;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="relative grid shrink-0 rounded-full glass-surface p-[3px]"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => (
        <button
          key={o}
          aria-pressed={o === value}
          onClick={() => o !== value && onChange(o)}
          className={cx(
            'min-h-[30px] rounded-full border-0 text-footnote font-semibold text-label transition-[background-color,box-shadow] duration-200',
            o === value ? 'bg-segment-selected shadow-segment' : 'bg-transparent',
          )}
        >
          {render(o)}
        </button>
      ))}
    </div>
  );
}

/** Large title (34/700, −0.02em). */
export function LargeTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h1 className={cx('m-0 text-large-title', className)}>{children}</h1>;
}

export function copyText(text: string, label = 'Copied') {
  void navigator.clipboard.writeText(text).then(() => useStore.getState().showToast(label, 'success'));
}

export function openTab(url: string) {
  void browser.tabs.create({ url });
}
