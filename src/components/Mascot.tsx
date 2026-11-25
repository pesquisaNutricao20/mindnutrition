import { motion } from 'motion/react';
import { FlyingMascotSprite } from './ui/FlyingMascotSprite';

interface MascotProps {
  isLoading?: boolean;
  onComplete?: () => void;
}

export function MascotComponent({ isLoading = false, onComplete }: MascotProps) {
  if (isLoading) return <MascotLoading onComplete={onComplete} />;

  return (
    <motion.div
      className="inline-block cursor-pointer"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <FlyingMascotSprite alt="Mascote" animation="idle" className="w-24 h-24 md:w-32 md:h-32" />
    </motion.div>
  );
}

export function MascotLoading({ onComplete }: { onComplete?: () => void }) {
  return (
    <div className="fixed inset-0 z-[10001] bg-paper flex flex-col items-center justify-center">
      <div className="relative">
        <FlyingMascotSprite className="w-40 h-40 md:w-56 md:h-56" />
        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 h-4 w-20 rounded-full bg-ink/10 opacity-20 blur-sm" />
      </div>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-8 label-sm text-accent animate-pulse"
      >
        Carregando...
      </motion.p>
    </div>
  );
}
