
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

const SPRITE_SHEET_URL = "/textures/SHIPROTATE.png";
const SPRITE_SHEET_WIDTH = 2880; 

const SPRITE_COLS = 10;
const SPRITE_ROWS = 6;
const TOTAL_FRAMES = 60; 
const FPS = 24;
const FRAME_INTERVAL = 1000 / FPS;

const FRAME_WIDTH = SPRITE_SHEET_WIDTH / SPRITE_COLS; // 288px
const FRAME_HEIGHT = 162; // Corrected frame height

interface PauseMenuShipDisplayProps {
  // No props needed for this version
}

const PauseMenuShipDisplay: React.FC<PauseMenuShipDisplayProps> = () => {
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [spriteSheetLoaded, setSpriteSheetLoaded] = useState(false);

  // Preload the sprite sheet
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError(null);

    const img = new window.Image();
    img.src = SPRITE_SHEET_URL;

    img.onload = () => {
      if (isMounted) {
        setSpriteSheetLoaded(true);
        setIsLoading(false);
      }
    };

    img.onerror = () => {
      if (isMounted) {
        setError(`Failed to load sprite sheet: ${SPRITE_SHEET_URL}`);
        setIsLoading(false);
      }
    };
    
    return () => {
      isMounted = false;
    };
  }, []); 

  // Animation loop
  useEffect(() => {
    if (!spriteSheetLoaded || isLoading || error) return;

    const intervalId = setInterval(() => {
      setCurrentFrame((prevFrame) => (prevFrame + 1) % TOTAL_FRAMES);
    }, FRAME_INTERVAL);

    return () => clearInterval(intervalId);
  }, [spriteSheetLoaded, isLoading, error]); 

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
        Precargando secuencia de nave...
      </div>
    );
  }

  if (error) { 
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-sm">
        <p className="text-destructive mb-2">{error}</p>
      </div>
    );
  }

  if (!spriteSheetLoaded) {
    return (
        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
            Sprite sheet not available.
        </div>
    );
  }
  
  const backgroundPositionX = -(currentFrame % SPRITE_COLS) * FRAME_WIDTH;
  const backgroundPositionY = -Math.floor(currentFrame / SPRITE_COLS) * FRAME_HEIGHT;

  return (
    <div className="w-full h-full flex items-center justify-center p-4 relative"> {/* Added relative */}
      {/* White Noise GIF Overlay - covers the entire PauseMenuShipDisplay area */}
      <div
        className="absolute inset-0 white-noise-overlay"
        style={{
          backgroundImage: `url(/textures/White-noise.gif)`,
          backgroundSize: 'cover',
          opacity: 0.08, 
          mixBlendMode: 'screen',
          pointerEvents: 'none',
          zIndex: 2, // Above the ship container
        }}
      />
      {/* Container for the ship sprite and its specific gradient overlay */}
      <div
        className="relative" 
        style={{
          width: `${FRAME_WIDTH}px`,
          height: `${FRAME_HEIGHT}px`,
          zIndex: 1, // Below the main white noise overlay
        }}
      >
        {/* Ship Sprite Animation */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${SPRITE_SHEET_URL})`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: `${backgroundPositionX}px ${backgroundPositionY}px`,
            imageRendering: 'pixelated', 
          }}
          role="img"
          aria-label={`Ship animation frame ${currentFrame + 1}`}
        />

        {/* Animated Gradient Overlay - specific to the ship */}
        <div
          className="absolute inset-0 animated-gradient-overlay"
          style={{ opacity: 0.15 }} 
        />
      </div>
    </div>
  );
};

export default PauseMenuShipDisplay;
