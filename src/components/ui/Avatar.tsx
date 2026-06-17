interface AvatarProps {
  size?: 'sm' | 'md' | 'lg';
  mood?: string;
}

export const Avatar = ({ size = 'lg', mood = 'normal' }: AvatarProps) => {
  const dimensions = size === 'lg' ? 'w-32 h-32' : size === 'md' ? 'w-20 h-20' : 'w-12 h-12';
  return (
    <div className={`relative ${dimensions} transition-all duration-500`}>
      <div className="absolute inset-0 bg-accent/20 rounded-full blur-xl animate-pulse" />
      <svg viewBox="0 0 100 100" className="w-full h-full relative z-10 drop-shadow-xl">
        <circle cx="50" cy="50" r="45" fill="var(--paper)" stroke="var(--ink)" strokeWidth="3" />
        <circle cx="35" cy="40" r="5" fill="var(--ink)" />
        <circle cx="65" cy="40" r="5" fill="var(--ink)" />
        {mood === 'Calmo' || mood === 'Alegria' || mood === 'Euforia' ? (
          <path d="M 35 65 Q 50 75 65 65" fill="none" stroke="var(--ink)" strokeWidth="4" strokeLinecap="round" />
        ) : mood === 'Tenso' || mood === 'Frustração' || mood === 'Culpa' ? (
          <path d="M 35 70 Q 50 60 65 70" fill="none" stroke="var(--ink)" strokeWidth="4" strokeLinecap="round" />
        ) : (
          <path d="M 35 65 Q 50 68 65 65" fill="none" stroke="var(--ink)" strokeWidth="4" strokeLinecap="round" />
        )}
        <path d="M 15 25 Q 25 15 35 25" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
        <path d="M 85 25 Q 75 15 65 25" fill="none" stroke="var(--accent-pink)" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </div>
  );
};
