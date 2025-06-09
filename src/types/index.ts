
export interface HighScoreEntry {
  score: number;
  date: string;
}

export enum EnemyType {
  SPHERE,
  CUBE,    // Moves in ZigZag
  PYRAMID, // Moves slowly and shoots
  BOSS_PYRAMID_MK1, // New Boss Type
  RHOMBUS, // World 2: Straight line, spawns in a group
  DOUBLE_SPHERE, // World 2: Two spheres, shoots 3 rapid projectiles
  HEXAGON, // World 2: Heals other enemies
}

export enum CardTier {
  COMMON,
  RARE,
  EPIC,
  LEGENDARY,
}

// Enum for the 6 main unlockable abilities/weapons
export enum UnlockableAbilityType {
  SUPER_LASER = 'UnlockSuperLaser',
  SPREAD_SHOTGUN = 'UnlockSpreadShotgun',
  I_AM_NUCLEAR = 'UnlockIAmNuclear',
  BACKWARDS_SHOT = 'UnlockBackwardsShot',
  BBP = 'UnlockBBP', // Big Black Projectile
  CRESCENT_MOON = 'UnlockCrescentMoon',
}


// Player Stats and Card System Types
export enum PlayerStatType {
  AttackSpeedPercent = 'AttackSpeedPercent', // Percentage increase
  Power = 'Power', // Flat damage increase to projectiles
  CritChancePercent = 'CritChancePercent', // Percentage chance
  CritDamageMultiplierPercent = 'CritDamageMultiplierPercent', // Percentage increase to crit damage
  
  BurnChancePercent = 'BurnChancePercent',
  BurnDamagePerTick = 'BurnDamagePerTick', // Flat damage per burn tick
  BurnDurationSeconds = 'BurnDurationSeconds',
  BurnTickIntervalSeconds = 'BurnTickIntervalSeconds',


  FreezeChancePercent = 'FreezeChancePercent',
  FreezeSlowPercent = 'FreezeSlowPercent', // e.g., 90 for 90% slow
  FreezeDurationSeconds = 'FreezeDurationSeconds',

  StunChancePercent = 'StunChancePercent', // For Thunder type damage
  StunDurationSeconds = 'StunDurationSeconds', // Duration of a single stun phase (active stun)
  StunIntervalSeconds = 'StunIntervalSeconds', // Duration of the "moving" phase between stuns
  StunTotalDebuffDurationSeconds = 'StunTotalDebuffDurationSeconds', // Total duration the stun debuff cycles

  ChainLightningChancePercent = 'ChainLightningChancePercent', // For Thunder type damage
  ChainLightningTargets = 'ChainLightningTargets', // Number of additional targets
  ChainLightningDamagePercentOfInitial = 'ChainLightningDamagePercentOfInitial', // e.g., 100 for 100%

  PoisonChancePercent = 'PoisonChancePercent',
  PoisonDamagePerTick = 'PoisonDamagePerTick', // Flat damage per poison tick
  PoisonTickIntervalSeconds = 'PoisonTickIntervalSeconds',
  PoisonDurationSeconds = 'PoisonDurationSeconds',

  ProjectileScalePercent = 'ProjectileScalePercent', // Percentage increase, stackable
  ProjectileSpeedPercent = 'ProjectileSpeedPercent', // Percentage increase, stackable
  
  ShieldCharges = 'ShieldCharges', // Number of hits absorbed
  ShieldDamageReductionPercent = 'ShieldDamageReductionPercent', // e.g., 20 for 20%

  MaxHealthPercent = 'MaxHealthPercent', // Percentage increase to player's max health
  LifeStealChancePercent = 'LifeStealChancePercent', // Chance to heal on hit
  LifeStealValuePercent = 'LifeStealValuePercent', // Percentage of damage dealt healed
  ConvertEnemyChancePercent = 'ConvertEnemyChancePercent', // Chance to convert an enemy on hit

  DashAttackDamage = 'DashAttackDamage', // Damage dealt by dashing through enemies
  TurretCount = 'TurretCount', // Number of active turrets

  // Types for unlocking base abilities from Tech Tree
  UnlockSuperLaser = 'UnlockSuperLaser',
  UnlockSpreadShotgun = 'UnlockSpreadShotgun',
  UnlockIAmNuclear = 'UnlockIAmNuclear',
  UnlockBackwardsShot = 'UnlockBackwardsShot',
  UnlockBBP = 'UnlockBBP',
  UnlockCrescentMoon = 'UnlockCrescentMoon',

  // Placeholder for future upgrade levels (example)
  // SuperLaserDamageLevel = 'SuperLaserDamageLevel',
}

export interface CardEffect {
  stat: PlayerStatType;
  value: number;
  description: string; // User-facing description of the effect part
}

