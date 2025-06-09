
"use client";

import React from 'react';
import { cn } from '@/lib/utils';

interface LoadingScreenProps {
  progress: number; // 0 to 100
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ progress }) => {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm">
      <div className="relative w-36 h-36">
        <svg className="w-full h-full" viewBox="0 0 120 120">
          <circle
            className="text-muted"
            strokeWidth="8"
            stroke="currentColor"
            fill="transparent"
            r={radius}
            cx="60"
            cy="60"
          />
          <circle
            className="text-primary drop-shadow-[0_0_5px_hsl(var(--primary-hsl))]"
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            stroke="currentColor"
            fill="transparent"
            r={radius}
            cx="60"
            cy="60"
            transform="rotate(-90 60 60)"
            style={{ transition: 'stroke-dashoffset 0.15s linear' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-headline text-primary">
            {Math.round(progress)}%
          </span>
        </div>
      </div>
      <p className="mt-6 text-lg font-body text-muted-foreground animate-pulse">
        CALIBRATING SYSTEMS...
      </p>
    </div>
  );
};

export default LoadingScreen;
