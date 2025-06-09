
"use client";

import Image from 'next/image';
import React, { useRef, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

export interface PlayerAimEvent {
  x: number; // Normalized -1 to 1
  y: number; // Normalized -1 to 1
}

interface CrosshairAimProps {
  size?: number; // Overall size of the crosshair container
  pointerSize?: number; // Diameter of the circular pointer
  onAimChange?: (offset: PlayerAimEvent) => void;
  className?: string;
}

const CrosshairAim: React.FC<CrosshairAimProps> = ({
  size = 100,
  pointerSize = 10,
  onAimChange,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pointerPosition, setPointerPosition] = useState({ x: size / 2, y: size / 2 });

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      let x = event.clientX - rect.left;
      let y = event.clientY - rect.top;

      // Clamp pointer within bounds
      x = Math.max(pointerSize / 2, Math.min(x, size - pointerSize / 2));
      y = Math.max(pointerSize / 2, Math.min(y, size - pointerSize / 2));
      
      setPointerPosition({ x, y });

      if (onAimChange) {
        // Normalize coordinates to -1 to 1 range relative to center
        const normalizedX = (x - size / 2) / (size / 2 - pointerSize / 2);
        const normalizedY = (y - size / 2) / (size / 2 - pointerSize / 2);
        onAimChange({ x: normalizedX, y: normalizedY });
      }
    }
  };

  const handleMouseLeave = () => {
    setPointerPosition({ x: size / 2, y: size / 2 });
    if (onAimChange) {
      onAimChange({ x: 0, y: 0 }); // Reset aim to center
    }
  };

  // Effect to initially position pointer at center if size changes
  useEffect(() => {
    setPointerPosition({ x: size / 2, y: size / 2 });
  }, [size]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative rounded-full cursor-crosshair bg-transparent',
        className
      )}
      style={{ width: size, height: size }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <Image
        src="/textures/CROSSHAIR.png"
        alt="Crosshair"
        width={size}
        height={size}
        className="pointer-events-none select-none"
        unoptimized // For local static assets if not in public directory root for optimization
      />
      <div
        className="absolute bg-accent rounded-full pointer-events-none"
        style={{
          width: pointerSize,
          height: pointerSize,
          left: pointerPosition.x - pointerSize / 2,
          top: pointerPosition.y - pointerSize / 2,
          transform: 'translate(-0%, -0%)', // Correct for center alignment
          boxShadow: '0 0 5px hsl(var(--accent-hsl)), 0 0 8px hsl(var(--accent-hsl))',
        }}
      />
    </div>
  );
};

export default CrosshairAim;
