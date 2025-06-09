
import type { CardData, CardEffect, PlayerStatType, UnlockableAbilityType } from '@/types';
import { PlayerStatType as PStats, PLAYER_INITIAL_PROJECTILE_DAMAGE, PLAYER_INITIAL_HEALTH, LIFE_STEAL_VALUE_PERCENT, MAX_TURRETS, UnlockableAbilityType as UAType } from '@/types';

const BASE_ATTACK_COOLDOWN_MS = 300; // Corresponds to player's shootCooldown

export class PlayerStatsManager {
  // Base Stats
  public baseProjectileDamage: number = PLAYER_INITIAL_PROJECTILE_DAMAGE;
  public baseAttackCooldownMs: number = BASE_ATTACK_COOLDOWN_MS;
  public baseCritChancePercent: number = 5; // Base 5% crit chance
  public baseCritDamageMultiplierPercent: number = 150; // Base 150% crit damage (meaning +50% damage)
  public baseProjectileScale: number = 1.0;
  public baseProjectileSpeed: number = 1.0;
  public baseMaxHealth: number = PLAYER_INITIAL_HEALTH;

  // Bonuses from Cards
  public powerBonus: number = 0;
  public attackSpeedBonusPercent: number = 0;
  public critChanceBonusPercent: number = 0;
  public critDamageMultiplierBonusPercent: number = 0;
  
  public burnChanceBonusPercent: number = 0;
  public burnDamagePerTick: number = 2; 
  public burnDurationSeconds: number = 3;
  public burnTickIntervalSeconds: number = 0.5;

  public freezeChanceBonusPercent: number = 0;
  public freezeSlowPercent: number = 90; 
  public freezeDurationSeconds: number = 2.5;

  public stunChanceBonusPercent: number = 0;
  public stunDurationSeconds: number = 2; 
  public stunIntervalSeconds: number = 2; 
  public stunTotalDebuffDurationSeconds: number = 8; 


  public chainLightningChanceBonusPercent: number = 0;
  
  public poisonChanceBonusPercent: number = 0;
  public poisonDamagePerTick: number = 1; 
  public poisonDurationSeconds: number = 5;
  public poisonTickIntervalSeconds: number = 1;


  public projectileScaleBonusPercent: number = 0;
  private projectileScaleStacks: number = 0;
  private readonly MAX_PROJECTILE_SCALE_STACKS = 5;
  private readonly PROJECTILE_SCALE_PER_STACK_PERCENT = 25;

  public projectileSpeedBonusPercent: number = 0;
  private projectileSpeedStacks: number = 0;
  private readonly MAX_PROJECTILE_SPEED_STACKS = 10;
  private readonly PROJECTILE_SPEED_PER_STACK_PERCENT = 5;

  public shieldCharges: number = 1; 
  private shieldChargesStacks: number = 1; 
  private readonly MAX_SHIELD_STACKS = 3;

  public maxHealthBonusPercent: number = 0;
  public lifeStealChanceBonusPercent: number = 0;
  public convertEnemyChanceBonusPercent: number = 0;
  private convertEnemyStacks: number = 0;
  private readonly MAX_CONVERT_ENEMY_STACKS = 2; 

  public dashAttackDamage: number = 0;
  public turretCount: number = 0;

  // Skill System
  public availableSkillPoints: number = 0;

  // Flags for unlocked base abilities
  public superLaserUnlocked: boolean = false;
  public spreadShotgunUnlocked: boolean = false;
  public iAmNuclearUnlocked: boolean = false;
  public backwardsShotUnlocked: boolean = false;
  public bbpUnlocked: boolean = false; // Big Black Projectile
  public crescentMoonUnlocked: boolean = false;

  // Placeholder for future upgrade levels
  // public superLaserDamageLevel: number = 0;


  constructor() {
    this.resetUnlockedAbilities();
  }

  private resetUnlockedAbilities(): void {
    this.superLaserUnlocked = false;
    this.spreadShotgunUnlocked = false;
    this.iAmNuclearUnlocked = false;
    this.backwardsShotUnlocked = false;
    this.bbpUnlocked = false;
    this.crescentMoonUnlocked = false;
  }

