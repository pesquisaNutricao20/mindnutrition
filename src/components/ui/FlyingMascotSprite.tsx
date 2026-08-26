import mascoteFlying from '../../assets/mascote_flying.png';

interface FlyingMascotSpriteProps {
  alt?: string;
  className?: string;
}

export function FlyingMascotSprite({
  alt = 'Mascote voando',
  className = 'w-40 h-40 object-contain',
}: FlyingMascotSpriteProps) {
  return (
    <img src={mascoteFlying} alt={alt} className={className} draggable={false} />
  );
}
