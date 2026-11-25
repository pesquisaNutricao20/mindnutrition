import { motion } from 'motion/react';

// Planta da jornada: cresce conforme os dias concluídos — caule mais alto,
// folhas novas a cada ~3 dias e flor a partir de 15 dias (jardim florescendo).
export const ChallengePlant = ({ completedDays }: { completedDays: number }) => {
  const days = Math.min(21, Math.max(0, Math.round(completedDays)));
  const progress = days / 21;
  const baseY = 134;
  const stemH = 8 + progress * 90;
  const topY = baseY - stemH;
  const leafCount = days <= 0 ? 0 : Math.min(7, Math.ceil(days / 3));
  const bloomed = days >= 15;

  const leaves = Array.from({ length: leafCount }, (_, i) => {
    const t = leafCount === 1 ? 0.5 : 0.28 + (i / (leafCount - 1)) * 0.58;
    const y = baseY - stemH * t;
    const side = i % 2 === 0 ? -1 : 1;
    const size = 6.5 + (1 - t) * 6.5;
    const cx = 100 + side * (size + 3);
    return { key: i, y, side, size, cx };
  });

  return (
    <svg viewBox="42 0 116 170" className="w-40 shrink-0 sm:w-48" role="img" aria-label={`Planta da jornada com ${days} dias concluídos`}>
      {/* Terra: meio círculo com textura */}
      <path d="M60 170 A40 40 0 0 1 140 170 Z" fill="#8a5a3b" />
      {[
        [78, 156, 2], [88, 164, 1.7], [96, 150, 2], [104, 160, 2.2], [112, 150, 1.8],
        [120, 160, 2], [84, 145, 1.5], [108, 142, 1.6], [96, 166, 1.8], [126, 153, 1.6],
      ].map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="#6d4327" opacity={0.55} />
      ))}

      {days === 0 ? (
        // Semente ainda na terra
        <ellipse cx={100} cy={129} rx={5} ry={3.4} fill="#a97c50" />
      ) : (
        <>
          <motion.path
            d={`M100 ${baseY} C ${96} ${baseY - stemH * 0.35} ${104} ${baseY - stemH * 0.68} 100 ${topY}`}
            stroke="#5f9e5f"
            strokeWidth={3.5}
            strokeLinecap="round"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
          />
          {leaves.map((leaf) => (
            <motion.g
              key={leaf.key}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.05 * leaf.key }}
              style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
            >
              <ellipse
                cx={leaf.cx}
                cy={leaf.y - 3}
                rx={leaf.size}
                ry={leaf.size * 0.42}
                transform={`rotate(${leaf.side * 24} ${leaf.cx} ${leaf.y - 3})`}
                fill={leaf.key % 2 === 0 ? '#6fbf73' : '#5da35f'}
              />
            </motion.g>
          ))}
          {bloomed && (
            <motion.g
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 240, damping: 14, delay: 0.4 }}
              style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
            >
              {[0, 72, 144, 216, 288].map((angle) => {
                const rad = (angle * Math.PI) / 180;
                return (
                  <circle key={angle} cx={100 + Math.cos(rad) * 5.5} cy={topY - 8 + Math.sin(rad) * 5.5} r={3.4} fill="#f2b8cd" />
                );
              })}
              <circle cx={100} cy={topY - 8} r={3} fill="#f7d774" />
            </motion.g>
          )}
        </>
      )}
    </svg>
  );
};
