
"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import Game, { type GameEvent } from "@/lib/three/Game";
import GameOverDialog from "./GameOverDialog";
import PauseMenuDialog from "./PauseMenuDialog";
import CardSelectionDialog from "./CardSelectionDialog";
import PlayerStatsDisplay from "./PlayerStatsDisplay";
import SpecialAttacksDisplay from "./SpecialAttacksDisplay";
import LoadingScreen from "./LoadingScreen";
import type { HighScoreEntry, CardData, EnemyType, PlayerStatType, UnlockableAbilityType as UAType } from "@/types";
import { PLAYER_INITIAL_HEALTH, DOT_COLORS, UnlockableAbilityType, BASE_XP_REQUIREMENT, XP_LEVEL_MULTIPLIER } from "@/types";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Heart, Gamepad2, PauseOctagon, Play, Pause, Star, Zap, Sparkles, BarChart3, Cpu, Skull, Settings2, Volume2, VolumeX, Award, ChevronsUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { PowerGlitch } from 'powerglitch';


declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YTPlayerInstance {
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  setVolume: (volume: number) => void;
  getPlayerState: () => number;
  loadPlaylist: (options: { list: string; listType: string; index?: number; startSeconds?: number; suggestedQuality?: string }) => void;
  destroy: () => void;
  getIframe: () => HTMLIFrameElement;
}

const YTPlayerState = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
};

const MAX_HIGH_SCORES = 10;


const xpGainGlitchOptions = {
  playMode: "manual",
  timing: { duration: 250, iterations: 1 },
  glitchTimeSpan: { start: 0, end: 1 },
  shake: { velocity: 7, amplitudeX: 0.07, amplitudeY: 0.07 },
  slice: { count: 3, velocity: 7, minHeight: 0.01, maxHeight: 0.08, hueRotate: true },
  chromaticAberration: { strength: 1.5 },
};

const damageGlitchOptions = {
  playMode: "manual",
  timing: { duration: 400, iterations: 1 },
  glitchTimeSpan: { start: 0, end: 1 },
  shake: { velocity: 20, amplitudeX: 0.3, amplitudeY: 0.3 },
  slice: { count: 8, velocity: 20, minHeight: 0.02, maxHeight: 0.2, hueRotate: true },
  chromaticAberration: { strength: 8 },
};


