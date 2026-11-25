import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';

interface FormFieldProps {
  label: ReactNode;
  htmlFor: string;
  required?: boolean;
  optional?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
}

type FieldControlProps = {
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
};

export function FormField({
  label,
  htmlFor,
  required = false,
  optional = false,
  hint,
  error,
  children,
  className = '',
}: FormFieldProps) {
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<FieldControlProps>, {
        id: (children.props as FieldControlProps).id || htmlFor,
        'aria-describedby': [(children.props as FieldControlProps)['aria-describedby'], describedBy].filter(Boolean).join(' ') || undefined,
        'aria-invalid': error ? true : (children.props as FieldControlProps)['aria-invalid'],
      })
    : children;

  return (
    <div className={`space-y-1.5 ${className}`}>
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-ink">
        {label}
        {required && <span aria-hidden="true" className="ml-1 text-danger">*</span>}
        {optional && <span className="ml-2 text-xs font-normal text-ink/55">Opcional</span>}
      </label>
      {control}
      {hint && <p id={hintId} className="text-xs leading-relaxed text-ink/60">{hint}</p>}
      {error && <p id={errorId} role="alert" className="text-sm leading-relaxed text-danger">{error}</p>}
    </div>
  );
}
