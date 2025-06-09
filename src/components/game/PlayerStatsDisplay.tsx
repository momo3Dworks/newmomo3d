
"use client";

import type { PlayerStatsManager } from "@/lib/game-logic/playerStatsManager";
import { PlayerStatType as PStats } from "@/types";
import { cn } from "@/lib/utils";
import {
  Zap, Shield, ChevronsUp, Percent, TrendingUp, Target, MinusCircle, Activity, Bot, PlusCircle, HeartPulse, HandHeart, Users, Sparkles, Swords, Gauge, Flame, Snowflake, Sigma, Link2, CircleSlash
} from "lucide-react";
import type React from 'react';

interface PlayerStatsDisplayProps {
  stats: PlayerStatsManager;
  className?: string;
}

const statIconMap: Record<string, { icon: React.ElementType, colorClass: string }> = {
  [PStats.Power]: { icon: TrendingUp, colorClass: "text-[hsl(var(--accent-orange))]" },
  [PStats.AttackSpeedPercent]: { icon: Zap, colorClass: "text-primary" },
  [PStats.CritChancePercent]: { icon: Target, colorClass: "text-[hsl(var(--accent-pink))]" },
  [PStats.CritDamageMultiplierPercent]: { icon: Percent, colorClass: "text-[hsl(var(--accent-pink))]" },
  [PStats.MaxHealthPercent]: { icon: HeartPulse, colorClass: "text-primary" },
  [PStats.ShieldCharges]: { icon: Shield, colorClass: "text-blue-400" }, // Specific blue for shields
  [PStats.ProjectileScalePercent]: { icon: PlusCircle, colorClass: "text-green-400" }, // Specific green
  [PStats.ProjectileSpeedPercent]: { icon: ChevronsUp, colorClass: "text-green-400" },
  [PStats.LifeStealChancePercent]: { icon: HandHeart, colorClass: "text-red-400" }, // Specific red for lifesteal
  [PStats.ConvertEnemyChancePercent]: { icon: Users, colorClass: "text-purple-400" }, // Specific purple
  [PStats.BurnChancePercent]: { icon: Flame, colorClass: "text-[hsl(var(--accent-orange))]" },
  [PStats.FreezeChancePercent]: { icon: Snowflake, colorClass: "text-blue-300" },
  [PStats.StunChancePercent]: { icon: CircleSlash, colorClass: "text-[hsl(var(--accent-yellow))]" },
  [PStats.ChainLightningChancePercent]: { icon: Link2, colorClass: "text-primary" },
  [PStats.PoisonChancePercent]: { icon: Bot, colorClass: "text-green-500" },
};

interface StatDisplayConfig {
  label: string;
  getValue: (stats: PlayerStatsManager) => number;
  formatter: (value: number) => string;
  iconInfo: { icon: React.ElementType, colorClass: string };
  statType: PStats;
}

