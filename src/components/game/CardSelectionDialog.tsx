
"use client";

import type { CardData, CardTier, UnlockableAbilityType as UAType } from "@/types";
import { CardTier as CTier, UnlockableAbilityType } from "@/types";
import { useState }  from "react";
import { PowerGlitch } from "powerglitch"; 
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card as UICard, CardHeader as UICardHeader, CardTitle as UICardTitle, CardDescription as UICardDescription, CardContent as UICardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Zap, Shield, ChevronsUp, Percent, TrendingUp, Target, ZapOff, MinusCircle, Activity, Bot, PlusCircle, HeartPulse, HandHeart, Users, Key, Settings2, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

interface CardSelectionDialogProps {
  isOpen: boolean;
  dialogMode: 'card' | 'techTree';
  cards: CardData[]; // Can be regular cards or skill unlock "cards"
  availableSkillPoints?: number;
  unlockedAbilities?: Record<UAType, boolean>;
  onCardSelect: (card: CardData) => void;
}

const statIcons: Record<string, React.ElementType> = {
  AttackSpeedPercent: Zap, Power: TrendingUp, CritChancePercent: Target, CritDamageMultiplierPercent: Percent,
  BurnChancePercent: Activity, FreezeChancePercent: MinusCircle, StunChancePercent: ZapOff, 
  ChainLightningChancePercent: Zap, PoisonChancePercent: Bot, ProjectileScalePercent: PlusCircle,
  ProjectileSpeedPercent: ChevronsUp, ShieldCharges: Shield, MaxHealthPercent: HeartPulse,
  LifeStealChancePercent: HandHeart, ConvertEnemyChancePercent: Users,
  // Placeholder for skill unlock icons
  [UnlockableAbilityType.SUPER_LASER]: Zap,
  [UnlockableAbilityType.SPREAD_SHOTGUN]: TrendingUp, // Replace with better icons
  [UnlockableAbilityType.I_AM_NUCLEAR]: Bot,
  [UnlockableAbilityType.BACKWARDS_SHOT]: ChevronsUp,
  [UnlockableAbilityType.BBP]: MinusCircle,
  [UnlockableAbilityType.CRESCENT_MOON]: Shield,
};

const tierStyles: Record<CardTier, { borderHslVar: string; shadowHslVar: string; nameColor: string; bgColor: string; }> = {
  [CTier.COMMON]: { borderHslVar: "var(--tier-common-glow-hsl)", shadowHslVar: "var(--tier-common-glow-hsl)", nameColor: "text-foreground/80", bgColor: "hsla(var(--card-hologram-bg-hsl), 0.7)" },
  [CTier.RARE]: { borderHslVar: "var(--tier-rare-glow-hsl)", shadowHslVar: "var(--tier-rare-glow-hsl)", nameColor: "text-[hsl(var(--tier-rare-glow-hsl))]", bgColor: "hsla(var(--tier-rare-glow-hsl), 0.15)" },
  [CTier.EPIC]: { borderHslVar: "var(--tier-epic-glow-hsl)", shadowHslVar: "var(--tier-epic-glow-hsl)", nameColor: "text-[hsl(var(--tier-epic-glow-hsl))]", bgColor: "hsla(var(--tier-epic-glow-hsl), 0.20)" },
  [CTier.LEGENDARY]: { borderHslVar: "var(--tier-legendary-glow-hsl)", shadowHslVar: "var(--tier-legendary-glow-hsl)", nameColor: "text-[hsl(var(--tier-legendary-glow-hsl))]", bgColor: "hsla(var(--tier-legendary-glow-hsl), 0.25)" },
};

const glitchOptions = { /* ... */ };