export default function GameContainer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameInstanceRef = useRef<Game | null>(null);
  const [score, setScore] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [highScores, setHighScores] = useState<HighScoreEntry[]>([]);
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const [level, setLevel] = useState(0);
  const [currentXP, setCurrentXP] = useState(0);
  const [xpToNextLevel, setXpToNextLevel] = useState(BASE_XP_REQUIREMENT);

  const [playerHealth, setPlayerHealth] = useState(PLAYER_INITIAL_HEALTH);
  const [playerMaxHealth, setPlayerMaxHealth] = useState(PLAYER_INITIAL_HEALTH);

  const [showCardSelectionDialog, setShowCardSelectionDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState<'card' | 'techTree'>('card');
  const [cardsForDialog, setCardsForDialog] = useState<CardData[]>([]);
  const [availableSkillPoints, setAvailableSkillPoints] = useState(0);


  const healthBarRef = useRef<HTMLDivElement>(null);
  const xpBarRef = useRef<HTMLDivElement>(null);
  const [isHealthBarEffectActive, setIsHealthBarEffectActive] = useState(false);
  const [isXpBarEffectActive, setIsXpBarEffectActive] = useState(false);
  const [statsVersion, setStatsVersion] = useState(0);
  const [cardsAppliedCount, setCardsAppliedCount] = useState(0);

  const [isBossFightActive, setIsBossFightActive] = useState(false);
  const [currentBossType, setCurrentBossType] = useState<EnemyType | null>(null);
  const [bossWarningOpacity, setBossWarningOpacity] = useState(0);
  const activeBossIdRef = useRef<string | null>(null);


  const [displayBossHealth, setDisplayBossHealth] = useState(0);
  const [displayBossMaxHealth, setDisplayBossMaxHealth] = useState(0);


  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isGameInstanceReady, setIsGameInstanceReady] = useState(false);

  const youtubePlayerRef = useRef<YTPlayerInstance | null>(null);
  const [isYouTubeApiReady, setIsYouTubeApiReady] = useState(false);
  const [isMusicPlayerReady, setIsMusicPlayerReady] = useState(false);
  const [isMusicPlaying, setIsMusicPlaying] = useState(true);
  const playlistId = "PLFVqor0Nur9BbJsIfAx0FOQTogokTmm-m";

  const initialUnlockedAbilities: Record<UAType, boolean> = {
    [UnlockableAbilityType.SUPER_LASER]: false,
    [UnlockableAbilityType.SPREAD_SHOTGUN]: false,
    [UnlockableAbilityType.I_AM_NUCLEAR]: false,
    [UnlockableAbilityType.BACKWARDS_SHOT]: false,
    [UnlockableAbilityType.BBP]: false,
    [UnlockableAbilityType.CRESCENT_MOON]: false,
  };
  const [unlockedAbilities, setUnlockedAbilities] = useState<Record<UAType, boolean>>(initialUnlockedAbilities);
  const [spreadShotgunRemainingSeconds, setSpreadShotgunRemainingSeconds] = useState(0);


  useEffect(() => {
    if (!(window as any).onYouTubeIframeAPIReady) {
      (window as any).onYouTubeIframeAPIReady = () => {
        setIsYouTubeApiReady(true);
      };
    }
    if (window.YT && window.YT.Player) {
      setIsYouTubeApiReady(true);
    }
  }, []);

  useEffect(() => {
    if (!isYouTubeApiReady || youtubePlayerRef.current) {
      return;
    }
    const playerElementId = 'youtube-player-div';
    const onPlayerReady = (event: { target: YTPlayerInstance }) => {
      const player = event.target;
      player.setVolume(15);
      player.loadPlaylist({ list: playlistId, listType: 'playlist', index: 0, suggestedQuality: 'small', });
      setIsMusicPlayerReady(true);
    };
    if(document.getElementById(playerElementId)) {
        youtubePlayerRef.current = new window.YT.Player(playerElementId, {
        height: '1', width: '1', playerVars: { playsinline: 1, controls: 0, iv_load_policy: 3, modestbranding: 1, disablekb: 1, fs: 0, },
        events: { 'onReady': onPlayerReady, },
        });
    }
  }, [isYouTubeApiReady, playlistId]);

  useEffect(() => {
    if (isMusicPlayerReady && youtubePlayerRef.current) {
      if (isMusicPlaying) {
          setTimeout(() => youtubePlayerRef.current?.playVideo(), 500);
      } else {
          youtubePlayerRef.current.pauseVideo();
      }
    }
  }, [isMusicPlayerReady, isMusicPlaying]);


  const toggleMusicPlay = () => {
    if (youtubePlayerRef.current && isMusicPlayerReady) {
      const playerState = youtubePlayerRef.current.getPlayerState();
      if (playerState === YTPlayerState.PLAYING || playerState === YTPlayerState.BUFFERING) {
        youtubePlayerRef.current.pauseVideo();
        setIsMusicPlaying(false);
      } else {
        youtubePlayerRef.current.playVideo();
        setIsMusicPlaying(true);
      }
    } else {
      setIsMusicPlaying(prev => !prev);
    }
  };


  const handleLoadingProgress = useCallback((progress: number) => {
    setLoadingProgress(progress);
  }, []);

  const handleLoadingComplete = useCallback(() => {
    setIsLoading(false);
    setIsGameInstanceReady(true);
    if (gameInstanceRef.current?.player) {
      setPlayerHealth(gameInstanceRef.current.player.health);
      setPlayerMaxHealth(gameInstanceRef.current.player.maxHealth);
      setUnlockedAbilities(gameInstanceRef.current.player.stats.getUnlockedAbilitiesStatus());
      setAvailableSkillPoints(gameInstanceRef.current.player.stats.availableSkillPoints);
      
    }
  }, []);


  const loadHighScores = useCallback(() => {
    try {
      const storedScores = localStorage.getItem("cosmicSkirmishHighScores");
      if (storedScores) setHighScores(JSON.parse(storedScores));
    } catch (error) { console.error("Failed to load high scores:", error); setHighScores([]); }
  }, []);

  const saveHighScore = useCallback((newScore: number) => {
    const newEntry: HighScoreEntry = { score: newScore, date: new Date().toISOString() };
    setHighScores(prevHighScores => {
      const updatedScores = [...prevHighScores, newEntry].sort((a, b) => b.score - a.score).slice(0, MAX_HIGH_SCORES);
      try { localStorage.setItem("cosmicSkirmishHighScores", JSON.stringify(updatedScores)); }
      catch (error) { console.error("Failed to save high score:", error); }
      return updatedScores;
    });
  }, []);

  const handleGameEvent = useCallback((event: GameEvent) => {
    if (event.type === 'scoreUpdate') {
      if (typeof event.score === 'number') setScore(event.score);
      if (typeof event.xpGained === 'number' && event.xpGained > 0) {
         setCurrentXP(prevXP => prevXP + (event.xpGained || 0));
      }
    } else if (event.type === 'levelUpCardSelection' && event.cardsForSelection) {
      setCardsForDialog(event.cardsForSelection);
      const isTechTree = event.cardsForSelection.some(card => card.isSkillUnlock);
      setDialogMode(isTechTree ? 'techTree' : 'card');
      setShowCardSelectionDialog(true);
      if (gameInstanceRef.current) gameInstanceRef.current.pauseGame(true);
    } else if (event.type === 'skillPointsUpdated' && typeof event.availableSkillPoints === 'number') {
      setAvailableSkillPoints(event.availableSkillPoints);
    } else if (event.type === 'playerHealthUpdate' && typeof event.health === 'number' && typeof event.maxHealth === 'number') {
      const damageTaken = typeof event.previousHealth === 'number' && event.health < event.previousHealth;
      setPlayerHealth(event.health);
      setPlayerMaxHealth(event.maxHealth);
      if (damageTaken && gameInstanceRef.current) {
        if (healthBarRef.current) {
          PowerGlitch.glitch(healthBarRef.current, damageGlitchOptions);
          setIsHealthBarEffectActive(true);
          setTimeout(() => setIsHealthBarEffectActive(false), 500);
        }
        gameInstanceRef.current.triggerCameraShake(0.2, 0.07);
        if (gameInstanceRef.current.player) {
          
        }
      }
    } else if (event.type === 'bossSpawned' && event.bossType) {
        setIsBossFightActive(true);
        setCurrentBossType(event.bossType);
        activeBossIdRef.current = event.bossId || null;
        if (typeof event.health === 'number' && typeof event.maxHealth === 'number') {
            setDisplayBossHealth(event.health);
            setDisplayBossMaxHealth(event.maxHealth);
        }
        setShowCardSelectionDialog(false);
        setBossWarningOpacity(1);
        setTimeout(() => setBossWarningOpacity(0), 4500);
    } else if (event.type === 'bossDefeated') {
        setIsBossFightActive(false);
        setCurrentBossType(null);
        activeBossIdRef.current = null;
    } else if (event.type === 'bossHealthUpdate' && event.bossId === activeBossIdRef.current) {
        if (typeof event.currentHealth === 'number') setDisplayBossHealth(event.currentHealth);
        if (typeof event.maxHealth === 'number') setDisplayBossMaxHealth(event.maxHealth);
    } else if (event.type === 'specialAttackUpdate' && event.unlockedAbilities) {
        setUnlockedAbilities({...event.unlockedAbilities});
    } else if (event.type === 'spreadShotgunTimerUpdate' && typeof event.spreadShotgunRemainingSeconds === 'number') {
        setSpreadShotgunRemainingSeconds(event.spreadShotgunRemainingSeconds);
    }
  }, []);

  

  useEffect(() => {
    if (
      isGameStarted &&
      !isGameOver &&
      !showCardSelectionDialog &&
      typeof currentXP === 'number' &&
      xpToNextLevel > 0 &&
      currentXP >= xpToNextLevel
    ) {
      const newLevel = level + 1;
      const newRemainingXP = currentXP - xpToNextLevel;
      const newNextXPGoal = BASE_XP_REQUIREMENT * Math.pow(XP_LEVEL_MULTIPLIER, newLevel);

      setLevel(newLevel);
      setCurrentXP(newRemainingXP);
      setXpToNextLevel(newNextXPGoal);

      if (gameInstanceRef.current) {
        gameInstanceRef.current.setPlayerLevel(newLevel);
      }

      if (xpBarRef.current) {
        PowerGlitch.glitch(xpBarRef.current, xpGainGlitchOptions);
        setIsXpBarEffectActive(true);
        setTimeout(() => setIsXpBarEffectActive(false), 300);
      }
    }
  }, [currentXP, level, xpToNextLevel, isGameStarted, isGameOver, showCardSelectionDialog]);

  const handleGameOverCallback = useCallback((finalScore: number) => {
    setIsGameOver(true);
    setIsGameStarted(false);
    setIsPaused(false);
    setShowCardSelectionDialog(false);
    setIsBossFightActive(false);
    setCurrentBossType(null);
    activeBossIdRef.current = null;
    setBossWarningOpacity(0);
    saveHighScore(finalScore);
  }, [saveHighScore]);

  useEffect(() => {
    loadHighScores();
    if (canvasRef.current && !gameInstanceRef.current) {
      const game = new Game(
        canvasRef.current,
        handleGameEvent,
        handleGameOverCallback,
        handleLoadingProgress,
        handleLoadingComplete
      );
      gameInstanceRef.current = game;
      if (canvasRef.current.parentElement) { game.handleResize(); }

      return () => {
        if (gameInstanceRef.current) { gameInstanceRef.current.dispose(); gameInstanceRef.current = null; }
        setIsGameInstanceReady(false);
      };
    }
  }, [handleGameEvent, handleGameOverCallback, loadHighScores, handleLoadingProgress, handleLoadingComplete]);

  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isGameStarted && !isGameOver && !showCardSelectionDialog) {
          setIsPaused(prevIsPaused => !prevIsPaused);
        }
      }
    };
    window.addEventListener('keydown', handleEscKey);
    return () => window.removeEventListener('keydown', handleEscKey);
  }, [isGameStarted, isGameOver, showCardSelectionDialog, isBossFightActive]);

  useEffect(() => {
    if (gameInstanceRef.current && isGameStarted && !isGameOver) {
      if (isPaused && !gameInstanceRef.current.isPausedForUpgrade) {
        if (!gameInstanceRef.current.isPaused) gameInstanceRef.current.pauseGame();
      } else if (!isPaused && gameInstanceRef.current.isPaused && !gameInstanceRef.current.isPausedForUpgrade) {
        gameInstanceRef.current.resumeGame();
      }
    }
  }, [isPaused, isGameStarted, isGameOver]);

  useEffect(() => {
    if (gameInstanceRef.current && isGameStarted && !isGameOver) {
      gameInstanceRef.current.updateCardSpawnModifier(cardsAppliedCount);
    }
  }, [cardsAppliedCount, isGameStarted, isGameOver]);

  const startGame = () => {
    if (gameInstanceRef.current && isGameInstanceReady) {
      const initialLevel = 0;
      setScore(0);
      setLevel(initialLevel);
      setCurrentXP(0);
      setXpToNextLevel(BASE_XP_REQUIREMENT);
      setIsGameOver(false);
      setIsPaused(false);
      setShowCardSelectionDialog(false);
      setIsBossFightActive(false);
      setCurrentBossType(null);
      setBossWarningOpacity(0);
      activeBossIdRef.current = null;
      setDisplayBossHealth(0);
      setDisplayBossMaxHealth(0);
      setStatsVersion(0);
      setCardsAppliedCount(0);
      setUnlockedAbilities(initialUnlockedAbilities);
      setSpreadShotgunRemainingSeconds(0);
      setAvailableSkillPoints(0);


      gameInstanceRef.current.setPlayerLevel(initialLevel);
      gameInstanceRef.current.updateCardSpawnModifier(0);
      setIsGameStarted(true);
      gameInstanceRef.current.startGame();

      if (youtubePlayerRef.current && isMusicPlayerReady) {
        youtubePlayerRef.current.loadPlaylist({ list: playlistId, listType: 'playlist', index: 0, suggestedQuality: 'small' });
        setTimeout(() => youtubePlayerRef.current?.playVideo(), 1000);
        setIsMusicPlaying(true);
      } else {
        setIsMusicPlaying(true);
      }
    }
  };

  const handlePlayAgain = () => {
    const initialLevel = 0;
    setIsGameOver(false);
    setIsPaused(false);
    setShowCardSelectionDialog(false);
    setIsBossFightActive(false);
    setCurrentBossType(null);
    setBossWarningOpacity(0);
    activeBossIdRef.current = null;
    setDisplayBossHealth(0);
    setDisplayBossMaxHealth(0);
    setLevel(initialLevel);
    setCurrentXP(0);
    setXpToNextLevel(BASE_XP_REQUIREMENT);
    setStatsVersion(0);
    setCardsAppliedCount(0);
    setUnlockedAbilities(initialUnlockedAbilities);
    setSpreadShotgunRemainingSeconds(0);
    setAvailableSkillPoints(0);
    if (gameInstanceRef.current && gameInstanceRef.current.player) {
      gameInstanceRef.current.setPlayerLevel(initialLevel);
      gameInstanceRef.current.updateCardSpawnModifier(0);
    }
    startGame();
  };

  const handleResumeGame = () => {
    setIsPaused(false);
  };

  const handleQuitToMainMenu = () => {
    setIsPaused(false);
    setShowCardSelectionDialog(false);
    setIsBossFightActive(false);
    setCurrentBossType(null);
    setBossWarningOpacity(0);
    activeBossIdRef.current = null;
    setDisplayBossHealth(0);
    setDisplayBossMaxHealth(0);
    setIsGameStarted(false);
    if (gameInstanceRef.current) gameInstanceRef.current.quitGame();
  };

  const handleCardSelectedFromDialog = (card: CardData) => {
    if (gameInstanceRef.current && gameInstanceRef.current.player) {
        gameInstanceRef.current.applyPlayerUpgrade(card);
        setStatsVersion(prev => prev + 1);
        if (!card.isSkillUnlock) {
            setCardsAppliedCount(prev => prev + 1);
        }
        setPlayerHealth(gameInstanceRef.current.player.health);
        setPlayerMaxHealth(gameInstanceRef.current.player.maxHealth);
        setUnlockedAbilities(gameInstanceRef.current.player.stats.getUnlockedAbilitiesStatus());
        setAvailableSkillPoints(gameInstanceRef.current.player.stats.availableSkillPoints);
    }
    setShowCardSelectionDialog(false);

    if (gameInstanceRef.current?.isPausedForUpgrade) {
        gameInstanceRef.current.resumeGame();
    }
  };


  const progressPercentage = xpToNextLevel > 0 ? (currentXP / xpToNextLevel) * 100 : 0;
  const healthPercentage = playerMaxHealth > 0 ? (playerHealth / playerMaxHealth) * 100 : 0;
  const bossHealthPercentage = displayBossMaxHealth > 0 ? (displayBossHealth / displayBossMaxHealth) * 100 : 0;


  const hudTextStyle = "text-xs font-headline text-primary tracking-wider uppercase";
  const hudValueStyle = "text-xs font-body text-foreground/80";


  return (
    <div className="relative w-full h-screen flex flex-col items-center justify-center bg-background overflow-hidden">
      <div id="youtube-player-div" style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px' }}></div>

      {isLoading && <LoadingScreen progress={loadingProgress} />}

      {!isLoading && !isGameStarted && isGameInstanceReady && !isGameOver && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm p-8">
           <svg viewBox="0 0 200 60" className="w-auto h-24 mb-3 text-primary filter drop-shadow-[0_0_12px_hsl(var(--primary-hsl))]">
            <text x="50%" y="50%" dy=".35em" textAnchor="middle" className="font-headline text-5xl fill-primary tracking-wider">
              COSMIC SKIRMISH
            </text>
          </svg>
          <p className="text-lg md:text-xl font-body text-center text-muted-foreground mb-10 max-w-md">
            Pilot your advanced spacecraft, assimilate alien technology, and dominate the cosmos.
          </p>
          <Button
            onClick={startGame}
            size="lg"
            className="font-headline text-xl px-8 py-6 bg-primary hover:bg-primary/90 text-primary-foreground rounded-sm border-2 border-primary/70 shadow-[0_0_10px_hsl(var(--primary-hsl)),inset_0_0_5px_hsla(var(--primary-hsl),0.3)]"
          >
            <Cpu className="mr-2 h-6 w-6" />
            ENGAGE
          </Button>
          <div className="mt-10 text-sm text-muted-foreground/70 font-body tracking-wider">
            CONTROLS: [WASD] MOVE /// [SPACE] FIRE /// [SHIFT] DASH /// [ESC] PAUSE /// [1,2,3] SPECIALS
          </div>
        </div>
      )}

      {isBossFightActive && (
        <div
          className={cn(
            "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[25vh] z-30",
            "p-4 bg-destructive/80 backdrop-blur-md rounded-sm border-2 border-destructive shadow-lg",
            "text-center",
            "transition-opacity duration-1000 ease-out",
            "hud-panel-base", 
            bossWarningOpacity === 1 && "animate-pulse"
          )}
          style={{
            borderColor: `hsl(var(--destructive-hsl))`, 
            boxShadow: `0 0 25px hsl(var(--destructive-hsl)), inset 0 0 15px hsla(var(--destructive-hsl),0.4)`,
            pointerEvents: bossWarningOpacity === 0 ? 'none' : 'auto'
          }}
        >
          <Skull className="w-12 h-12 text-destructive-foreground mx-auto mb-2 filter drop-shadow-[0_0_6px_#fff]"/>
          <h2 className="text-3xl font-headline text-destructive-foreground tracking-widest">WARNING: HOSTILE ENTITY</h2>
        </div>
      )}

      {isBossFightActive && activeBossIdRef.current && displayBossMaxHealth > 0 && (
         <div className="absolute top-4 left-1/2 -translate-x-1/2 w-1/2 min-w-[300px] max-w-lg z-20 p-2 hud-panel-base border-[hsl(var(--destructive-hsl))]" 
              style={{borderColor: 'hsl(var(--destructive-hsl))', boxShadow: '0 0 10px hsl(var(--destructive-hsl))'}}
         >
          <div className="text-center text-sm text-destructive-foreground mb-1 font-headline uppercase tracking-wider">TARGET INTEGRITY</div>
          <Progress value={bossHealthPercentage} className="h-2.5 progress-track [&>div]:bg-destructive [&>div]:shadow-[0_0_8px_hsl(var(--destructive-hsl))]" />
          <div className="text-center text-xs text-destructive-foreground/80 mt-0.5">{displayBossHealth.toFixed(0)} / {displayBossMaxHealth.toFixed(0)}</div>
        </div>
      )}


      {isGameStarted && !isGameOver && (
        <div className="absolute inset-0 z-10 pointer-events-none">
          
          <div className="absolute top-4 right-4 flex flex-col items-end gap-3 z-10">
            <div className="flex items-center gap-3">
              <div className={cn("hud-panel-base hud-panel-lines horizontal-lines px-5 py-2.5 pointer-events-auto bg-card/80")}>
                <p className="text-lg font-headline text-[hsl(var(--accent-orange))] tracking-wider flex items-center gap-2">
                  <Award className="w-5 h-5"/> SCORE: <span className="text-foreground font-bold">{score}</span>
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => setIsPaused(prev => !prev)}
                className={cn(
                  "hud-panel-base w-10 h-10 p-0 flex items-center justify-center hover:bg-card/95 text-primary pointer-events-auto",
                  showCardSelectionDialog && "hidden",
                  "border-primary hover:border-[hsl(var(--accent-orange))]"
                )}
                style={{borderColor: 'hsl(var(--primary-hsl))'}}
                aria-label={isPaused ? "Resume Simulation" : "Pause Simulation"}
                disabled={showCardSelectionDialog}
              >
                {isPaused ? <Play className="h-5 w-5" /> : <PauseOctagon className="h-5 w-5" />}
              </Button>
            </div>
            <div className={cn("hud-panel-base px-3 py-1.5 flex items-center gap-2 pointer-events-auto bg-card/70")}>
              <Button
                onClick={toggleMusicPlay}
                size="icon"
                variant="ghost"
                className="w-7 h-7 p-0 text-primary hover:bg-primary/10 hover:text-[hsl(var(--accent-pink))]"
                aria-label={isMusicPlaying ? "Pause Music" : "Play Music"}
                disabled={!isMusicPlayerReady}
              >
                {isMusicPlaying ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
              <span className="text-xs text-muted-foreground font-body">
                Music: <a
                  href="https://www.youtube.com/@JacobLizotte"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-[hsl(var(--accent-pink))] focus:text-[hsl(var(--accent-pink))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--accent-pink))] rounded-sm"
                >
                  J. Lizotte
                </a>
              </span>
            </div>
             { availableSkillPoints > 0 &&
                <div className={cn("hud-panel-base px-3 py-1.5 flex items-center gap-2 pointer-events-auto bg-card/70 border-[hsl(var(--accent-yellow))]")}
                     style={{borderColor: 'hsl(var(--accent-yellow))', boxShadow: '0 0 8px hsl(var(--accent-yellow))'}}
                >
                    <Settings2 className="h-4 w-4 text-[hsl(var(--accent-yellow))]" />
                    <span className="text-sm font-headline text-[hsl(var(--accent-yellow))] tracking-wider">
                        SKILL POINTS: {availableSkillPoints}
                    </span>
                </div>
            }
          </div>
          
          
          {gameInstanceRef.current?.player?.stats && (
            <PlayerStatsDisplay
              key={`stats-display-${statsVersion}`}
              stats={gameInstanceRef.current.player.stats}
              className="absolute top-4 left-4 z-10 pointer-events-auto hud-panel-base hud-panel-lines vertical-lines"
            />
          )}

          
          <div className="absolute bottom-4 left-0 right-0 flex flex-col items-center z-10 pointer-events-auto w-full">
            <div className="flex justify-between items-end w-full px-4">
                <div className="flex flex-col items-start gap-2">
                    <SpecialAttacksDisplay
                        unlockedAbilities={unlockedAbilities}
                        spreadShotgunRemainingSeconds={spreadShotgunRemainingSeconds}
                    />
                    <div
                        ref={healthBarRef}
                        className={cn(
                          "w-72 transition-all duration-100 stat-block-decoration hud-progress-bar",
                          isHealthBarEffectActive && "shake-effect glow-red-temporary"
                        )}
                         style={{borderColor: isHealthBarEffectActive ? 'hsl(var(--destructive-hsl))' : 'hsla(var(--primary-hsl), 0.4)'}}
                    >
                        <div className="flex justify-between items-center mb-1">
                            <div className="flex items-center">
                                <Heart className="w-3.5 h-3.5 text-primary mr-1.5" />
                                <span className={hudTextStyle}>Integrity</span>
                            </div>
                            <span className={hudValueStyle}>{Number.isNaN(playerHealth) ? '---' : playerHealth.toFixed(0)} / {Number.isNaN(playerMaxHealth) ? '---' : playerMaxHealth.toFixed(0)}</span>
                        </div>
                        <Progress value={Number.isNaN(healthPercentage) ? 0 : healthPercentage} className="h-2 progress-track [&>div]:progress-fill-health" />
                    </div>
                </div>
            </div>

            <div
              ref={xpBarRef}
              className={cn(
                "ExpBar w-full transition-all duration-100 mt-2 stat-block-decoration hud-progress-bar",
                isXpBarEffectActive && "shake-effect"
              )}
              style={{borderColor: 'hsla(var(--xp-bar-fill), 0.5)'}}
            >
              <div className="flex justify-between w-full items-center mb-1 px-4">
                  <div className="flex items-center">
                      <ChevronsUp className="w-3.5 h-3.5 text-[hsl(var(--xp-bar-fill))] mr-1.5" />
                      <p className={cn(hudTextStyle, "text-[hsl(var(--xp-bar-fill))]")}>Level: {level}</p>
                  </div>
                  <div className="flex items-center">
                       <Zap className="w-3.5 h-3.5 text-[hsl(var(--xp-bar-fill))] mr-1.5" />
                      <p className={cn(hudValueStyle, "text-foreground/70")}>{currentXP.toFixed(0)} / {xpToNextLevel.toFixed(0)} EXP</p>
                  </div>
              </div>
              <div className="w-full flex justify-center">
                <Progress
                    value={progressPercentage}
                    className="w-[97.8vw] h-2.5 progress-track [&>div]:progress-fill-xp"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className={cn("w-full h-full outline-none focus:outline-none", isLoading && "opacity-0")} />

      <GameOverDialog
        isOpen={isGameOver}
        score={score}
        highScores={highScores}
        onPlayAgain={handlePlayAgain}
      />

      <PauseMenuDialog
        isOpen={isPaused && isGameStarted && !isGameOver && !showCardSelectionDialog}
        onResume={handleResumeGame}
        onQuit={handleQuitToMainMenu}
        isMusicPlaying={isMusicPlaying}
        toggleMusicPlay={toggleMusicPlay}
        isMusicPlayerReady={isMusicPlayerReady}
        playerHealth={playerHealth}
        playerMaxHealth={playerMaxHealth}
        currentXP={currentXP}
        xpToNextLevel={xpToNextLevel}
        level={level}
        playerStats={gameInstanceRef.current?.player?.stats}
      />

      <CardSelectionDialog
        isOpen={showCardSelectionDialog && isGameStarted && !isGameOver}
        dialogMode={dialogMode}
        cards={cardsForDialog}
        availableSkillPoints={availableSkillPoints}
        unlockedAbilities={unlockedAbilities}
        onCardSelect={handleCardSelectedFromDialog}
      />
    </div>
  );
}

    