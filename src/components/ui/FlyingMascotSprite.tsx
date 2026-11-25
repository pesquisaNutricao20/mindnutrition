import spriteSheet from '../../assets/spritesheet-mascote.png';

export type MascotAnimation = 'idle' | 'flying' | 'maneuver' | 'thinking' | 'talking';

// 5 linhas por evento (na ordem) x 8 quadros por linha.
const ROWS: Record<MascotAnimation, number> = {
  idle: 0,
  flying: 1,
  maneuver: 2,
  thinking: 3,
  talking: 4,
};

const DURATIONS: Record<MascotAnimation, string> = {
  idle: '2.4s',
  flying: '1.6s',
  maneuver: '1.4s',
  thinking: '2.8s',
  talking: '2s',
};

interface FlyingMascotSpriteProps {
  alt?: string;
  className?: string;
  animation?: MascotAnimation;
}

export function FlyingMascotSprite({
  alt = 'Mascote voando',
  className = 'w-40 h-40',
  animation = 'flying',
}: FlyingMascotSpriteProps) {
  return (
    <div
      role="img"
      aria-label={alt}
      className={`mascot-sprite ${className}`}
      style={{
        backgroundImage: `url(${spriteSheet})`,
        backgroundPositionY: `${ROWS[animation] * 25}%`,
        animationDuration: DURATIONS[animation],
      }}
    />
  );
}
