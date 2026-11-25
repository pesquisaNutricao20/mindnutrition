import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';

interface OverlayProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  variant?: 'modal' | 'drawer';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  busy?: boolean;
  footer?: ReactNode;
  children: ReactNode;
  initialFocusRef?: RefObject<HTMLElement | null>;
  header?: ReactNode;
  headerClassName?: string;
  bodyClassName?: string;
  panelClassName?: string;
  showCloseButton?: boolean;
  closeLabel?: string;
  dragToClose?: boolean;
}

const overlayStack: symbol[] = [];
let bodyOverflowBeforeOverlays: string | null = null;

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
  'summary',
].join(',');

const SIZE_CLASSES = {
  sm: 'md:max-w-sm',
  md: 'md:max-w-md',
  lg: 'md:max-w-lg',
  xl: 'md:max-w-xl',
};

function getFocusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter(element => element.getAttribute('aria-hidden') !== 'true' && element.getClientRects().length > 0);
}

export function Overlay({
  open,
  onClose,
  title,
  description,
  variant = 'modal',
  size = 'md',
  busy = false,
  footer,
  children,
  initialFocusRef,
  header,
  headerClassName = '',
  bodyClassName = '',
  panelClassName = '',
  showCloseButton = true,
  closeLabel = 'Fechar',
  dragToClose = false,
}: OverlayProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const overlayIdRef = useRef(Symbol('overlay'));
  const titleId = useId();
  const descriptionId = useId();
  const onCloseRef = useRef(onClose);
  const busyRef = useRef(busy);
  const panelY = useMotionValue(0);
  const reduceMotion = useReducedMotion();
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches);

  useEffect(() => {
    onCloseRef.current = onClose;
    busyRef.current = busy;
  }, [onClose, busy]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!open) return;

    const overlayId = overlayIdRef.current;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    overlayStack.push(overlayId);
    if (overlayStack.length === 1) {
      bodyOverflowBeforeOverlays = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    panelY.set(0);

    const focusFrame = window.requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const preferred = initialFocusRef?.current
        || panel.querySelector<HTMLElement>('[data-autofocus]')
        || getFocusableElements(panel)[0]
        || panel;
      preferred.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (overlayStack[overlayStack.length - 1] !== overlayId) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!busyRef.current) onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;

      const focusable = getFocusableElements(panelRef.current);
      if (!focusable.length) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (!panelRef.current.contains(active)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && (active === first || active === panelRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
      const wasTopOverlay = overlayStack[overlayStack.length - 1] === overlayId;
      const index = overlayStack.lastIndexOf(overlayId);
      if (index >= 0) overlayStack.splice(index, 1);
      if (overlayStack.length === 0 && bodyOverflowBeforeOverlays !== null) {
        document.body.style.overflow = bodyOverflowBeforeOverlays;
        bodyOverflowBeforeOverlays = null;
      }
      if (wasTopOverlay && previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [open, initialFocusRef, panelY]);

  if (typeof document === 'undefined') return null;

  const panelClasses = variant === 'drawer'
    ? 'overlay-drawer absolute inset-x-0 bottom-0 max-h-[calc(100dvh-1rem)] md:inset-y-0 md:left-auto md:right-0 md:h-full md:max-h-none md:max-w-3xl'
    : `modal-panel-rounded modal-panel-sheet ${SIZE_CLASSES[size]}`;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="modal-shell fixed inset-0 z-[9000] flex">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-backdrop absolute inset-0"
            onClick={() => { if (!busy) onClose(); }}
            aria-hidden="true"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            aria-busy={busy || undefined}
            tabIndex={-1}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            drag={dragToClose && isMobile && !busy ? 'y' : false}
            dragConstraints={{ top: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100) {
                onCloseRef.current();
              } else if (reduceMotion) {
                panelY.set(0);
              } else {
                animate(panelY, 0, { type: 'spring', damping: 30, stiffness: 320 });
              }
            }}
            style={{ y: panelY }}
            className={`modal-panel relative z-10 w-full border border-line bg-paper shadow-2xl ${panelClasses} ${panelClassName}`}
          >
            {header ? (
              <>
                <h2 id={titleId} className="sr-only">{title}</h2>
                {description && <p id={descriptionId} className="sr-only">{description}</p>}
                <div className={headerClassName || 'modal-header'}>{header}</div>
              </>
            ) : (
              <div className="modal-header flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 id={titleId} className="modal-title font-title text-2xl font-bold sm:text-3xl">{title}</h2>
                  {description && <p id={descriptionId} className="mt-2 text-sm leading-relaxed text-ink/65">{description}</p>}
                </div>
                {showCloseButton && (
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={busy}
                    aria-label={closeLabel}
                    className="icon-button shrink-0 border border-line bg-white text-ink/60"
                  >
                    <X aria-hidden="true" size={18} />
                  </button>
                )}
              </div>
            )}
            <div className={`modal-body ${bodyClassName}`}>{children}</div>
            {footer && <div className="shrink-0 border-t border-line bg-paper px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] sm:px-6">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
