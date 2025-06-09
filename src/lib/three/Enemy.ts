
import * as THREE from 'three';
import { EnemyType, type ActiveStatusEffect, PlayerStatType, PYRAMID_PROJECTILE_DAMAGE, BOSS_PROJECTILE_DAMAGE_MULTIPLIER, ENEMY_STATS, DOT_COLORS, BossAttackPattern, StatusEffectVisualType, ProjectileStatusEffectData } from '@/types';
import Projectile from './Projectile';
import type Game from './Game'; 
import type FloatingDamageText from './FloatingDamageText';


const ENEMY_PROJECTILE_SPEED = 0.09;
const PYRAMID_PROJECTILE_SPEED = ENEMY_PROJECTILE_SPEED * 0.75;
const ENEMY_PROJECTILE_COLOR = 0xff8800;
const CONVERTED_ENEMY_PROJECTILE_COLOR = 0x00ddff;
const BOSS_PROJECTILE_COLOR = 0xff4444; 
const BOSS_BIG_PROJECTILE_COLOR = 0xcc00cc; 
const HEALING_ORB_COLOR = DOT_COLORS.heal;
const HEALING_ORB_SPEED = ENEMY_PROJECTILE_SPEED * 0.6;
const HEALING_ORB_AMOUNT = 10; 


const HEALTH_BAR_WIDTH = 0.6;
const HEALTH_BAR_HEIGHT = 0.08;
const HEALTH_BAR_Y_OFFSET = 0.3; 


const BOSS_STANDARD_SHOT_DURATION = 5000; 
const BOSS_RAPID_FIRE_DURATION = 3000; 
const BOSS_SPREAD_SHOT_DURATION = 4000; 
const BOSS_PATTERN_COOLDOWN = 2000; 
const BOSS_SPECIAL_ATTACK_COOLDOWN = 15000; 

const BOSS_RAPID_FIRE_SHOT_DELAY = 100; 
const BOSS_RAPID_FIRE_BURST_COUNT = 5;

const BOSS_SPREAD_SHOT_COUNT = 5;
const BOSS_SPREAD_ANGLE_DEG = 30; 

const BIG_PROJECTILE_SCALE_MULTIPLIER = 2.5;
const BIG_PROJECTILE_DAMAGE_MULTIPLIER = 3.0;

interface OriginalMaterialState {
    color: THREE.Color;
    emissive: THREE.Color;
    emissiveIntensity: number;
}


export default class Enemy {
  public mesh: THREE.Mesh | THREE.Group | null;
  private scene: THREE.Scene;
  public type: EnemyType;
  public speed: number = 0.025;
  private worldOutOfBoundsX: number;
  private worldRightEdge: number;

  public health: number;
  public maxHealth: number;
  private baseXP: number;
  public activeEffects: ActiveStatusEffect[] = [];

  public zigzagAmplitude: number = 1.5;
  public zigzagSpeed: number = 0.015;
  public zigzagDirection: number = 1;
  private worldTopEdge: number = Infinity;
  private worldBottomEdge: number = -Infinity;

  public slowSpeed: number = 0.0075;
  private shootCooldown: number = 2500;
  private lastShotTime: number = 0;
  private canShootPyramid: boolean = true;
  private playerPositionGetter?: () => THREE.Vector3;
  private pyramidProjectileSpawnOffset: THREE.Vector3;
  private doubleSphereBurstCount: number = 0;
  private doubleSphereLastBurstShotTime: number = 0;
  private readonly DOUBLE_SPHERE_BURST_DELAY = 120; 
  private readonly DOUBLE_SPHERE_SHOTS_PER_BURST = 3;


  private healthBarGroup: THREE.Group | null = null;
  private healthBarBackground: THREE.Mesh | null = null;
  private healthBarForeground: THREE.Mesh | null = null;
  private healthBarInitialized: boolean = false;
  private healthBarYOffsetActual: number = HEALTH_BAR_Y_OFFSET;

  public isConverted: boolean = false;
  private originalMaterialParams: Map<string, OriginalMaterialState> = new Map();
  public convertedTargetEnemy: Enemy | null = null;

  private isBoss: boolean;
  private bossMovementState: 'advancing' | 'retreating' | 'patrollingY' = 'advancing';
  private bossMovementTimer: number = 0;
  private bossPatrolDirectionY: number = 1;

  private currentBossAttackPattern: BossAttackPattern = BossAttackPattern.STANDARD_SHOT;
  private attackPatternTimer: number = 0;
  private lastSpecialAttackTime: number = 0;
  private rapidFireShotsLeft: number = 0;
  private lastRapidFireShotTime: number = 0;

  private bossPowerModifier: number = 1.0;
  private bossAttackSpeedModifier: number = 1.0;
  private bossProjectileSpeedModifier: number = 1.0;
  private gameInstanceForEvents: Game | null = null;
  private mixer: THREE.AnimationMixer | null = null;

  private currentSpeedMultiplier: number = 1.0; 
  private originalSpeedBeforeEffect: number = 0.025;


