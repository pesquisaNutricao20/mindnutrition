import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  children: ReactNode;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-paper shadow-md hover:bg-accent/90',
  secondary: 'border border-line bg-white text-ink hover:border-accent/40 hover:bg-accent/5',
  ghost: 'text-ink/70 hover:bg-ink/5 hover:text-ink',
  danger: 'bg-danger text-white shadow-md hover:brightness-95',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'min-h-11 px-4 py-2 text-sm',
  md: 'min-h-12 px-5 py-3 text-sm',
  lg: 'min-h-13 px-6 py-4 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  className = '',
  disabled,
  children,
  type = 'button',
  ...props
}, ref) {
  return (
    <button
      {...props}
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-full font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
    >
      {loading && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
});
