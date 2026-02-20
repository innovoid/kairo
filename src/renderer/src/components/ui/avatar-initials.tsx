import { cn } from '@/lib/utils';

interface AvatarInitialsProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function AvatarInitials({ name, size = 'md', className }: AvatarInitialsProps) {
  // Get initials from name
  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Generate consistent color from name hash
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const hue = hash % 360;
  const backgroundColor = `hsl(${hue}, 70%, 50%)`;

  const sizeClasses = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-16 w-16 text-lg'
  };

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-semibold text-white shrink-0',
        sizeClasses[size],
        className
      )}
      style={{ backgroundColor }}
    >
      {initials || '?'}
    </div>
  );
}
