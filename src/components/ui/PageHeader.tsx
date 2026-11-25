import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  back?: { label: string; onClick: () => void };
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, eyebrow, back, actions, className = '' }: PageHeaderProps) {
  return (
    <div className={`responsive-page-header mb-6 flex items-start justify-between gap-4 sm:mb-8 ${className}`}>
      <div className="flex min-w-0 items-start gap-3">
        {back && (
          <button
            type="button"
            onClick={back.onClick}
            aria-label={back.label}
            title={back.label}
            className="icon-button shrink-0 border border-line bg-white text-ink/70"
          >
            <ArrowLeft aria-hidden="true" size={20} />
          </button>
        )}
        <div className="min-w-0">
          {eyebrow && <p className="mb-1 text-xs font-semibold text-accent">{eyebrow}</p>}
          <h2 className="section-title min-w-0">{title}</h2>
          {subtitle && <p className="section-subtitle mt-2 max-w-2xl text-ink/65">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