const statsToDisplay: StatDisplayConfig[] = [
  { label: "Power", getValue: (s) => s.powerBonus, formatter: (v) => `+${v.toFixed(1)}`, iconInfo: statIconMap[PStats.Power], statType: PStats.Power },
  { label: "Atk Spd", getValue: (s) => s.attackSpeedBonusPercent, formatter: (v) => `+${v.toFixed(0)}%`, iconInfo: statIconMap[PStats.AttackSpeedPercent], statType: PStats.AttackSpeedPercent },
  { label: "Crit %", getValue: (s) => s.critChanceBonusPercent, formatter: (v) => `+${v.toFixed(0)}%`, iconInfo: statIconMap[PStats.CritChancePercent], statType: PStats.CritChancePercent },
  { label: "Crit Dmg", getValue: (s) => s.critDamageMultiplierBonusPercent, formatter: (v) => `+${v.toFixed(0)}%`, iconInfo: statIconMap[PStats.CritDamageMultiplierPercent], statType: PStats.CritDamageMultiplierPercent },
  { label: "Max HP", getValue: (s) => s.maxHealthBonusPercent, formatter: (v) => `+${v.toFixed(0)}%`, iconInfo: statIconMap[PStats.MaxHealthPercent], statType: PStats.MaxHealthPercent },
  { label: "Shields", getValue: (s) => s.shieldCharges, formatter: (v) => `${v}`, iconInfo: statIconMap[PStats.ShieldCharges], statType: PStats.ShieldCharges },
  { label: "Proj. Size", getValue: (s) => s.projectileScaleBonusPercent, formatter: (v) => `+${v.toFixed(0)}%`, iconInfo: statIconMap[PStats.ProjectileScalePercent], statType: PStats.ProjectileScalePercent },
  { label: "Proj. Spd", getValue: (s) => s.projectileSpeedBonusPercent, formatter: (v) => `+${v.toFixed(0)}%`, iconInfo: statIconMap[PStats.ProjectileSpeedPercent], statType: PStats.ProjectileSpeedPercent },
  { label: "Lifesteal", getValue: (s) => s.lifeStealChanceBonusPercent, formatter: (v) => `+${v.toFixed(0)}%`, iconInfo: statIconMap[PStats.LifeStealChancePercent], statType: PStats.LifeStealChancePercent },
  { label: "Convert", getValue: (s) => s.convertEnemyChanceBonusPercent, formatter: (v) => `+${v.toFixed(0)}%`, iconInfo: statIconMap[PStats.ConvertEnemyChancePercent], statType: PStats.ConvertEnemyChancePercent },
  { label: "Burn", getValue: (s) => s.burnChanceBonusPercent, formatter: (v) => `+${v.toFixed(0)}%`, iconInfo: statIconMap[PStats.BurnChancePercent], statType: PStats.BurnChancePercent },
  { label: "Freeze", getValue: (s) => s.freezeChanceBonusPercent, formatter: (v) => `+${v.toFixed(0)}%`, iconInfo: statIconMap[PStats.FreezeChancePercent], statType: PStats.FreezeChancePercent },
  { label: "Stun", getValue: (s) => s.stunChanceBonusPercent, formatter: (v) => `+${v.toFixed(0)}%`, iconInfo: statIconMap[PStats.StunChancePercent], statType: PStats.StunChancePercent },
  { label: "Chain", getValue: (s) => s.chainLightningChanceBonusPercent, formatter: (v) => `+${v.toFixed(0)}%`, iconInfo: statIconMap[PStats.ChainLightningChancePercent], statType: PStats.ChainLightningChancePercent },
  { label: "Poison", getValue: (s) => s.poisonChanceBonusPercent, formatter: (v) => `+${v.toFixed(0)}%`, iconInfo: statIconMap[PStats.PoisonChancePercent], statType: PStats.PoisonChancePercent },
];


export default function PlayerStatsDisplay({ stats, className }: PlayerStatsDisplayProps) {
  if (!stats) return null;

  const activeStats = statsToDisplay.filter(config => {
    const value = config.getValue(stats);
    // Shield charges start at 1, so we want to display it even if value is 1 (no bonus yet)
    if (config.statType === PStats.ShieldCharges) return true; 
    return typeof value === 'number' && value > 0;
  });

  if (activeStats.length === 0) return null;

  return (
    <div
        className={cn(
            "p-3 bg-card/80 backdrop-blur-sm rounded-sm border-2 border-[hsla(var(--primary-hsl),0.5)] shadow-lg flex flex-col gap-2 w-48",
            className
        )}
    >
      {activeStats.map((config) => {
        const value = config.getValue(stats);
        const Icon = config.iconInfo.icon || Sparkles;
        const iconColorClass = config.iconInfo.colorClass || "text-secondary";
        
        // For shield, display current value, not bonus
        const displayValue = config.statType === PStats.ShieldCharges ? stats.shieldCharges : value;
        const displayLabel = config.statType === PStats.ShieldCharges ? String(displayValue) : config.formatter(value);


        return (
          <div key={config.statType} 
               className="flex items-center gap-2 p-1 rounded-xs border border-[hsla(var(--border),0.2)] bg-background/30 tech-item-border"
               title={config.label}
          >
            <Icon className={cn("w-4 h-4 shrink-0", iconColorClass)} />
            <span className={cn("text-xs text-foreground/95 font-mono", iconColorClass)}>
              {displayLabel}
            </span>
            <span className="text-[0.65rem] text-muted-foreground truncate ml-auto">{config.label}</span>
          </div>
        );
      })}
    </div>
  );
}

    