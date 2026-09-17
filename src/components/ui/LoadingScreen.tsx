import { motion } from 'motion/react';
import { FlyingMascotSprite } from './FlyingMascotSprite';

export const LoadingScreen = () => (
  <div className="fixed inset-0 z-[10000] bg-paper flex flex-col items-center justify-center w-full h-full">
    <div className="paper-texture" />
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative flex w-full max-w-4xl flex-col items-center justify-center overflow-hidden px-4">
      <div className="relative flex h-36 w-full items-center justify-center overflow-hidden md:h-44">
        <motion.div animate={{ y: [7, -13, 7], rotate: [-3, 3, -3] }} transition={{ duration: 2.1, repeat: Infinity, ease: 'easeInOut' }} className="relative">
          <FlyingMascotSprite className="h-28 w-28 object-contain md:h-36 md:w-36" />
        </motion.div>
      </div>
      <motion.div
        animate={{ scale: [1, 1.02, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="mt-5 text-center"
      >
        <span className="display-title text-5xl text-accent tracking-widest block">Mind Nutrition</span>
        <p className="label-sm text-accent-pink mt-3 text-sm">Cultivando sua consciência...</p>
      </motion.div>
    </motion.div>
  </div>
);
