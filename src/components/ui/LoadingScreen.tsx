import { motion } from 'motion/react';
import { FlyingMascotSprite } from './FlyingMascotSprite';

export const LoadingScreen = () => (
  <div className="fixed inset-0 z-[10000] bg-paper flex flex-col items-center justify-center w-full h-full">
    <div className="paper-texture" />
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative flex w-full max-w-4xl flex-col items-center justify-center overflow-hidden px-4">
      <div className="relative h-36 w-full overflow-hidden md:h-44">
        <motion.div animate={{ x: ['-28vw', '28vw'], y: [8, -8, 8] }} transition={{ duration: 2.8, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
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
