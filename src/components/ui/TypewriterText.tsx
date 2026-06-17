import { useEffect, useState } from 'react';

interface TypewriterTextProps {
  text: string;
  onComplete?: () => void;
}

export const TypewriterText = ({ text, onComplete }: TypewriterTextProps) => {
  const [displayed, setDisplayed] = useState('');

  useEffect(() => {
    let i = 0;
    setDisplayed('');
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(interval);
        onComplete?.();
      }
    }, 30);
    return () => clearInterval(interval);
  }, [text, onComplete]);

  return <span>{displayed}</span>;
};
