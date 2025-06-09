
import type { CardData, CardEffect, PlayerStatType, CardTier } from '@/types';
import { PlayerStatType as PStats, LIFE_STEAL_VALUE_PERCENT, CardTier as CTier, MAX_TURRETS } from '@/types';

function getRandomInt(min: number, max: number): number {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomFloat(min: number, max: number, decimals: number = 1): number {
  const str = (Math.random() * (max - min) + min).toFixed(decimals);
  return parseFloat(str);
}

interface StatDefinition {
  type: PlayerStatType;
  descriptionFormat: (value: number) => string;
  valueGenerator: () => number;
  isPercentage?: boolean;
  maxStacks?: number; // Max times this specific stat TYPE can be applied (e.g. shield charges)
  tierRestriction?: CardTier[]; // If present, this stat can only appear on cards of these tiers
}

const STAT_DEFINITIONS: StatDefinition[] = [
  { type: PStats.AttackSpeedPercent, descriptionFormat: (val) => `+${val}% Attack Speed`, valueGenerator: () => getRandomInt(5, 15), isPercentage: true },
  { type: PStats.Power, descriptionFormat: (val) => `+${val} Projectile Power`, valueGenerator: () => getRandomFloat(0.5, 1.5, 1) },
  { type: PStats.CritChancePercent, descriptionFormat: (val) => `+${val}% Crit Chance`, valueGenerator: () => getRandomInt(3, 10), isPercentage: true },
  { type: PStats.CritDamageMultiplierPercent, descriptionFormat: (val) => `+${val}% Crit Damage`, valueGenerator: () => getRandomInt(10, 30), isPercentage: true },
  { type: PStats.BurnChancePercent, descriptionFormat: (val) => `+${val}% Burn Chance`, valueGenerator: () => getRandomInt(5, 15), isPercentage: true },
  { type: PStats.FreezeChancePercent, descriptionFormat: (val) => `+${val}% Freeze Chance`, valueGenerator: () => getRandomInt(5, 15), isPercentage: true },
  { type: PStats.StunChancePercent, descriptionFormat: (val) => `+${val}% Stun Chance (Thunder)`, valueGenerator: () => getRandomInt(3, 10), isPercentage: true },
  { type: PStats.ChainLightningChancePercent, descriptionFormat: (val) => `+${val}% Chain Lightning (Thunder)`, valueGenerator: () => getRandomInt(3, 10), isPercentage: true },
  { type: PStats.PoisonChancePercent, descriptionFormat: (val) => `+${val}% Poison Chance`, valueGenerator: () => getRandomInt(5, 15), isPercentage: true },
  { type: PStats.ProjectileScalePercent, descriptionFormat: (val) => `+${val}% Projectile Size (Stackable)`, valueGenerator: () => 25, isPercentage: true, maxStacks: 5 },
  { type: PStats.ProjectileSpeedPercent, descriptionFormat: (val) => `+${val}% Projectile Speed (Stackable)`, valueGenerator: () => 5, isPercentage: true, maxStacks: 10 },
  { type: PStats.ShieldCharges, descriptionFormat: (val) => `+${val} Shield Charge (Stackable)`, valueGenerator: () => 1, maxStacks: 3 }, // Player starts with 1, can gain 2 more via cards.
  { type: PStats.MaxHealthPercent, descriptionFormat: (val) => `+${val}% Max Health`, valueGenerator: () => getRandomInt(5, 15), isPercentage: true },
  { type: PStats.LifeStealChancePercent, descriptionFormat: (val) => `+${val}% Life Steal (Heal ${LIFE_STEAL_VALUE_PERCENT}% of damage)`, valueGenerator: () => getRandomInt(3, 10), isPercentage: true },
  { type: PStats.ConvertEnemyChancePercent, descriptionFormat: (val) => `+${val}% Convert Enemy (Max 2 stacks)`, valueGenerator: () => getRandomInt(1, 2), isPercentage: true, maxStacks: 2 },
  { type: PStats.DashAttackDamage, descriptionFormat: (val) => `Embestida: El Dash inflige ${val} de daño.`, valueGenerator: () => getRandomInt(15, 30), tierRestriction: [CTier.RARE, CTier.EPIC] },
  // TurretCount is handled specially for card generation.
];

const TIER_CONFIG = {
  [CTier.COMMON]: { count: 18, effects: 1, description: "A common scrap artifact with a minor enhancement." },
  [CTier.RARE]: { count: 13, effects: 2, description: "A rare scrap artifact offering a combination of upgrades." },
  [CTier.EPIC]: { count: 8, effects: 3, description: "An epic scrap artifact, pulsing with significant power." }, // Reduced to make space for Turret cards
  [CTier.LEGENDARY]: { count: 5, effects: 3, description: "A legendary scrap artifact, a true game changer." },
};

// Special card definitions
const SPECIAL_CARDS: CardData[] = [
  {
    id: 'card-epic-turret-1',
    name: 'Torreta Desplegable I',
    description: 'Un sistema de torreta autónoma. Se monta sobre la nave. Máximo 2 torretas.',
    effects: [{ stat: PStats.TurretCount, value: 1, description: 'Despliega una torreta automatizada.' }],
    tier: CTier.EPIC,
  },
  {
    id: 'card-epic-turret-2', // Identical effect, but allows stacking up to MAX_TURRETS
    name: 'Torreta Desplegable II',
    description: 'Un sistema de torreta autónoma adicional. Se monta debajo de la nave. Máximo 2 torretas.',
    effects: [{ stat: PStats.TurretCount, value: 1, description: 'Despliega una segunda torreta automatizada.' }],
    tier: CTier.EPIC,
  },
];


function generateEffects(numEffects: number, currentTier: CardTier, availableStats: StatDefinition[]): CardEffect[] {
  const effects: CardEffect[] = [];
  const selectedStatIndices = new Set<number>();
  
  const filteredStats = availableStats.filter(statDef => 
    !statDef.tierRestriction || statDef.tierRestriction.includes(currentTier)
  );

  if (filteredStats.length < numEffects) {
    console.warn(`Not enough unique stat definitions (${filteredStats.length}) for tier ${CTier[currentTier]} to generate ${numEffects} distinct effects.`);
  }

  for (let i = 0; i < numEffects; i++) {
    if (selectedStatIndices.size >= filteredStats.length && i < numEffects) {
      break; 
    }

    let statIndexInFilteredArray: number;
    let originalStatDef: StatDefinition;
    
    do {
      statIndexInFilteredArray = getRandomInt(0, filteredStats.length - 1);
      originalStatDef = filteredStats[statIndexInFilteredArray];
      // Check if this stat type has already been added using its original index in STAT_DEFINITIONS if needed
      // For simplicity, we'll just ensure the StatDefinition object itself is unique for this card.
    } while (selectedStatIndices.has(STAT_DEFINITIONS.indexOf(originalStatDef)) && selectedStatIndices.size < filteredStats.length);
    
    selectedStatIndices.add(STAT_DEFINITIONS.indexOf(originalStatDef));
    
    const value = originalStatDef.valueGenerator();
    effects.push({
      stat: originalStatDef.type,
      value: value,
      description: originalStatDef.descriptionFormat(value),
    });
  }
  return effects;
}

export function generateCardPool(): CardData[] {
  const cardPool: CardData[] = [];
  let cardIdCounter = 0;

  (Object.keys(TIER_CONFIG) as unknown as Array<keyof typeof TIER_CONFIG>).forEach(tierKey => {
    const config = TIER_CONFIG[tierKey];
    for (let i = 0; i < config.count; i++) {
      let effects = generateEffects(config.effects, tierKey, STAT_DEFINITIONS);
      if (effects.length === 0 && config.effects > 0) {
          console.warn(`Could not generate effects for a card of tier ${CTier[tierKey]}`);
          continue;
      }

      if (tierKey === CTier.LEGENDARY && effects.length === 3) {
        const effectIndices = [0, 1, 2];
        for (let k = effectIndices.length - 1; k > 0; k--) {
          const j = Math.floor(Math.random() * (k + 1));
          [effectIndices[k], effectIndices[j]] = [effectIndices[j], effectIndices[k]];
        }
        const indicesToBoost = [effectIndices[0], effectIndices[1]];
        indicesToBoost.forEach(indexToBoost => {
          const effectToBoost = effects[indexToBoost];
          const originalStatDef = STAT_DEFINITIONS.find(sd => sd.type === effectToBoost.stat);
          if (originalStatDef) {
            effectToBoost.value = Math.round(effectToBoost.value * 4); // Ensure integer if it was, or round float
            effectToBoost.description = originalStatDef.descriptionFormat(effectToBoost.value);
          }
        });
      }
      
      cardPool.push({
        id: `card-${CTier[tierKey].toLowerCase()}-${cardIdCounter++}`,
        name: `${CTier[tierKey].charAt(0) + CTier[tierKey].slice(1).toLowerCase()} Artifact`,
        description: config.description,
        effects: effects,
        tier: tierKey,
      });
    }
  });

  // Add special Turret cards
  cardPool.push(...SPECIAL_CARDS.map(card => ({ ...card, id: `${card.id}-${cardIdCounter++}` })));


  for (let i = cardPool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cardPool[i], cardPool[j]] = [cardPool[j], cardPool[i]];
  }
  
  // The total number of cards is TIER_CONFIG sums + SPECIAL_CARDS.length.
  // Aim for roughly 50 cards.
  // Current TIER_CONFIG sum: 18 (C) + 13 (R) + 8 (E) + 5 (L) = 44
  // Plus 2 Turret cards = 46. This is close enough to 50.
  
  return cardPool;
}
