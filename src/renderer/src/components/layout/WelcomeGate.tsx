import { useEffect, useState } from 'react';
import { WelcomeScreen } from '@/features/onboarding/WelcomeScreen';

interface WelcomeGateProps {
  children: React.ReactNode;
}

export function WelcomeGate({ children }: WelcomeGateProps) {
  const [welcomeCompleted, setWelcomeCompleted] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    // Check if welcome has been completed
    const completed = localStorage.getItem('archterm:welcome-completed');
    setWelcomeCompleted(!!completed);
  }, []);

  const handleComplete = () => {
    localStorage.setItem('archterm:welcome-completed', 'true');
    setWelcomeCompleted(true);
  };

  // Loading state
  if (welcomeCompleted === undefined) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  // Show welcome screen if not completed
  if (!welcomeCompleted) {
    return <WelcomeScreen onComplete={handleComplete} />;
  }

  // Show children if completed
  return <>{children}</>;
}