  public spendSkillPoints(amount: number): boolean {
    if (this.availableSkillPoints >= amount) {
      this.availableSkillPoints -= amount;
      return true;
    }
    return false;
  }

  public unlockAbility(ability: UnlockableAbilityType): void {
    switch (ability) {
      case UAType.SUPER_LASER: this.superLaserUnlocked = true; break;
      case UAType.SPREAD_SHOTGUN: this.spreadShotgunUnlocked = true; break;
      case UAType.I_AM_NUCLEAR: this.iAmNuclearUnlocked = true; break;
      case UAType.BACKWARDS_SHOT: this.backwardsShotUnlocked = true; break;
      case UAType.BBP: this.bbpUnlocked = true; break;
      case UAType.CRESCENT_MOON: this.crescentMoonUnlocked = true; break;
    }
  }

  public getUnlockedAbilitiesStatus(): Record<UnlockableAbilityType, boolean> {
    return {
        [UAType.SUPER_LASER]: this.superLaserUnlocked,
        [UAType.SPREAD_SHOTGUN]: this.spreadShotgunUnlocked,
        [UAType.I_AM_NUCLEAR]: this.iAmNuclearUnlocked,
        [UAType.BACKWARDS_SHOT]: this.backwardsShotUnlocked,
        [UAType.BBP]: this.bbpUnlocked,
        [UAType.CRESCENT_MOON]: this.crescentMoonUnlocked,
    };
  }


  public applyCard(card: CardData): void {
    if (card.isSkillUnlock && card.skillToUnlock && typeof card.skillPointCost === 'number') {
        if (this.spendSkillPoints(card.skillPointCost)) {
            this.unlockAbility(card.skillToUnlock);
        }
    } else {
        for (const effect of card.effects) {
            this.applyEffect(effect);
        }
    }
  }

  private applyEffect(effect: CardEffect): void {
    switch (effect.stat) {
      case PStats.AttackSpeedPercent:
        this.attackSpeedBonusPercent += effect.value;
        break;
      case PStats.Power:
        this.powerBonus += effect.value;
        break;
      case PStats.CritChancePercent:
        this.critChanceBonusPercent += effect.value;
        break;
      case PStats.CritDamageMultiplierPercent:
        this.critDamageMultiplierBonusPercent += effect.value;
        break;
      case PStats.BurnChancePercent: this.burnChanceBonusPercent += effect.value; break;
      case PStats.BurnDamagePerTick: this.burnDamagePerTick += effect.value; break; 
      case PStats.BurnDurationSeconds: this.burnDurationSeconds += effect.value; break; 
      case PStats.FreezeChancePercent: this.freezeChanceBonusPercent += effect.value; break;
      case PStats.FreezeDurationSeconds: this.freezeDurationSeconds += effect.value; break; 
      case PStats.StunChancePercent: this.stunChanceBonusPercent += effect.value; break;
      case PStats.PoisonChancePercent: this.poisonChanceBonusPercent += effect.value; break;
      case PStats.PoisonDamagePerTick: this.poisonDamagePerTick += effect.value; break; 
      case PStats.PoisonDurationSeconds: this.poisonDurationSeconds += effect.value; break; 
      
      case PStats.ProjectileScalePercent:
        if (this.projectileScaleStacks < this.MAX_PROJECTILE_SCALE_STACKS) {
          this.projectileScaleStacks++;
          this.projectileScaleBonusPercent = this.projectileScaleStacks * this.PROJECTILE_SCALE_PER_STACK_PERCENT;
        }
        break;
      case PStats.ProjectileSpeedPercent:
         if (this.projectileSpeedStacks < this.MAX_PROJECTILE_SPEED_STACKS) {
          this.projectileSpeedStacks++;
          this.projectileSpeedBonusPercent = this.projectileSpeedStacks * this.PROJECTILE_SPEED_PER_STACK_PERCENT;
        }
        break;
      case PStats.ShieldCharges:
        if (this.shieldChargesStacks < this.MAX_SHIELD_STACKS) {
          this.shieldChargesStacks++;
          this.shieldCharges = this.shieldChargesStacks;
        }
        break;
      case PStats.MaxHealthPercent:
        this.maxHealthBonusPercent += effect.value;
        break;
      case PStats.LifeStealChancePercent:
        this.lifeStealChanceBonusPercent += effect.value;
        break;
      case PStats.ConvertEnemyChancePercent:
        if (this.convertEnemyStacks < this.MAX_CONVERT_ENEMY_STACKS) {
          this.convertEnemyChanceBonusPercent += effect.value; 
          this.convertEnemyStacks++;
        }
        break;
      case PStats.DashAttackDamage:
        this.dashAttackDamage += effect.value; 
        break;
      case PStats.TurretCount:
        this.turretCount = Math.min(MAX_TURRETS, this.turretCount + effect.value);
        break;
      default:
        break;
    }
  }

