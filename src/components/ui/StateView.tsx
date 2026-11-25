import type { ReactNode } from 'react';
import { AlertCircle, Inbox, Loader2 } from 'lucide-react';

interface StateViewProps {
  status: 'loading' | 'error' | 'empty';
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
}

const ICONS = {
  loading: Loader2,
  error: AlertCircle,
  empty: Inbox,
};

export function StateView({ status, title, description, action, compact = false }: StateViewProps) {
  const Icon = ICONS[status];
  return (
    <div
      role={status === 'error' ? 'alert' : 'status'}
      aria-busy={status === 'loading' || undefined}
      className={`flex flex-col items-center justify-center rounded-3xl border border-line bg-white text-center ${compact ? 'px-4 py-6' : 'px-6 py-10'}`}
    >
      <Icon
        aria-hidden="true"
        size={compact ? 22 : 28}
        className={`mb-3 ${status === 'loading' ? 'animate-spin text-accent' : status === 'error' ? 'text-danger' : 'text-accent-secondary'}`}
      />
      <h3 className="text-base font-bold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm leading-relaxed text-ink/60">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
