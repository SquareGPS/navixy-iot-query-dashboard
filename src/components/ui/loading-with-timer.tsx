import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingWithTimerProps {
  message?: string;
  showTimer?: boolean;
}

export const LoadingWithTimer = ({ 
  message = 'Loading data...', 
  showTimer = true 
}: LoadingWithTimerProps) => {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!showTimer) return;
    
    const interval = setInterval(() => {
      setSeconds(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [showTimer]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 p-8">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <div className="text-center space-y-2">
        <p className="text-sm font-medium">{message}</p>
        {showTimer && seconds > 0 && (
          <p className="text-xs text-muted-foreground">
            {seconds} {seconds === 1 ? 'second' : 'seconds'}
          </p>
        )}
      </div>
    </div>
  );
};
