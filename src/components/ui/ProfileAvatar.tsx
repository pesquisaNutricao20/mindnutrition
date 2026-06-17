import { Avatar } from './Avatar';

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
    <div className={`${dimensions} rounded-full overflow-hidden bg-paper ${className}`}>
      <Avatar size={size === 'xl' || size === 'lg' ? 'lg' : size === 'md' ? 'sm' : 'sm'} mood={mood} />
    </div>
  );
};