  constructor(
    scene: THREE.Scene,
    startPosition: THREE.Vector3,
    worldOutOfBoundsX: number,
    worldRightEdge: number,
    type: EnemyType,
    worldTopEdge?: number,
    worldBottomEdge?: number,
    playerPositionGetter?: () => THREE.Vector3,
    modelInstance?: THREE.Group,
    animations?: THREE.AnimationClip[],
    gameInstance?: Game,
    isInWorld2?: boolean 
  ) {
    this.scene = scene;
    this.worldOutOfBoundsX = worldOutOfBoundsX;
    this.worldRightEdge = worldRightEdge;
    this.type = type;
    this.pyramidProjectileSpawnOffset = new THREE.Vector3(-0.2, 0, 0);
    if (gameInstance) this.gameInstanceForEvents = gameInstance;


    const stats = ENEMY_STATS[type];
    this.health = stats.health;
    this.maxHealth = stats.health;
    this.baseXP = stats.baseXP;
    this.isBoss = stats.isBoss || false;
    this.originalSpeedBeforeEffect = stats.speed || 0.025;
    this.speed = this.originalSpeedBeforeEffect;
    this.shootCooldown = stats.shootCooldown || 2500;

    if (isInWorld2 && !this.isBoss) {
        this.health *= 2;
        this.maxHealth *= 2;
    }


    if (worldTopEdge !== undefined) this.worldTopEdge = worldTopEdge;
    if (worldBottomEdge !== undefined) this.worldBottomEdge = worldBottomEdge;
    if (playerPositionGetter) this.playerPositionGetter = playerPositionGetter;

    let scaleMultiplier = 0.35;

    if (type === EnemyType.SPHERE && modelInstance) {
        this.mesh = modelInstance;
        this.mesh.scale.set(scaleMultiplier, scaleMultiplier, scaleMultiplier);
        this.mesh.rotation.y = Math.PI;
        if (animations && animations.length > 0) {
            this.mixer = new THREE.AnimationMixer(this.mesh);
            animations.forEach(clip => { this.mixer!.clipAction(clip).setLoop(THREE.LoopRepeat, Infinity).play(); });
        }
    } else if (type === EnemyType.PYRAMID && modelInstance) {
        this.mesh = modelInstance;
        scaleMultiplier = 0.2;
        this.mesh.scale.set(scaleMultiplier, scaleMultiplier, scaleMultiplier);
        this.mesh.rotation.y = Math.PI;
        this.lastShotTime = Date.now() + Math.random() * 1000;
        if (animations && animations.length > 0) {
            this.mixer = new THREE.AnimationMixer(this.mesh);
            animations.forEach(clip => { this.mixer!.clipAction(clip).setLoop(THREE.LoopRepeat, Infinity).play(); });
        }
    } else {
        let geometry: THREE.BufferGeometry;
        let materialProperties: THREE.MeshStandardMaterialParameters = { emissiveIntensity: 0.4, roughness: 0.3, metalness: 0.1 };
        switch (type) {
          case EnemyType.CUBE:
            geometry = new THREE.BoxGeometry(0.6, 0.6, 0.6); materialProperties.color = 0x00ff00; materialProperties.emissive = 0x00cc00;
            this.zigzagSpeed = 0.015; if (Math.random() < 0.5) this.zigzagDirection = -1;
            break;
          case EnemyType.PYRAMID:
            geometry = new THREE.ConeGeometry(0.4, 0.7, 4); geometry.rotateX(Math.PI / 2); materialProperties.color = 0xffff00; materialProperties.emissive = 0xcccc00;
            this.lastShotTime = Date.now() + Math.random() * 1000;
            break;
          case EnemyType.BOSS_PYRAMID_MK1:
            geometry = new THREE.ConeGeometry(0.8, 1.5, 4); geometry.rotateX(Math.PI / 2); materialProperties.color = 0x880000; materialProperties.emissive = 0xaa0000; materialProperties.emissiveIntensity = 0.8;
            this.lastShotTime = Date.now() + Math.random() * 1000; this.lastSpecialAttackTime = Date.now(); this.shootCooldown = 1800; this.pyramidProjectileSpawnOffset = new THREE.Vector3(-0.4, 0, 0); scaleMultiplier = 0.75; this._applyRandomBossBuffs();
            break;
          case EnemyType.RHOMBUS:
            geometry = new THREE.CylinderGeometry(0.25, 0.25, 0.5, 4, 1); 
            geometry.rotateZ(Math.PI / 4); 
            geometry.rotateX(Math.PI / 2); 
            materialProperties.color = 0x0088ff; materialProperties.emissive = 0x0066cc; scaleMultiplier = 0.9;
            break;
          case EnemyType.DOUBLE_SPHERE:
            const sphereRadius = 0.25;
            const sphereGeo = new THREE.SphereGeometry(sphereRadius, 12, 12);
            const mat = new THREE.MeshStandardMaterial({ color: 0xff88ff, emissive: 0xcc66cc, ...materialProperties });
            const sphere1 = new THREE.Mesh(sphereGeo, mat);
            sphere1.position.x = -sphereRadius * 0.8;
            const sphere2 = new THREE.Mesh(sphereGeo, mat);
            sphere2.position.x = sphereRadius * 0.8;
            this.mesh = new THREE.Group();
            (this.mesh as THREE.Group).add(sphere1);
            (this.mesh as THREE.Group).add(sphere2);
            (this.mesh as THREE.Group).scale.set(scaleMultiplier, scaleMultiplier, scaleMultiplier);
            this.pyramidProjectileSpawnOffset = new THREE.Vector3(-0.3, 0, 0); 
            this.lastShotTime = Date.now() + Math.random() * (stats.shootCooldown || 2500);
            break;
          case EnemyType.HEXAGON:
            geometry = new THREE.CylinderGeometry(0.35, 0.35, 0.2, 6); 
            materialProperties.color = 0x88ff88; materialProperties.emissive = 0x66cc66; scaleMultiplier = 1.0;
            this.pyramidProjectileSpawnOffset = new THREE.Vector3(-0.4, 0, 0);
            this.lastShotTime = Date.now() + Math.random() * (stats.shootCooldown || 3000);
            break;
          case EnemyType.SPHERE: default:
            geometry = new THREE.SphereGeometry(0.3, 16, 16); materialProperties.color = 0xff0000; materialProperties.emissive = 0xcc0000;
            break;
        }
        if (type !== EnemyType.DOUBLE_SPHERE) { 
            this.mesh = new THREE.Mesh(geometry!, new THREE.MeshStandardMaterial(materialProperties));
            (this.mesh as THREE.Mesh).scale.set(scaleMultiplier, scaleMultiplier, scaleMultiplier);
            if (type === EnemyType.PYRAMID || type === EnemyType.BOSS_PYRAMID_MK1 || type === EnemyType.RHOMBUS) {
                 (this.mesh as THREE.Mesh).rotation.y = Math.PI;
            }
        }
    }

    if (this.mesh) {
        const boundingBox = new THREE.Box3().setFromObject(this.mesh);
        const size = boundingBox.getSize(new THREE.Vector3());
        this.healthBarYOffsetActual = size.y / 2 + HEALTH_BAR_HEIGHT * 2.5; 
    }


    this.captureOriginalMaterials();

    if (this.mesh) {
        this.mesh.position.copy(startPosition);
        this.mesh.position.z = 0;
        scene.add(this.mesh);
    }
  }

