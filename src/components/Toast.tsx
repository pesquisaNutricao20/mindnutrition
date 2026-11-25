import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, AlertCircle, Info, X, Heart } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'heart';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const ICONS: Record<ToastType, ReactNode> = {
  success: <CheckCircle size={18} />,
  error: <AlertCircle size={18} />,
  info: <Info size={18} />,
  heart: <Heart size={18} />,
};

const COLORS: Record<ToastType, string> = {
  success: 'bg-accent text-white',
  error: 'bg-danger text-white',
  info: 'bg-ink text-white',
  heart: 'bg-accent-secondary text-white',
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 40, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl max-w-sm w-full ${COLORS[toast.type]}`}
    >
      <span className="shrink-0 opacity-90">{ICONS[toast.type]}</span>
      <p className="flex-1 text-sm font-semibold leading-snug">{toast.message}</p>
      <button
        type="button"
        onClick={() => onRemove(toast.id)}
        aria-label={`Fechar notificação: ${toast.message}`}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full opacity-70 transition-opacity hover:opacity-100"
      >
        <X aria-hidden="true" size={16} />
      </button>
    </motion.div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastsRef = useRef<Toast[]>([]);
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const removeToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) clearTimeout(timer);
    timersRef.current.delete(id);
    const next = toastsRef.current.filter(item => item.id !== id);
    toastsRef.current = next;
    setToasts(next);
  }, []);

  const toast = useCallback((message: string, type: ToastType = 'info', duration = 3500) => {
    if (toastsRef.current.some(item => item.message === message && item.type === type)) return;

    const retained = toastsRef.current.slice(-2);
    retained.forEach(item => {
      const timer = timersRef.current.get(item.id);
      if (timer) clearTimeout(timer);
      timersRef.current.delete(item.id);
    });

    const id = Math.random().toString(36).slice(2);
    const next = [...retained, { id, message, type, duration }];
    toastsRef.current = next;
    setToasts(next);
    timersRef.current.set(id, setTimeout(() => removeToast(id), duration));
  }, [removeToast]);

  useEffect(() => () => {
    timersRef.current.forEach(timer => clearTimeout(timer));
    timersRef.current.clear();
  }, []);

  const latestError = [...toasts].reverse().find(item => item.type === 'error');
  const latestUpdate = [...toasts].reverse().find(item => item.type !== 'error');

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom,0px))] md:bottom-6 left-1/2 -translate-x-1/2 z-[9998] flex flex-col gap-3 items-center pointer-events-none w-full px-4">
        <div className="sr-only" aria-live="polite" aria-atomic="true">{latestUpdate?.message}</div>
        <div className="sr-only" aria-live="assertive" aria-atomic="true">{latestError?.message}</div>
        <AnimatePresence mode="sync">
          {toasts.map(item => (
            <div key={item.id} className="pointer-events-auto w-full max-w-sm">
              <ToastItem toast={item} onRemove={removeToast} />
            </div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
