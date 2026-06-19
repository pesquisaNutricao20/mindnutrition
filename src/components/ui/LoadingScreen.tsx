import { motion } from 'motion/react';
import { FlyingMascotSprite } from './FlyingMascotSprite';

export const LoadingScreen = () => (
  <div className="fixed inset-0 z-[10000] bg-paper flex flex-col items-center justify-center w-full h-full">
    <div className="paper-texture" />
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="relative flex flex-col items-center justify-center"
    >
      <motion.div
        animate={{ y: [0, -15, 0] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        className="relative"
      >
        <FlyingMascotSprite className="w-32 h-32 md:w-40 md:h-40 object-contain" />
        <motion.div
          className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-16 h-3 bg-ink/10 rounded-full blur-sm"
          animate={{ scale: [1, 0.6, 1], opacity: [0.3, 0.1, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>
      <motion.div
        animate={{ scale: [1, 1.02, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="mt-10 text-center"
      >
        <span className="display-title text-5xl text-accent tracking-widest block">Mind Nutrition</span>
        <p className="label-sm text-accent-pink mt-3 text-sm">Cultivando sua consciência...</p>
      </motion.div>
    </motion.div>
  </div>
);