  private captureOriginalMaterials(): void {
    if (!this.mesh) return;
    this.originalMaterialParams.clear();
    this.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach(mat => {
          if (mat instanceof THREE.MeshStandardMaterial) {
            if (!this.originalMaterialParams.has(mat.uuid)) {
              this.originalMaterialParams.set(mat.uuid, {
                color: mat.color.clone(),
                emissive: mat.emissive.clone(),
                emissiveIntensity: mat.emissiveIntensity
              });
            }
          }
        });
      }
    });
  }

  private _applyRandomBossBuffs(): void {  }

  private initHealthBar(): void {
    if (!this.mesh || this.isBoss || this.healthBarInitialized) return;

    this.healthBarGroup = new THREE.Group();
    this.healthBarGroup.position.y = this.healthBarYOffsetActual;

    const bgGeometry = new THREE.PlaneGeometry(HEALTH_BAR_WIDTH, HEALTH_BAR_HEIGHT);
    const bgMaterial = new THREE.MeshBasicMaterial({
        color: 0x333333,
        transparent: true,
        opacity: 0.6, 
        depthTest: false, 
        depthWrite: false
    });
    this.healthBarBackground = new THREE.Mesh(bgGeometry, bgMaterial);
    this.healthBarGroup.add(this.healthBarBackground);

    const fgGeometry = new THREE.PlaneGeometry(HEALTH_BAR_WIDTH, HEALTH_BAR_HEIGHT);
    const fgMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        transparent: true,
        opacity: 0.8, 
        depthTest: false, 
        depthWrite: false
    });
    this.healthBarForeground = new THREE.Mesh(fgGeometry, fgMaterial);
    this.healthBarForeground.position.z = 0.001;
    this.healthBarGroup.add(this.healthBarForeground);

    this.mesh.add(this.healthBarGroup);
    this.healthBarInitialized = true;
    this.updateHealthBarVisuals();
  }

  public updateHealthBarVisuals(): void {
    if (!this.healthBarForeground || !this.healthBarBackground || !this.healthBarGroup || this.isBoss) return;

    const healthPercent = Math.max(0, this.health / this.maxHealth);
    this.healthBarForeground.scale.x = healthPercent;
    
    this.healthBarForeground.position.x = (healthPercent - 1) * HEALTH_BAR_WIDTH / 2;

    const fgMaterial = this.healthBarForeground.material as THREE.MeshBasicMaterial;
    if (healthPercent <= 0.3) {
        fgMaterial.color.setHex(0xff0000); 
    } else if (healthPercent <= 0.6) {
        fgMaterial.color.setHex(0xffff00); 
    } else {
        fgMaterial.color.setHex(0x00ff00); 
    }
    
    
    const isVisible = this.health < this.maxHealth && this.health > 0;
    this.healthBarGroup.visible = isVisible;
    this.healthBarForeground.visible = isVisible;
    this.healthBarBackground.visible = isVisible;
  }

  public takeDamage(
    baseAmount: number,
    finalAmount: number,
    isCrit: boolean,
    gameInstance: Game
  ): { actualDamageDealt: number; didDie: boolean } {
    if (!this.mesh) return { actualDamageDealt: 0, didDie: true };

    this.health -= finalAmount;
    this.health = Math.max(0, this.health);


    if (this.isBoss && this.gameInstanceForEvents) {
        this.gameInstanceForEvents.onGameEvent({
            type: 'bossHealthUpdate',
            bossId: this.mesh.uuid,
            currentHealth: this.health,
            maxHealth: this.maxHealth
        });
    } else if (!this.isBoss) {
        if (!this.healthBarInitialized && this.health < this.maxHealth) {
            this.initHealthBar(); 
        }
        this.updateHealthBarVisuals(); 
    }
    const didDie = this.health <= 0;
    return { actualDamageDealt: finalAmount, didDie };
  }

  public heal(amount: number): void {
      if (this.health <= 0) return; 
      this.health = Math.min(this.maxHealth, this.health + amount);
      if (!this.isBoss) {
          this.updateHealthBarVisuals();
      } else if (this.isBoss && this.gameInstanceForEvents && this.mesh) {
          this.gameInstanceForEvents.onGameEvent({
              type: 'bossHealthUpdate',
              bossId: this.mesh.uuid,
              currentHealth: this.health,
              maxHealth: this.maxHealth
          });
      }
  }


  private applyTint(visualType: StatusEffectVisualType): void {
    if (!this.mesh) return;
    let tintColorHex: number | null = null;
    switch (visualType) {
        case 'poison': tintColorHex = DOT_COLORS.poison; break;
        case 'freeze': tintColorHex = DOT_COLORS.freeze; break;
        case 'burn': tintColorHex = DOT_COLORS.burn; break;
        case 'stun': tintColorHex = DOT_COLORS.stun; break;
        case 'charmed': tintColorHex = DOT_COLORS.charmed; break;
    }

    if (tintColorHex === null) return;
    const tintColor = new THREE.Color(tintColorHex);

    this.mesh.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            materials.forEach(mat => {
                if (mat instanceof THREE.MeshStandardMaterial) {
                    if (!this.originalMaterialParams.has(mat.uuid)) {
                        this.originalMaterialParams.set(mat.uuid, {
                            color: mat.color.clone(),
                            emissive: mat.emissive.clone(),
                            emissiveIntensity: mat.emissiveIntensity
                        });
                    }
                    const originalState = this.originalMaterialParams.get(mat.uuid);
                    if (originalState) {
                        mat.color.copy(originalState.color).lerp(tintColor, 0.65);
                        mat.emissive.copy(tintColor);
                        mat.emissiveIntensity = 0.8;
                    }
                }
            });
        }
    });
  }

  private revertTint(): void {
    if (!this.mesh) return;
    this.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach(mat => {
          if (mat instanceof THREE.MeshStandardMaterial) {
            const originalState = this.originalMaterialParams.get(mat.uuid);
            if (originalState) {
              mat.color.copy(originalState.color);
              mat.emissive.copy(originalState.emissive);
              mat.emissiveIntensity = originalState.emissiveIntensity;
            }
          }
        });
      }
    });

    const activeVisualEffects = this.activeEffects.filter(eff => eff.visualType);
    if (activeVisualEffects.length > 0) {
        this.applyTint(activeVisualEffects[activeVisualEffects.length - 1].visualType);
    }
  }

  public applyStatusEffect(effectData: ProjectileStatusEffectData, gameInstance: Game): void {
    if (!this.mesh) return;
    let visualType: StatusEffectVisualType | undefined;
    let newEffect: ActiveStatusEffect | null = null;

    switch (effectData.type) {
        case PlayerStatType.PoisonChancePercent:
            visualType = 'poison';
            newEffect = { type: effectData.type, visualType, durationLeft: effectData.duration, damagePerTick: effectData.damagePerTick, tickInterval: effectData.tickInterval, timeToNextTick: effectData.tickInterval };
            break;
        case PlayerStatType.FreezeChancePercent:
            visualType = 'freeze';
            newEffect = { type: effectData.type, visualType, durationLeft: effectData.duration, slowFactor: effectData.slowFactor };
            this.currentSpeedMultiplier = 1.0 - (effectData.slowFactor || 0);
            break;
        case PlayerStatType.BurnChancePercent:
            visualType = 'burn';
            newEffect = { type: effectData.type, visualType, durationLeft: effectData.duration, damagePerTick: effectData.damagePerTick, tickInterval: effectData.tickInterval, timeToNextTick: effectData.tickInterval };
            break;
        case PlayerStatType.StunChancePercent:
            visualType = 'stun';
            newEffect = {
                type: effectData.type, visualType, durationLeft: effectData.totalStunDuration || 8,
                totalStunDebuffDurationLeft: effectData.totalStunDuration || 8,
                currentStunCycleDurationLeft: effectData.stunPhaseDuration || 2,
                isInStunPhase: true,
                stunPhaseDuration: effectData.stunPhaseDuration || 2,
                stunMoveIntervalDuration: effectData.stunMoveInterval || 2
            };
            this.currentSpeedMultiplier = 0;
            break;
        case PlayerStatType.ConvertEnemyChancePercent:
            if (!this.isBoss && !this.isConverted) {
                this.convertEnemy(gameInstance);
            }
            return;
    }

    if (newEffect && visualType) {
        const existingIndex = this.activeEffects.findIndex(ae => ae.visualType === visualType);
        if (existingIndex > -1) {
            this.activeEffects.splice(existingIndex, 1);
            this.revertTint();
        }
        this.activeEffects.push(newEffect);
        this.applyTint(visualType);
    }
  }


 public updateStatusEffects(deltaTime: number, gameInstance: Game): void {
    if (!this.mesh) return;

    let speedMultiplierNeedsUpdate = false;

    for (let i = this.activeEffects.length - 1; i >= 0; i--) {
        const effect = this.activeEffects[i];
        effect.durationLeft -= deltaTime;

        if (effect.visualType === 'stun' && effect.totalStunDebuffDurationLeft !== undefined) {
            effect.totalStunDebuffDurationLeft -= deltaTime;
            if (effect.currentStunCycleDurationLeft !== undefined) {
                 effect.currentStunCycleDurationLeft -= deltaTime;
                 if (effect.currentStunCycleDurationLeft <= 0) {
                     effect.isInStunPhase = !effect.isInStunPhase;
                     effect.currentStunCycleDurationLeft = effect.isInStunPhase ? (effect.stunPhaseDuration || 2) : (effect.stunMoveIntervalDuration || 2);
                     speedMultiplierNeedsUpdate = true;
                 }
            }
            if (effect.totalStunDebuffDurationLeft <= 0) effect.durationLeft = 0;
        }

        if (effect.durationLeft <= 0) {
            const expiredVisualType = effect.visualType;
            this.activeEffects.splice(i, 1);
            if (expiredVisualType === 'freeze' || expiredVisualType === 'stun') {
                speedMultiplierNeedsUpdate = true;
            }
            this.revertTint();
            continue;
        }

        if ((effect.visualType === 'burn' || effect.visualType === 'poison') && effect.damagePerTick && effect.tickInterval) {
            effect.timeToNextTick = (effect.timeToNextTick ?? effect.tickInterval) - deltaTime;
            if (effect.timeToNextTick <= 0) {
                const tickDamage = effect.damagePerTick;
                this.health -= tickDamage;
                this.health = Math.max(0, this.health);

                if (this.isBoss && this.gameInstanceForEvents && this.mesh) {
                    this.gameInstanceForEvents.onGameEvent({ type: 'bossHealthUpdate', bossId: this.mesh.uuid, currentHealth: this.health, maxHealth: this.maxHealth });
                } else if (!this.isBoss) {
                    this.updateHealthBarVisuals();
                }

                if (gameInstance.scene.userData.FloatingDamageText && this.mesh) {
                    const FloatingDamageTextConstructor = gameInstance.scene.userData.FloatingDamageText as typeof FloatingDamageText;
                    const damageText = new FloatingDamageTextConstructor(
                        gameInstance.scene, tickDamage.toFixed(1),
                        this.mesh.position.clone().add(new THREE.Vector3(Math.random() * 0.2 - 0.1, this.healthBarYOffsetActual + HEALTH_BAR_HEIGHT, 0.1)),
                        DOT_COLORS[effect.visualType] || DOT_COLORS.hit, false
                    );
                    gameInstance.floatingDamageNumbers.push(damageText);
                }
                effect.timeToNextTick += effect.tickInterval;
                if (this.health <= 0) {
                   return;
                }
            }
        }
    }

    if (speedMultiplierNeedsUpdate) {
        this.currentSpeedMultiplier = 1.0;
        const freezeEffect = this.activeEffects.find(e => e.visualType === 'freeze' && e.slowFactor !== undefined);
        if (freezeEffect) {
            this.currentSpeedMultiplier = 1.0 - (freezeEffect.slowFactor || 0);
        }

        const stunEffect = this.activeEffects.find(e => e.visualType === 'stun');
        if (stunEffect && stunEffect.isInStunPhase) {
            this.currentSpeedMultiplier = 0;
        }
    }
    this.speed = this.originalSpeedBeforeEffect * this.currentSpeedMultiplier;
}


  public getBaseXP(): number { return this.baseXP; }

  public getCurrentSpeed(): number {
    if (!this.mesh) return 0;
    let currentBaseSpeed = this.isConverted && (this.type === EnemyType.SPHERE || this.type === EnemyType.CUBE || this.type === EnemyType.RHOMBUS)
                           ? Math.abs(this.originalSpeedBeforeEffect)
                           : this.originalSpeedBeforeEffect;
    if (this.isBoss && this.bossMovementState === 'retreating') {
        currentBaseSpeed *= 0.7;
    }
    return currentBaseSpeed * this.currentSpeedMultiplier;
  }

  public convertEnemy(game: Game): void {
    if (this.isConverted || this.isBoss || !this.mesh) return;
    this.isConverted = true;

    this.activeEffects = [];
    this.revertTint();

    this.currentSpeedMultiplier = 1.0;
    this.speed = this.originalSpeedBeforeEffect;
    this.applyTint('charmed');

    if (this.type === EnemyType.SPHERE || this.type === EnemyType.CUBE || this.type === EnemyType.RHOMBUS || this.type === EnemyType.DOUBLE_SPHERE || this.type === EnemyType.HEXAGON) {
      
    } else if (this.type === EnemyType.PYRAMID) {
      (this.mesh as THREE.Mesh).rotation.y = 0; 
      this.pyramidProjectileSpawnOffset.x *= -1; 
    }
    this.health = this.maxHealth; 
    if (!this.isBoss) {
        if (!this.healthBarInitialized) this.initHealthBar();
        this.updateHealthBarVisuals();
    }
  }

  private updateBossBehavior(deltaTime: number, playerPosition?: THREE.Vector3): Projectile[] | null {
      if (!this.mesh || !this.isBoss || !playerPosition) return null;

      const effectiveSpeed = this.getCurrentSpeed();
      const effectiveShootCooldown = this.shootCooldown / this.bossAttackSpeedModifier;
      const effectiveProjectileSpeed = ENEMY_PROJECTILE_SPEED * this.bossProjectileSpeedModifier;

      this.bossMovementTimer += deltaTime;
      this.attackPatternTimer += deltaTime;

      
      const retreatPositionX = this.worldRightEdge - 2; 
      const advancePositionX = this.worldRightEdge - 4; 

      if (this.bossMovementState === 'advancing') {
          this.mesh.position.x -= effectiveSpeed * 0.7; 
          if (this.mesh.position.x <= advancePositionX) {
              this.mesh.position.x = advancePositionX;
              this.bossMovementState = 'patrollingY';
              this.bossMovementTimer = 0;
              this.bossPatrolDirectionY = (Math.random() < 0.5) ? 1 : -1; 
          }
      } else if (this.bossMovementState === 'retreating') {
          this.mesh.position.x += effectiveSpeed * 0.5; 
          if (this.mesh.position.x >= retreatPositionX) {
              this.mesh.position.x = retreatPositionX;
              this.bossMovementState = 'advancing'; 
              this.bossMovementTimer = 0;
          }
      } else if (this.bossMovementState === 'patrollingY') {
          this.mesh.position.y += this.bossPatrolDirectionY * effectiveSpeed * 0.8;
          const bossEffectiveHalfHeight = (1.5 * (this.mesh as THREE.Mesh).scale.y) / 2; 
          if (this.mesh.position.y >= this.worldTopEdge - bossEffectiveHalfHeight || this.mesh.position.y <= this.worldBottomEdge + bossEffectiveHalfHeight) {
              this.bossPatrolDirectionY *= -1;
              this.mesh.position.y = Math.max(this.worldBottomEdge + bossEffectiveHalfHeight, Math.min(this.worldTopEdge - bossEffectiveHalfHeight, this.mesh.position.y));
          }
          
          if (this.bossMovementTimer > 8000) { 
              this.bossMovementState = (Math.random() < 0.3) ? 'retreating' : 'advancing'; 
              this.bossMovementTimer = 0;
          }
      }

      
      let projectiles: Projectile[] = [];
      const now = Date.now();

      if (now - this.lastSpecialAttackTime > BOSS_SPECIAL_ATTACK_COOLDOWN) {
          const specialProjectiles = this._shootBossProjectile(playerPosition, BossAttackPattern.SPECIAL_BIG_SHOT);
          if (specialProjectiles) projectiles.push(...specialProjectiles);
          this.lastSpecialAttackTime = now;
          this.currentBossAttackPattern = BossAttackPattern.COOLDOWN; 
          this.attackPatternTimer = 0;
          return projectiles.length > 0 ? projectiles : null;
      }
      
      switch (this.currentBossAttackPattern) {
          case BossAttackPattern.STANDARD_SHOT:
              if (this.attackPatternTimer > BOSS_STANDARD_SHOT_DURATION) {
                  this.currentBossAttackPattern = (Math.random() < 0.5) ? BossAttackPattern.RAPID_FIRE : BossAttackPattern.SPREAD_SHOT;
                  this.attackPatternTimer = 0;
                  if (this.currentBossAttackPattern === BossAttackPattern.RAPID_FIRE) this.rapidFireShotsLeft = BOSS_RAPID_FIRE_BURST_COUNT;
              } else if (now - this.lastShotTime > effectiveShootCooldown) {
                  const standardProjectiles = this._shootBossProjectile(playerPosition, BossAttackPattern.STANDARD_SHOT);
                  if (standardProjectiles) projectiles.push(...standardProjectiles);
                  this.lastShotTime = now;
              }
              break;
          case BossAttackPattern.RAPID_FIRE:
              if (this.attackPatternTimer > BOSS_RAPID_FIRE_DURATION || this.rapidFireShotsLeft <= 0) {
                  this.currentBossAttackPattern = BossAttackPattern.COOLDOWN;
                  this.attackPatternTimer = 0;
              } else if (now - this.lastRapidFireShotTime > BOSS_RAPID_FIRE_SHOT_DELAY) {
                  const rapidProjectiles = this._shootBossProjectile(playerPosition, BossAttackPattern.RAPID_FIRE);
                  if (rapidProjectiles) projectiles.push(...rapidProjectiles);
                  this.lastRapidFireShotTime = now;
                  this.rapidFireShotsLeft--;
              }
              break;
          case BossAttackPattern.SPREAD_SHOT:
              if (this.attackPatternTimer > BOSS_SPREAD_SHOT_DURATION) {
                  this.currentBossAttackPattern = BossAttackPattern.COOLDOWN;
                  this.attackPatternTimer = 0;
              } else if (now - this.lastShotTime > effectiveShootCooldown * 1.5) { 
                  const spreadProjectiles = this._shootBossProjectile(playerPosition, BossAttackPattern.SPREAD_SHOT);
                  if (spreadProjectiles) projectiles.push(...spreadProjectiles);
                  this.lastShotTime = now;
              }
              break;
          case BossAttackPattern.COOLDOWN:
              if (this.attackPatternTimer > BOSS_PATTERN_COOLDOWN) {
                  this.currentBossAttackPattern = BossAttackPattern.STANDARD_SHOT;
                  this.attackPatternTimer = 0;
              }
              break;
          case BossAttackPattern.SPECIAL_BIG_SHOT: 
              break;
      }
      return projectiles.length > 0 ? projectiles : null;
  }

  private _shootBossProjectile(targetPosition?: THREE.Vector3, pattern: BossAttackPattern = BossAttackPattern.STANDARD_SHOT): Projectile[] | null {
      if (!this.mesh || !targetPosition) return null;

      const projectiles: Projectile[] = [];
      const spawnPosWorld = new THREE.Vector3();
      this.mesh.localToWorld(spawnPosWorld.copy(this.pyramidProjectileSpawnOffset));
      const baseDamage = (PYRAMID_PROJECTILE_DAMAGE * BOSS_PROJECTILE_DAMAGE_MULTIPLIER) * this.bossPowerModifier;
      const effectiveProjectileSpeed = ENEMY_PROJECTILE_SPEED * this.bossProjectileSpeedModifier;

      if (pattern === BossAttackPattern.SPECIAL_BIG_SHOT) {
          const direction = targetPosition.clone().sub(spawnPosWorld).normalize();
          if (direction.lengthSq() === 0) direction.set(-1,0,0); 
          projectiles.push(new Projectile(this.scene, spawnPosWorld, direction, BOSS_BIG_PROJECTILE_COLOR, effectiveProjectileSpeed * 0.7, 'enemy', baseDamage * BIG_PROJECTILE_DAMAGE_MULTIPLIER, BIG_PROJECTILE_SCALE_MULTIPLIER, false, 100, []));
      } else if (pattern === BossAttackPattern.SPREAD_SHOT) {
          const baseDirection = targetPosition.clone().sub(spawnPosWorld).normalize();
          if (baseDirection.lengthSq() === 0) baseDirection.set(-1,0,0); 
          const spreadAngleRad = THREE.MathUtils.degToRad(BOSS_SPREAD_ANGLE_DEG);
          const angleStep = spreadAngleRad / (BOSS_SPREAD_SHOT_COUNT - 1);
          const startAngle = -spreadAngleRad / 2;
          for (let i = 0; i < BOSS_SPREAD_SHOT_COUNT; i++) {
              const angle = startAngle + i * angleStep;
              const direction = baseDirection.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), angle); 
              projectiles.push(new Projectile(this.scene, spawnPosWorld, direction, BOSS_PROJECTILE_COLOR, effectiveProjectileSpeed, 'enemy', baseDamage, 1.0, false, 100, []));
          }
      } else { 
          const direction = targetPosition.clone().sub(spawnPosWorld).normalize();
           if (direction.lengthSq() === 0) direction.set(-1,0,0); 
          projectiles.push(new Projectile(this.scene, spawnPosWorld, direction, BOSS_PROJECTILE_COLOR, effectiveProjectileSpeed, 'enemy', baseDamage, 1.0, false, 100, []));
      }
      return projectiles.length > 0 ? projectiles : null;
  }

  private _shootDoubleSphereBurst(targetPosition: THREE.Vector3): Projectile[] | null {
    if (!this.mesh || !targetPosition || this.doubleSphereBurstCount <= 0) return null;

    const projectiles: Projectile[] = [];
    const spawnPosWorld = new THREE.Vector3();
    this.mesh.localToWorld(spawnPosWorld.copy(this.pyramidProjectileSpawnOffset)); 
    const baseDamage = ENEMY_STATS[this.type].collisionDamage * 0.5; 
    const projectileSpeed = ENEMY_PROJECTILE_SPEED * 1.1; 

    
    const baseDirection = targetPosition.clone().sub(spawnPosWorld).normalize();
    if (baseDirection.lengthSq() === 0) baseDirection.set(-1, 0, 0);

    const angles = [-0.15, 0, 0.15]; 
    for (const angle of angles) {
        const direction = baseDirection.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), angle);
        projectiles.push(new Projectile(this.scene, spawnPosWorld.clone(), direction, ENEMY_PROJECTILE_COLOR, projectileSpeed, 'enemy', baseDamage, 0.8, false, 100, []));
    }
    this.doubleSphereBurstCount--;
    this.doubleSphereLastBurstShotTime = Date.now();
    return projectiles;
  }

  private _shootHealingOrb(gameInstance: Game): Projectile | null {
    if (!this.mesh || !gameInstance) return null;

    let healTarget: Enemy | null = null;
    let minDistanceSq = Infinity;
    const selfWorldPosition = new THREE.Vector3();
    this.mesh.getWorldPosition(selfWorldPosition);

    for (const potentialTarget of gameInstance.enemies) {
        if (potentialTarget === this || potentialTarget.isConverted || potentialTarget.health <= 0 || potentialTarget.health >= potentialTarget.maxHealth || !potentialTarget.mesh) continue;
        
        const distanceSq = selfWorldPosition.distanceToSquared(potentialTarget.mesh.position);
        if (distanceSq < minDistanceSq) {
            minDistanceSq = distanceSq;
            healTarget = potentialTarget;
        }
    }

    if (healTarget && healTarget.mesh) {
        const spawnPosWorld = new THREE.Vector3();
        this.mesh.localToWorld(spawnPosWorld.copy(this.pyramidProjectileSpawnOffset));
        const direction = healTarget.mesh.position.clone().sub(spawnPosWorld).normalize();
        if (direction.lengthSq() === 0) direction.set(-1, 0, 0);

        return new Projectile(
            this.scene, spawnPosWorld, direction, HEALING_ORB_COLOR, HEALING_ORB_SPEED,
            'enemy_heal', HEALING_ORB_AMOUNT, 0.9, false, 0, [] 
        );
    }
    return null;
  }


  public update(deltaTime: number, playerPosition?: THREE.Vector3, gameInstance?: Game): Projectile[] | null {
    if (!this.mesh) return null;
    let newProjectiles: Projectile[] | null = null;
    if (this.mixer) this.mixer.update(deltaTime);

    const effectiveSpeed = this.getCurrentSpeed();
    const now = Date.now();

    if (this.isBoss) {
        newProjectiles = this.updateBossBehavior(deltaTime, playerPosition);
    } else if (this.isConverted) {
        this.mesh.position.x += effectiveSpeed; 
        switch (this.type) {
            case EnemyType.CUBE:
            case EnemyType.RHOMBUS: 
                 this.mesh.position.y += this.zigzagDirection * this.zigzagSpeed;
                 const effectiveHalfHeight = (this.type === EnemyType.CUBE ? 0.6 : 0.5) * (this.mesh as THREE.Mesh).scale.y / 2;
                if (this.mesh.position.y >= this.worldTopEdge - effectiveHalfHeight || this.mesh.position.y <= this.worldBottomEdge + effectiveHalfHeight) {
                    this.zigzagDirection *= -1;
                    this.mesh.position.y = Math.max(this.worldBottomEdge + effectiveHalfHeight, Math.min(this.worldTopEdge - effectiveHalfHeight, this.mesh.position.y));
                }
                break;
            case EnemyType.PYRAMID:
            case EnemyType.DOUBLE_SPHERE: 
            case EnemyType.HEXAGON: 
                if (gameInstance && now - this.lastShotTime > this.shootCooldown) {
                    if (!this.convertedTargetEnemy || this.convertedTargetEnemy.health <= 0 || !this.convertedTargetEnemy.mesh || this.convertedTargetEnemy.isOutOfBounds()) {
                        this.convertedTargetEnemy = null; let closestEnemy: Enemy | null = null; let minDistanceSq = Infinity;
                        for (const potentialTarget of gameInstance.enemies) {
                            if (!potentialTarget.isConverted && potentialTarget.mesh && potentialTarget.mesh.position.x > this.mesh.position.x) { 
                                const distanceSq = this.mesh.position.distanceToSquared(potentialTarget.mesh.position);
                                if (distanceSq < minDistanceSq) { minDistanceSq = distanceSq; closestEnemy = potentialTarget; }
                            }
                        }
                        this.convertedTargetEnemy = closestEnemy;
                    }
                    if (this.convertedTargetEnemy && this.convertedTargetEnemy.mesh) {
                        const spawnPos = new THREE.Vector3(); this.mesh.localToWorld(spawnPos.copy(this.pyramidProjectileSpawnOffset));
                        let direction = this.convertedTargetEnemy.mesh.position.clone().sub(spawnPos);
                         if (direction.lengthSq() < 0.0001) direction.set(1,0,0); 
                        direction.normalize();

                        const baseDamage = (this.type === EnemyType.DOUBLE_SPHERE ? ENEMY_STATS[this.type].collisionDamage * 0.4 : PYRAMID_PROJECTILE_DAMAGE / 2);
                        if (direction.x > 0.1) { 
                            const p = new Projectile(this.scene, spawnPos, direction, CONVERTED_ENEMY_PROJECTILE_COLOR, PYRAMID_PROJECTILE_SPEED, 'converted_enemy', baseDamage, 1.0, false, 100, []);
                            if (p) newProjectiles = [p]; this.lastShotTime = now;
                        }
                    } else {
                        this.convertedTargetEnemy = null; 
                    }
                }
                break;
        }
    } else { 
        this.mesh.position.x -= effectiveSpeed;
        switch (this.type) {
            case EnemyType.CUBE:
                this.mesh.position.y += this.zigzagDirection * this.zigzagSpeed;
                const cubeEffectiveHalfHeight = (0.6 * (this.mesh as THREE.Mesh).scale.y) / 2;
                if (this.mesh.position.y >= this.worldTopEdge - cubeEffectiveHalfHeight || this.mesh.position.y <= this.worldBottomEdge + cubeEffectiveHalfHeight) {
                    this.zigzagDirection *= -1;
                    this.mesh.position.y = Math.max(this.worldBottomEdge + cubeEffectiveHalfHeight, Math.min(this.worldTopEdge - cubeEffectiveHalfHeight, this.mesh.position.y));
                }
                break;
            case EnemyType.RHOMBUS:
                
                break;
            case EnemyType.PYRAMID:
                const targetPosition = playerPosition || (this.playerPositionGetter ? this.playerPositionGetter() : undefined);
                if (this.canShootPyramid && targetPosition && targetPosition.x < this.mesh.position.x && now - this.lastShotTime > this.shootCooldown) {
                    const spawnPos = new THREE.Vector3(); this.mesh.localToWorld(spawnPos.copy(this.pyramidProjectileSpawnOffset));
                    let direction = targetPosition.clone().sub(spawnPos);
                    if (direction.lengthSq() < 0.0001) direction.set(-1,0,0); 
                    direction.normalize();
                    const baseDamage = PYRAMID_PROJECTILE_DAMAGE;
                    if (direction.x < -0.1) { 
                        const p = new Projectile(this.scene, spawnPos, direction, ENEMY_PROJECTILE_COLOR, PYRAMID_PROJECTILE_SPEED, 'enemy', baseDamage, 1.0, false, 100, []);
                        if (p) newProjectiles = [p]; this.lastShotTime = now;
                    }
                }
                break;
            case EnemyType.DOUBLE_SPHERE:
                const targetPlayerDS = playerPosition || (this.playerPositionGetter ? this.playerPositionGetter() : undefined);
                if (targetPlayerDS && targetPlayerDS.x < this.mesh.position.x) {
                    if (this.doubleSphereBurstCount > 0 && now - this.doubleSphereLastBurstShotTime > this.DOUBLE_SPHERE_BURST_DELAY) {
                        newProjectiles = this._shootDoubleSphereBurst(targetPlayerDS) || [];
                    } else if (this.doubleSphereBurstCount <= 0 && now - this.lastShotTime > this.shootCooldown) {
                        this.doubleSphereBurstCount = this.DOUBLE_SPHERE_SHOTS_PER_BURST;
                        newProjectiles = this._shootDoubleSphereBurst(targetPlayerDS) || [];
                        this.lastShotTime = now; 
                    }
                }
                break;
            case EnemyType.HEXAGON:
                 if (gameInstance && now - this.lastShotTime > this.shootCooldown) {
                    const healingOrb = this._shootHealingOrb(gameInstance);
                    if (healingOrb) newProjectiles = [healingOrb];
                    this.lastShotTime = now;
                 }
                break;
            case EnemyType.SPHERE: default: break; 
        }
    }
    if (this.healthBarGroup && this.healthBarGroup.visible && this.scene.camera && !this.isBoss) {
         this.healthBarGroup.quaternion.copy(this.scene.camera.quaternion);
    }
    return newProjectiles;
  }

 public isOutOfBounds(): boolean {
    if (!this.mesh) return true;
    return this.mesh.position.x < this.worldOutOfBoundsX -1;
  }

  public getBoundingBox(): THREE.Box3 {
    const box = new THREE.Box3();
    if (this.mesh) {
        this.mesh.updateWorldMatrix(true, false);
        box.setFromObject(this.mesh, true);
    }
    return box;
  }

  public dispose(): void {
    this.revertTint();
    this.activeEffects = [];
    if (this.healthBarGroup) {
        if (this.mesh) this.mesh.remove(this.healthBarGroup);
        if (this.healthBarBackground && this.healthBarBackground.geometry) this.healthBarBackground.geometry.dispose();
        if (this.healthBarBackground && this.healthBarBackground.material) (this.healthBarBackground.material as THREE.Material).dispose();
        if (this.healthBarForeground && this.healthBarForeground.geometry) this.healthBarForeground.geometry.dispose();
        if (this.healthBarForeground && this.healthBarForeground.material) (this.healthBarForeground.material as THREE.Material).dispose();
        this.healthBarGroup = null; this.healthBarBackground = null; this.healthBarForeground = null;
    }
    if (this.mixer) { this.mixer.stopAllAction(); this.mixer = null; }

    if (this.mesh) {
        if (this.mesh.parent) this.scene.remove(this.mesh);
        if (this.mesh instanceof THREE.Mesh) {
            if (this.mesh.geometry) this.mesh.geometry.dispose();
            if (this.mesh.material instanceof THREE.Material) {
                this.mesh.material.dispose();
            } else if (Array.isArray(this.mesh.material)) {
                this.mesh.material.forEach(mat => mat.dispose());
            }
        } else if (this.mesh instanceof THREE.Group) {
            this.mesh.traverse(object => {
                if (object instanceof THREE.Mesh) {
                    object.geometry?.dispose();
                    if (object.material instanceof THREE.Material) {
                        object.material.dispose();
                    } else if (Array.isArray(object.material)) {
                        object.material.forEach(mat => mat.dispose());
                    }
                }
            });
        }
    }
    this.mesh = null;
  }
}

    