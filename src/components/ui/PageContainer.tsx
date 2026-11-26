import type { ReactNode, TouchEventHandler } from 'react';
import { motion } from 'motion/react';

interface PageContainerProps {
  children: ReactNode;
  variant?: 'default' | 'narrow' | 'wide';
  className?: string;
  noPadding?: boolean;
  hasTopbar?: boolean;
  onTouchStart?: TouchEventHandler<HTMLDivElement>;
  onTouchMove?: TouchEventHandler<HTMLDivElement>;
  onTouchEnd?: TouchEventHandler<HTMLDivElement>;
}

const MAX_WIDTH = {
  default: 'max-w-6xl',
  narrow: 'max-w-2xl',
  wide: 'max-w-none',
};

export function PageContainer({
  children,
  variant = 'default',
  className = '',
  noPadding = false,
  hasTopbar = true,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
}: PageContainerProps) {
  const pagePadding = noPadding
    ? ''
    : `px-4 sm:px-8 md:px-12 ${hasTopbar ? 'pt-24 md:pt-28' : 'pt-[calc(1rem+env(safe-area-inset-top,0px))] md:pt-12'}`;
  const bottomPadding = noPadding
    ? ''
    : hasTopbar
      ? 'pb-[calc(7rem+env(safe-area-inset-bottom,0px))] md:pb-[calc(4rem+env(safe-area-inset-bottom,0px))]'
      : 'pb-8 md:pb-12';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`w-full min-h-screen ${bottomPadding} ${pagePadding} ${MAX_WIDTH[variant]} mx-auto swipe-tab-container ${className}`}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {children}
    </motion.div>
  );
}
