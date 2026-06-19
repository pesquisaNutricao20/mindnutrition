import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import mascoteFlying from '../../assets/mascote_flying.png';
import mascoteFlying2 from '../../assets/mascote-azul/mascote_flying2.png';

interface FlyingMascotSpriteProps {
  alt?: string;
  className?: string;
  frameMs?: number;
}

export function FlyingMascotSprite({
  alt = 'Mascote voando',
  className = 'w-40 h-40 object-contain',
  frameMs = 420,
}: FlyingMascotSpriteProps) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setFrame(current => (current === 0 ? 1 : 0));
    }, frameMs);

    return () => window.clearInterval(intervalId);
  }, [frameMs]);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.img
        key={frame}
        src={frame === 0 ? mascoteFlying : mascoteFlying2}
        alt={alt}
        className={className}
        draggable={false}
        initial={{ opacity: 0.82 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0.82 }}
        transition={{ duration: 0.12 }}
      />
    </AnimatePresence>
  );
}
