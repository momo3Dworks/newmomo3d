
"use client";

import type { PlayerStatsManager } from "@/lib/game-logic/playerStatsManager";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PauseOctagon, Play, LogOut, VolumeX, Volume2, UserCircle, BarChart3, Zap, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import PlayerStatsDisplay from "./PlayerStatsDisplay";
import PauseMenuShipDisplay from "./PauseMenuShipDisplay"; // New component

interface PauseMenuDialogProps {
  isOpen: boolean;
  onResume: () => void;
  onQuit: () => void;
  isMusicPlaying: boolean;
  toggleMusicPlay: () => void;
  isMusicPlayerReady: boolean;
  playerHealth: number;
  playerMaxHealth: number;
  currentXP: number;
  xpToNextLevel: number;
  level: number;
  playerStats: PlayerStatsManager | null | undefined;
}

export default function PauseMenuDialog({
  isOpen,
  onResume,
  onQuit,
  isMusicPlaying,
  toggleMusicPlay,
  isMusicPlayerReady,
  playerHealth,
  playerMaxHealth,
  currentXP,
  xpToNextLevel,
  level,
  playerStats,
}: PauseMenuDialogProps) {
  const hudTextStyle = "text-xs font-headline text-primary tracking-wider uppercase";
  const hudValueStyle = "text-xs font-body text-foreground/80";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onResume(); }}>
      <DialogContent
        className={cn(
          "PausedM hud-panel-base p-0", // hud-panel-base for corner brackets
          "w-[98vw] h-[90vh] max-w-[98vw] max-h-[90vh] sm:w-[98vw] sm:h-[90vh] sm:max-w-[98vw]", // Size
          "bg-background/80 backdrop-blur-md flex flex-col" // Background and flex layout
        )}
        style={{
          borderColor: `hsl(var(--primary-hsl))`, // Border from theme
          boxShadow: `0 0 15px hsl(var(--primary-hsl)), inset 0 0 10px hsla(var(--primary-hsl),0.3)`,
        }}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="flex-shrink-0 p-4 border-b flex flex-row items-center justify-between" style={{borderColor: `hsla(var(--primary-hsl),0.3)`}}>
          <div className="flex items-center">
            <PauseOctagon className="w-8 h-8 text-primary mr-3 filter drop-shadow-[0_0_8px_hsl(var(--primary-hsl))]"/>
            <DialogTitle className="text-2xl font-headline text-primary tracking-wider uppercase">System Paused</DialogTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={toggleMusicPlay}
              variant="outline"
              size="sm"
              className="font-headline text-xs text-muted-foreground hover:bg-muted hover:text-foreground border-primary/40 hover:border-primary"
              disabled={!isMusicPlayerReady}
            >
              {isMusicPlaying ? <VolumeX className="mr-1.5 h-3.5 w-3.5" /> : <Volume2 className="mr-1.5 h-3.5 w-3.5" />}
              {isMusicPlaying ? "MUTE" : "UNMUTE"}
            </Button>
            <Button
              onClick={onResume}
              variant="outline"
              size="sm"
              className="font-headline text-xs bg-primary/20 hover:bg-primary/30 text-primary-foreground border-primary/40 hover:border-primary"
            >
              <Play className="mr-1.5 h-3.5 w-3.5" />
              RESUME
            </Button>
            <Button
              onClick={onQuit}
              variant="outline"
              size="sm"
              className="font-headline text-xs text-muted-foreground hover:bg-muted hover:text-foreground border-primary/40 hover:border-primary"
            >
              <LogOut className="mr-1.5 h-3.5 w-3.5" />
              EXIT
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-grow flex flex-col md:flex-row gap-4 p-4 overflow-y-auto">
          {/* Left Column: Ship Preview and Basic Info */}
          <div className="w-full md:w-1/3 flex flex-col gap-4 items-center p-2 rounded-sm border border-primary/20 bg-card/50">
            <div className="w-full h-64 md:h-auto md:flex-grow relative">
               <PauseMenuShipDisplay />
            </div>
            <div className="w-full space-y-2 p-2 rounded-sm border border-primary/10 bg-background/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center"> <Heart className="w-3 h-3 text-primary mr-1.5" /><span className={hudTextStyle}>Integrity:</span></div>
                <span className={hudValueStyle}>{playerHealth.toFixed(0)} / {playerMaxHealth.toFixed(0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center"> <Zap className="w-3 h-3 text-secondary mr-1.5" /><span className={hudTextStyle}>Experience:</span></div>
                <span className={hudValueStyle}>{currentXP.toFixed(0)} / {xpToNextLevel.toFixed(0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center"> <BarChart3 className="w-3 h-3 text-primary mr-1.5" /><span className={hudTextStyle}>Level:</span></div>
                <span className={hudValueStyle}>{level}</span>
              </div>
            </div>
          </div>

          {/* Right Column: Player Stats */}
          <div className="w-full md:w-2/3 flex flex-col p-2 rounded-sm border border-primary/20 bg-card/50">
             <h3 className="text-lg font-headline text-center mb-3 text-primary tracking-wide uppercase">Tactical Enhancements</h3>
            {playerStats ? (
              <div className="overflow-y-auto pr-2">
                <PlayerStatsDisplay stats={playerStats} className="bg-transparent border-none shadow-none p-0 w-full grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2" />
              </div>
            ) : (
              <p className="text-center text-muted-foreground">Stats unavailable.</p>
            )}
          </div>
        </div>
        
        {/* Footer can be removed or used for other elements if needed */}
        {/* <DialogFooter className="p-4 border-t flex-shrink-0" style={{borderColor: `hsla(var(--primary-hsl),0.3)`}}>
        </DialogFooter> */}
      </DialogContent>
    </Dialog>
  );
}
