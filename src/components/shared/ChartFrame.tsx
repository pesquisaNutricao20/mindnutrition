import React, { useLayoutEffect, useRef, useState } from 'react';

type ChartFrameProps = {
  className?: string;
  minHeight?: number;
  children: (size: { width: number; height: number }) => React.ReactNode;
};

export const ChartFrame = ({ className = 'h-64', minHeight = 180, children }: ChartFrameProps) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    let rafId = 0;
    const updateSize = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const rect = frame.getBoundingClientRect();
        const width = Math.floor(rect.width);
        const height = Math.max(Math.floor(rect.height), minHeight);
        setSize(prev => (prev.width === width && prev.height === height ? prev : { width, height }));
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(frame);
    window.addEventListener('resize', updateSize);

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, [minHeight]);

  return (
    <div ref={frameRef} className={`chart-frame ${className}`} style={{ minHeight }}>
      {size.width > 0 && size.height > 0 ? children(size) : (
        <div className="h-full min-h-[inherit] rounded-3xl bg-paper/70 animate-pulse" />
      )}
    </div>
  );
};
