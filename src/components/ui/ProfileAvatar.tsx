import mascotAvatar from '../../assets/mascote_eyes_open.png';

interface ProfileAvatarProps {
  photo?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  mood?: string;
  className?: string;
}

export const ProfileAvatar = ({ photo, size = 'md', mood = 'Calmo', className = '' }: ProfileAvatarProps) => {
  const dimensions = size === 'xl' ? 'w-32 h-32' : size === 'lg' ? 'w-24 h-24' : size === 'md' ? 'w-12 h-12' : 'w-10 h-10';
  if (photo) {
    return <img src={photo} alt="" className={`${dimensions} rounded-full object-cover ${className}`} />;
  }
  return (
    <div
      aria-label="Foto de perfil padrão"
      className={`${dimensions} rounded-full overflow-hidden bg-gradient-to-br from-accent/15 via-white to-accent-pink/15 border border-line flex items-center justify-center ${className}`}
    >
      <img
        src={mascotAvatar}
        alt=""
        className="h-full w-full object-contain scale-110 translate-y-[6%]"
      />
    </div>
  );
};
