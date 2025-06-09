
"use client";

import type { UnlockableAbilityType as UAType } from "@/types";
import { UnlockableAbilityType } from "@/types";
import { cn } from "@/lib/utils";
import { Zap, Bomb, VenetianMask, ArrowLeftRight, CircleDotDashed, ShieldHalf } from "lucide-react"; 
import React from "react";

interface SpecialAttacksDisplayProps {
  unlockedAbilities: Record<UAType, boolean>;
  spreadShotgunRemainingSeconds: number;
}

const SuperLaserIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12L22 12" strokeWidth="4"/>
    <path d="M5 12L3 10M5 12L3 14"/>
    <path d="M19 12L21 10M19 12L21 14"/>
    <path d="M8 9L7 7M10 15L9 17M16 8L17 6M14 16L15 18" strokeWidth="1.5"/>
  </svg>
);

const SpreadShotgunIcon = ({ remainingSeconds }: { remainingSeconds: number }) => (
  <div className="relative">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 15L4 20M12 15L6.5 19M12 15L9.25 17.5"/>
        <path d="M12 15L14.75 17.5M12 15L17.5 19M12 15L20 20"/>
        <rect x="10" y="3" width="4" height="12" rx="1" fill="currentColor" stroke="none"/>
    </svg>
    {remainingSeconds > 0 && (
      <div className="absolute -top-1 -right-1 bg-[hsl(var(--accent-yellow))] text-background text-[0.6rem] font-bold w-4 h-4 rounded-full flex items-center justify-center">
        {remainingSeconds}
      </div>
    )}
  </div>
);

const NuclearIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="1.5">
    <path d="M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2Z" fill="none"/>
    <path d="M9.17157 9.17157C10.7337 7.60948 13.2663 7.60948 14.8284 9.17157L17.6569 6.34315C14.5327 3.21895 9.46734 3.21895 6.34315 6.34315L9.17157 9.17157Z" fill="hsl(var(--accent-orange))" opacity="0.7"/>
    <path d="M6.34315 17.6569C3.21895 14.5327 3.21895 9.46734 6.34315 6.34315L9.17157 9.17157C7.60948 10.7337 7.60948 13.2663 9.17157 14.8284L6.34315 17.6569Z" fill="hsl(var(--accent-pink))" opacity="0.5"/>
    <path d="M14.8284 14.8284C13.2663 16.3905 10.7337 16.3905 9.17157 14.8284L6.34315 17.6569C9.46734 20.7811 14.5327 20.7811 17.6569 17.6569L14.8284 14.8284Z" fill="hsl(var(--accent-orange))" opacity="0.7"/>
    <path d="M17.6569 6.34315C20.7811 9.46734 20.7811 14.5327 17.6569 17.6569L14.8284 14.8284C16.3905 13.2663 16.3905 10.7337 14.8284 9.17157L17.6569 6.34315Z" fill="hsl(var(--accent-pink))" opacity="0.5"/>
    <circle cx="12" cy="12" r="2.5" fill="hsl(var(--primary-hsl))"/>
  </svg>
);

const BackwardsShotIcon = () => <ArrowLeftRight />;
const BBPIcon = () => <CircleDotDashed />; 
const CrescentMoonIcon = () => <ShieldHalf />; 

const abilityIcons: Record<UAType, React.ElementType | ((props: { remainingSeconds: number }) => JSX.Element)> = {
  [UnlockableAbilityType.SUPER_LASER]: SuperLaserIcon,
  [UnlockableAbilityType.SPREAD_SHOTGUN]: SpreadShotgunIcon,
  [UnlockableAbilityType.I_AM_NUCLEAR]: NuclearIcon,
  [UnlockableAbilityType.BACKWARDS_SHOT]: BackwardsShotIcon,
  [UnlockableAbilityType.BBP]: BBPIcon,
  [UnlockableAbilityType.CRESCENT_MOON]: CrescentMoonIcon,
};

const abilityOrder: UAType[] = [
    UnlockableAbilityType.SUPER_LASER,
    UnlockableAbilityType.SPREAD_SHOTGUN,
    UnlockableAbilityType.I_AM_NUCLEAR,
    UnlockableAbilityType.BACKWARDS_SHOT,
    UnlockableAbilityType.BBP,
    UnlockableAbilityType.CRESCENT_MOON,
];


export default function SpecialAttacksDisplay({
  unlockedAbilities,
  spreadShotgunRemainingSeconds,
}: SpecialAttacksDisplayProps) {

  const getIconForAbility = (abilityType: UAType) => {
    const IconComponent = abilityIcons[abilityType];
    if (abilityType === UnlockableAbilityType.SPREAD_SHOTGUN) {
        return React.createElement(IconComponent as ((props: { remainingSeconds: number }) => JSX.Element), { remainingSeconds: spreadShotgunRemainingSeconds });
    }
    return React.createElement(IconComponent as React.ElementType);
  };

  return (
    <div className="flex items-center gap-2 p-1 hud-panel-base bg-card/50 backdrop-blur-sm">
      {abilityOrder.map((abilityKey, index) => {
        const isUnlocked = unlockedAbilities[abilityKey];
        const isActiveShotgun = abilityKey === UnlockableAbilityType.SPREAD_SHOTGUN && spreadShotgunRemainingSeconds > 0;
        
        let borderColorClass = "border-muted/30";
        let textColorClass = "text-muted-foreground opacity-40";
        let bgColorClass = "bg-card/30";
        let boxShadow = "none";

        if (isUnlocked || isActiveShotgun) {
            borderColorClass = "border-primary";
            textColorClass = "text-primary opacity-100";
            bgColorClass = "bg-primary/10";
            boxShadow = "0 0 8px hsla(var(--primary-hsl), 0.6)";
            if (abilityKey === UnlockableAbilityType.SUPER_LASER) { textColorClass="text-[hsl(var(--accent-pink))]"; borderColorClass="border-[hsl(var(--accent-pink))]"; boxShadow = "0 0 8px hsla(var(--accent-pink),0.6)"; }
            if (abilityKey === UnlockableAbilityType.SPREAD_SHOTGUN) { textColorClass="text-[hsl(var(--accent-yellow))]"; borderColorClass="border-[hsl(var(--accent-yellow))]"; boxShadow = "0 0 8px hsla(var(--accent-yellow),0.6)"; }
            if (abilityKey === UnlockableAbilityType.I_AM_NUCLEAR) { textColorClass="text-[hsl(var(--accent-orange))]"; borderColorClass="border-[hsl(var(--accent-orange))]"; boxShadow = "0 0 8px hsla(var(--accent-orange),0.6)"; }
        }
        if (isActiveShotgun) {
            borderColorClass = "border-[hsl(var(--accent-yellow))] animate-pulse";
            boxShadow = "0 0 12px hsl(var(--accent-yellow))";
        }
        
        return (
            <div
              key={abilityKey}
              className={cn(
                  "w-8 h-8 md:w-9 md:h-9 p-1.5 rounded-sm border-2 flex items-center justify-center cursor-default transition-all duration-200",
                  bgColorClass,
                  borderColorClass,
                  textColorClass
              )}
              style={{boxShadow: boxShadow}}
              title={isUnlocked ? `${abilityKey.replace('Unlock', '').replace(/([A-Z])/g, ' $1').trim()} (Key ${index + 1})` : `Locked (Key ${index + 1})`}
            >
              {getIconForAbility(abilityKey)}
            </div>
        );
    })}
    </div>
  );
}

    