export interface CardData {
  id: string;
  name: string; 
  description: string; 
  effects: CardEffect[]; 
  tier: CardTier;
  isSkillUnlock?: boolean; // True if this "card" is for unlocking a skill from tech tree
  skillToUnlock?: UnlockableAbilityType; // Which skill this card unlocks
  skillPointCost?: number; // Cost for this skill unlock
}


export interface EnemyGameData {
  health: number; 
  baseXP: number;
  collisionDamage: number;
  isBoss?: boolean; // Optional flag for bosses
  speed?: number;
  shootCooldown?: number; // Optional: for enemies that shoot
}

export const ENEMY_STATS: Record<EnemyType, EnemyGameData> = {
  [EnemyType.SPHERE]: { health: 12, baseXP: 2, collisionDamage: 15, speed: 0.025 },
  [EnemyType.CUBE]: { health: 1, baseXP: 3, collisionDamage: 25, speed: 0.015 },
  [EnemyType.PYRAMID]: { health: 25, baseXP: 4, collisionDamage: 35, speed: 0.0075 }, // Health 50 / 2 = 25
  [EnemyType.BOSS_PYRAMID_MK1]: { health: 1500, baseXP: 350, collisionDamage: 50, isBoss: true, speed: 0.0054 }, // Speed increased by 80% (0.003 * 1.8)
  [EnemyType.RHOMBUS]: { health: 10, baseXP: 5, collisionDamage: 20, speed: 0.02 },
  [EnemyType.DOUBLE_SPHERE]: { health: 20, baseXP: 6, collisionDamage: 18, speed: 0.022, shootCooldown: 1500 },
  [EnemyType.HEXAGON]: { health: 30, baseXP: 8, collisionDamage: 10, speed: 0.018, shootCooldown: 3000 }, // Healer, less collision damage
};

export type StatusEffectVisualType = 'poison' | 'freeze' | 'burn' | 'stun' | 'charmed';

export interface ActiveStatusEffect {
  type: PlayerStatType; 
  visualType: StatusEffectVisualType; 
  durationLeft: number; 
  damagePerTick?: number;
  tickInterval?: number;
  timeToNextTick?: number;
  slowFactor?: number; 
  totalStunDebuffDurationLeft?: number; 
  currentStunCycleDurationLeft?: number; 
  isInStunPhase?: boolean; 
  stunPhaseDuration?: number; 
  stunMoveIntervalDuration?: number; 
}

export const DOT_COLORS: Record<StatusEffectVisualType | 'crit' | 'hit' | 'heal', number> = {
  burn: 0xff7700,   
  poison: 0x00cc00, 
  stun: 0xffff00, 
  freeze: 0x00aaff, 
  charmed: 0xff69b4, 
  crit: 0xff3333,   
  hit: 0xffffff,
  heal: 0x33ff77, // Color for healing orbs/effects
};


export const PLAYER_INITIAL_PROJECTILE_DAMAGE = 5.0;
export const PLAYER_INITIAL_HEALTH = 250;
export const PLAYER_PROJECTILE_COLOR = 0x48BFE3; 
export const PYRAMID_PROJECTILE_DAMAGE = 25; 
export const BOSS_PROJECTILE_DAMAGE_MULTIPLIER = 1.5; 
export const LIFE_STEAL_VALUE_PERCENT = 25; 
export const MAX_TURRETS = 2;


export interface GameEvent {
  type: 'scoreUpdate' | 'levelUpCardSelection' | 'playerHealthUpdate' | 
        'bossSpawned' | 'bossDefeated' | 'bossHealthUpdate' |
        'specialAttackUpdate' | 'spreadShotgunTimerUpdate' | 'skillPointsUpdated'; // Added skillPointsUpdated
  score?: number;
  xpGained?: number;
  cardsForSelection?: CardData[]; // Can be regular cards or skill unlock "cards"
  health?: number; 
  maxHealth?: number;
  previousHealth?: number; 
  bossType?: EnemyType; 
  bossId?: string; 
  currentHealth?: number; 
  unlockedAbilities?: Record<UnlockableAbilityType, boolean>; // For special attack UI reflecting unlocked state
  spreadShotgunRemainingSeconds?: number; 
  availableSkillPoints?: number; // For UI updates
}

export enum BossAttackPattern {
  STANDARD_SHOT,
  RAPID_FIRE,
  SPREAD_SHOT,
  SPECIAL_BIG_SHOT,
  COOLDOWN, 
}

export interface ProjectileStatusEffectData {
    type: PlayerStatType; 
    duration: number;
    damagePerTick?: number; 
    tickInterval?: number; 
    slowFactor?: number; 
    stunPhaseDuration?: number; 
    stunMoveInterval?: number; 
    totalStunDuration?: number; 
}

export const BASE_XP_REQUIREMENT = 100;
export const XP_LEVEL_MULTIPLIER = 1.2;
    
