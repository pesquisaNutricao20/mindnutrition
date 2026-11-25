import { motion, useReducedMotion } from 'motion/react';
import { FlyingMascotSprite } from './FlyingMascotSprite';

export const LoadingScreen = () => {
  const reduceMotion = useReducedMotion();

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Carregando sua jornada"
      className="fixed inset-0 z-[10000] bg-paper flex flex-col items-center justify-center w-full h-full"
    >
      <div className="paper-texture" />
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative flex w-full max-w-4xl flex-col items-center justify-center overflow-hidden px-4">
        <div className="relative flex h-36 w-full items-center justify-center overflow-hidden md:h-44">
          <div className="relative">
            <FlyingMascotSprite className="h-28 w-28 md:h-36 md:w-36" />
          </div>
        </div>
        <motion.div
          animate={reduceMotion ? undefined : { scale: [1, 1.02, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="mt-5 text-center"
        >
          <span className="logo-wordmark text-4xl sm:text-5xl text-accent block">Mind Nutrition</span>
          <p className="label-sm text-accent-secondary mt-3 text-sm">Carregando sua jornada...</p>
        </motion.div>
      </motion.div>
    </div>
  );
};