  public getEffectiveProjectileDamage(): number {
    return this.baseProjectileDamage + this.powerBonus;
  }

  public getEffectiveAttackCooldownMs(): number {
    const totalAttackSpeedPercent = 100 + this.attackSpeedBonusPercent;
    return this.baseAttackCooldownMs * (100 / Math.max(1, totalAttackSpeedPercent));
  }
  
  public getEffectiveCritChancePercent(): number {
    return Math.min(100, this.baseCritChancePercent + this.critChanceBonusPercent);
  }

  public getEffectiveCritDamageMultiplierPercent(): number {
    return this.baseCritDamageMultiplierPercent + this.critDamageMultiplierBonusPercent;
  }

  public getEffectiveProjectileScale(): number {
    return this.baseProjectileScale * (1 + this.projectileScaleBonusPercent / 100);
  }

  public getEffectiveProjectileSpeedMultiplier(): number {
    return this.baseProjectileSpeed * (1 + this.projectileSpeedBonusPercent / 100);
  }
  
  public getEffectiveMaxHealth(): number {
    return Math.round(this.baseMaxHealth * (1 + this.maxHealthBonusPercent / 100));
  }

  public getShieldDamageReductionPercent(): number {
    return this.shieldCharges > 0 ? 20 : 0;
  }

  public consumeShieldCharge(): boolean {
    if (this.shieldCharges > 0) {
      this.shieldCharges--;
      if (this.shieldChargesStacks > 0) this.shieldChargesStacks--; 
      return true;
    }
    return false;
  }

  public rollForBurn(): boolean { return Math.random() * 100 < this.burnChanceBonusPercent; }
  public rollForFreeze(): boolean { return Math.random() * 100 < this.freezeChanceBonusPercent; }
  public rollForStun(): boolean { return Math.random() * 100 < this.stunChanceBonusPercent; }
  public rollForChainLightning(): boolean { return Math.random() * 100 < this.chainLightningChanceBonusPercent; }
  public rollForPoison(): boolean { return Math.random() * 100 < this.poisonChanceBonusPercent; }
  public rollForLifeSteal(): boolean { return Math.random() * 100 < this.lifeStealChanceBonusPercent; }
  public rollForEnemyConversion(): boolean { return Math.random() * 100 < this.convertEnemyChanceBonusPercent; }


  public resetStats(): void {
    this.powerBonus = 0;
    this.attackSpeedBonusPercent = 0;
    this.critChanceBonusPercent = 0;
    this.critDamageMultiplierBonusPercent = 0;
    
    this.burnChanceBonusPercent = 0;
    this.burnDamagePerTick = 2;
    this.burnDurationSeconds = 3;
    
    this.freezeChanceBonusPercent = 0;
    this.freezeDurationSeconds = 2.5;

    this.stunChanceBonusPercent = 0;
    
    this.poisonChanceBonusPercent = 0;
    this.poisonDamagePerTick = 1;
    this.poisonDurationSeconds = 5;


    this.projectileScaleBonusPercent = 0;
    this.projectileScaleStacks = 0;
    this.projectileSpeedBonusPercent = 0;
    this.projectileSpeedStacks = 0;
    
    this.shieldCharges = 1; 
    this.shieldChargesStacks = 1; 

    this.maxHealthBonusPercent = 0;
    this.lifeStealChanceBonusPercent = 0;
    this.convertEnemyChanceBonusPercent = 0;
    this.convertEnemyStacks = 0;

    this.dashAttackDamage = 0;
    this.turretCount = 0;

    this.availableSkillPoints = 0;
    this.resetUnlockedAbilities();
  }
}

    