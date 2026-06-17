import { useRef, useState } from 'react';
import { motion } from 'motion/react';

interface HungerOdometerProps {
  value: number;
  onChange: (v: number) => void;
}

export const HungerOdometer = ({ value, onChange }: HungerOdometerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleUpdate = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    let x = clientX - rect.left;
    x = Math.max(0, Math.min(x, rect.width));
    onChange(Math.round((x / rect.width) * 10));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between label-sm">
        <span className="text-accent font-bold">Física</span>
        <span className="text-accent-pink font-bold">Emocional</span>
      </div>
      <div
        ref={containerRef}
        className="odometer-track"
        onPointerDown={(e) => {
          setIsDragging(true);
          handleUpdate(e.clientX);
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (isDragging) handleUpdate(e.clientX);
        }}
        onPointerUp={(e) => {
          setIsDragging(false);
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
      >
        <motion.div
          className="odometer-handle"
          animate={{ left: `${value * 10}%` }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        />
      </div>
      <div className="text-center serif-body text-3xl font-bold text-ink">
        {value}
      </div>
    </div>
  );
};