export default function CardSelectionDialog({
  isOpen,
  dialogMode,
  cards,
  availableSkillPoints = 0,
  unlockedAbilities = {} as Record<UAType, boolean>,
  onCardSelect,
}: CardSelectionDialogProps) {
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);

  if (!isOpen || cards.length === 0) {
    return null;
  }

  const isTechTreeMode = dialogMode === 'techTree';
  const dialogTitleText = isTechTreeMode ? "TECH TREE - ALLOCATE SKILL POINTS" : "SYSTEM UPGRADE PROTOCOL";
  const dialogDescriptionText = isTechTreeMode 
    ? `Available Skill Points: ${availableSkillPoints}. Select an ability to unlock.`
    : "Authorize one tactical enhancement module.";


  return (
    <Dialog open={isOpen} onOpenChange={() => { /* Modal, selection is mandatory */ }}>
      <DialogContent 
        className="UpgradePanel sm:max-w-5xl hud-panel-base p-0" 
        style={{ borderColor: `hsl(var(--primary-hsl))`, boxShadow: `0 0 15px hsl(var(--primary-hsl)), inset 0 0 10px hsla(var(--primary-hsl),0.3)`}}
        onInteractOutside={(e) => e.preventDefault()} 
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="p-6 pb-4 border-b" style={{borderColor: `hsla(var(--primary-hsl),0.3)`}}>
          <div className="flex items-center justify-center mb-2">
            {isTechTreeMode ? <Settings2 className="w-10 h-10 text-yellow-400 mr-3"/> : <Lightbulb className="w-10 h-10 text-primary mr-3"/>}
            <DialogTitle className="text-3xl font-headline text-center text-primary tracking-wider">{dialogTitleText}</DialogTitle>
          </div>
          <DialogDescription className="text-center text-md text-muted-foreground font-body">
            {dialogDescriptionText}
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[65vh]">
          <div className="CardContainer grid grid-cols-1 md:grid-cols-3 gap-6 p-6">
            {cards.map((card) => {
              const styles = tierStyles[card.tier] || tierStyles[CTier.COMMON];
              const isSkillAlreadyUnlocked = card.isSkillUnlock && card.skillToUnlock && unlockedAbilities[card.skillToUnlock];
              const canAffordSkill = card.isSkillUnlock && typeof card.skillPointCost === 'number' && availableSkillPoints >= card.skillPointCost;
              const isSelectable = isTechTreeMode ? !isSkillAlreadyUnlocked && canAffordSkill : true;

              return (
                <UICard 
                  key={card.id} 
                  className={cn(
                    "Card hologram-bg transition-all duration-200 ease-in-out flex flex-col justify-between rounded-sm border-2",
                    isSelectable ? "hover:scale-[1.02] cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background" : "opacity-50 cursor-not-allowed",
                  )}
                  style={{
                    borderColor: `hsl(${styles.borderHslVar})`,
                    backgroundColor: styles.bgColor,
                    boxShadow: hoveredCardId === card.id && isSelectable
                      ? `0 0 20px hsla(${styles.shadowHslVar}, 1), 0 0 30px hsla(${styles.shadowHslVar}, 0.8), inset 0 0 12px hsla(${styles.shadowHslVar},0.6)`
                      : `0 0 8px hsla(${styles.shadowHslVar}, 0.7), 0 0 12px hsla(${styles.shadowHslVar}, 0.5), inset 0 0 5px hsla(${styles.shadowHslVar},0.3)`,
                  }}
                  onClick={() => isSelectable && onCardSelect(card)}
                  onMouseEnter={(event: React.MouseEvent<HTMLDivElement>) => {
                    if (isSelectable) {
                      setHoveredCardId(card.id);
                      const cardElement = event.currentTarget;
                      if (cardElement) PowerGlitch.glitch(cardElement, { ...glitchOptions });
                    }
                  }}
                  onMouseLeave={() => { if (isSelectable) setHoveredCardId(null); }}
                  tabIndex={isSelectable ? 0 : -1} 
                  onKeyDown={(e) => { if (isSelectable && (e.key === 'Enter' || e.key === ' ')) onCardSelect(card); }}
                >
                  <div className="relative z-[1]"> 
                    <UICardHeader className="pb-3 text-center">
                      <UICardTitle className={cn("text-xl font-headline", styles.nameColor)}>{card.name}</UICardTitle>
                      <UICardDescription className="text-xs text-muted-foreground pt-1 px-2">
                        {card.isSkillUnlock && isSkillAlreadyUnlocked ? "Already Unlocked" : card.description}
                        {card.isSkillUnlock && !isSkillAlreadyUnlocked && !canAffordSkill && ` (Cost: ${card.skillPointCost} SP - Not enough points)`}
                        {card.isSkillUnlock && !isSkillAlreadyUnlocked && canAffordSkill && ` (Cost: ${card.skillPointCost} SP)`}
                      </UICardDescription>
                    </UICardHeader>
                    <UICardContent className="space-y-2 text-sm flex-grow flex flex-col justify-center px-4">
                      {card.effects.map((effect, effectIndex) => {
                        const Icon = statIcons[effect.stat] || TrendingUp;
                        return (
                          <div key={effectIndex} className="flex items-center">
                            <Icon className="w-4 h-4 mr-2 text-secondary shrink-0" />
                            <p className="font-body text-foreground/90">{effect.description}</p>
                          </div>
                        );
                      })}
                       {card.isSkillUnlock && card.skillToUnlock && (
                         <div className="flex items-center pt-2">
                           <Key className="w-4 h-4 mr-2 text-yellow-400 shrink-0" />
                           <p className="font-body text-yellow-400/90">Unlocks base ability.</p>
                         </div>
                       )}
                    </UICardContent>
                  </div>
                </UICard>
              );
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

    