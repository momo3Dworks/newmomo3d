
import * as THREE from 'three';
import Projectile from './Projectile';
import MuzzleFlash from './MuzzleFlash';
import Turret from './Turret';
import { PlayerStatsManager } from '@/lib/game-logic/playerStatsManager';
import type { ActiveStatusEffect, PlayerStatType, ProjectileStatusEffectData, UnlockableAbilityType } from '@/types';
import {
    PlayerStatType as PStats,
    PLAYER_INITIAL_PROJECTILE_DAMAGE,
    PLAYER_INITIAL_HEALTH,
    PLAYER_PROJECTILE_COLOR,
    MAX_TURRETS,
    UnlockableAbilityType as UAType,
} from '@/types';
import { HexShieldShader } from './shaders/HexShieldShader';
import type Game from './Game';

const ACCELERATION_FACTOR = 0.022;
const DAMPING_FACTOR = 0.82;
const MAX_SPEED = 0.15;

const MAX_PITCH_ANGLE = Math.PI / 18;
const PITCH_ADJUST_SPEED = 0.08;
const MAX_ROLL_ANGLE = Math.PI / 20;
const ROLL_ADJUST_SPEED = 0.08;

const DASH_DISTANCE = 3.0;
const DASH_DURATION_MS = 180;
const DASH_COOLDOWN_MS = 1200;

const SPREAD_SHOTGUN_BASE_PROJECTILE_COUNT = 3; // Central + 2 spread
const SPREAD_SHOTGUN_DURATION_MS = 10000;
const SPREAD_SHOTGUN_ANGLE_DEG = 40; 

export default class Player {
  public mesh: THREE.Group;
  private scene: THREE.Scene;
  private canShoot: boolean = true;

  private playerHalfWidth: number = 0.3;
  private playerHalfHeight: number = 0.4;
  private projectileSpawnOffset: number = 0.5;

  private worldTopBoundary!: number;
  private worldBottomBoundary!: number;
  private worldLeftBoundary!: number;
  private worldRightBoundary!: number;

  public static PLAYER_HEIGHT = 0.8;
  public static PLAYER_WIDTH = 0.6;

  private velocity: THREE.Vector2;
  private modelNode: THREE.Object3D | null = null;

  private currentPitch: number = 0;
  private targetPitch: number = 0;
  private currentRoll: number = 0;
  private targetRoll: number = 0;

  private mixer: THREE.AnimationMixer | null = null;
  private muzzleFlash: MuzzleFlash | null = null;
  public stats: PlayerStatsManager;
  public health: number;
  public maxHealth: number;
  public shieldMesh: THREE.Mesh | null = null;

  private isFlashingRed: boolean = false;
  private flashRedEndTime: number = 0;
  private originalMaterials: Map<string, { emissive: THREE.Color, emissiveIntensity: number }> = new Map();

  public isDashing: boolean = false;
  private dashStartTime: number = 0;
  public lastDashTime: number = 0;
  private dashInitialX: number = 0;

  public turrets: Turret[] = [];
  private lastPlayerShotTime: number = 0;
  private gameInstance: Game;
  private loadedPlayerModel: THREE.Group;
  private loadedMuzzleFlashTexture: THREE.Texture;
  private loadedTurretModel: THREE.Group;

  public isSpreadShotgunActive: boolean = false;
  public spreadShotgunEndTime: number = 0;

  private shootSound: HTMLAudioElement | null = null;


  constructor(
    scene: THREE.Scene,
    initialXPosition: number,
    worldTop: number, worldBottom: number, worldLeft: number, worldRight: number,
    gameInstance: Game,
    playerModel: THREE.Group,
    muzzleFlashTexture: THREE.Texture,
    turretModel: THREE.Group
    ) {
    this.scene = scene;
    this.mesh = new THREE.Group();
    this.velocity = new THREE.Vector2(0, 0);
    this.stats = new PlayerStatsManager();
    this.maxHealth = this.stats.getEffectiveMaxHealth();
    this.health = this.maxHealth;
    this.gameInstance = gameInstance;
    this.loadedPlayerModel = playerModel;
    this.loadedMuzzleFlashTexture = muzzleFlashTexture;
    this.loadedTurretModel = turretModel;

    this.updateBoundary(worldTop, worldBottom, worldLeft, worldRight);
    this.initializeModel();

    this.mesh.position.x = initialXPosition;
    this.mesh.position.y = (this.worldTopBoundary + this.worldBottomBoundary) / 2;
    this.mesh.position.z = 0;

    // Initialize shoot sound
    if (typeof window !== 'undefined') { // Ensure Audio is available (client-side)
        this.shootSound = new Audio('/audio/SNFX/SHOT1.mp3');
        this.shootSound.preload = 'auto';
    }


    scene.add(this.mesh);
  }

  private initializeModel(): void {
    this.modelNode = this.loadedPlayerModel;

    this.modelNode.position.set(0, 0, 0);
    this.modelNode.rotation.y = Math.PI / 2;
    this.modelNode.scale.set(0.04, 0.04, 0.04);
    this.mesh.add(this.modelNode);

    const tempBox = new THREE.Box3().setFromObject(this.modelNode);
    const size = tempBox.getSize(new THREE.Vector3());
    Player.PLAYER_WIDTH = size.x;
    Player.PLAYER_HEIGHT = size.y;
    this.playerHalfWidth = Player.PLAYER_WIDTH / 2;
    this.playerHalfHeight = Player.PLAYER_HEIGHT / 2;
    this.projectileSpawnOffset = Player.PLAYER_WIDTH / 2;

    this.setupMuzzleFlash();
    this.setupShieldVisual();

    this.modelNode.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }


  private setupMuzzleFlash(): void {
    const MUZZLE_FLASH_LOCAL_POSITION = new THREE.Vector3(this.projectileSpawnOffset + 0.25, -0.02, 0);
    const MUZZLE_FLASH_LOCAL_ROTATION = new THREE.Euler(0, Math.PI / 17, 0);
    const MUZZLE_FLASH_LOCAL_SCALE = new THREE.Vector3(1, 5, 1);
    const MUZZLE_FLASH_SPRITE_PLANE_SIZE = 0.6;
    const MUZZLE_FLASH_UV_OFFSET_X = -0.2;
    const MUZZLE_FLASH_UV_OFFSET_Y = 0.0;

    this.muzzleFlash = new MuzzleFlash(
        this.scene,
        this.loadedMuzzleFlashTexture,
        4, 1, 4, 0.3,
        MUZZLE_FLASH_SPRITE_PLANE_SIZE,
        MUZZLE_FLASH_UV_OFFSET_X,
        MUZZLE_FLASH_UV_OFFSET_Y
    );
    this.mesh.add(this.muzzleFlash.mesh);
    this.muzzleFlash.mesh.position.copy(MUZZLE_FLASH_LOCAL_POSITION);
    this.muzzleFlash.mesh.rotation.copy(MUZZLE_FLASH_LOCAL_ROTATION);
    this.muzzleFlash.mesh.scale.copy(MUZZLE_FLASH_LOCAL_SCALE);
  }

  public setupShieldVisual(): void {
    if (!this.modelNode) return;
    const shieldGeometry = new THREE.SphereGeometry(Math.max(Player.PLAYER_WIDTH, Player.PLAYER_HEIGHT) * 0.85, 32, 32);
    const shieldUniforms = THREE.UniformsUtils.clone(HexShieldShader.uniforms);
    shieldUniforms.uColor.value.setHex(0x300005); shieldUniforms.uGlowColor.value = new THREE.Color(0xff0000).multiplyScalar(4.5);
    shieldUniforms.uHexSize.value = 0.52; shieldUniforms.uBorderThickness.value = 0.4;
    shieldUniforms.uBaseOpacity.value = 0.08; shieldUniforms.uPulseSpeed.value = 2.5 * 3.5;
    shieldUniforms.uRotationSpeed.value = 0.55 * 1.5; shieldUniforms.uSurfaceDistortionSpeed.value = 0.5 * 1.5;
    shieldUniforms.uPulseAmount.value = 0.35; shieldUniforms.uFresnelPower.value = 3.5;
    shieldUniforms.uReflectivity.value = 0.3; shieldUniforms.uSurfaceDistortionAmount.value = 0.05;
    shieldUniforms.uHitEffectTime.value = 0.0;
    if (this.gameInstance && this.gameInstance.generatedEnvMap) {
        shieldUniforms.uEnvMap.value = this.gameInstance.generatedEnvMap;
    }
    const shieldShaderMaterial = new THREE.ShaderMaterial({
      uniforms: shieldUniforms, vertexShader: HexShieldShader.vertexShader, fragmentShader: HexShieldShader.fragmentShader,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.FrontSide,
    });
    this.shieldMesh = new THREE.Mesh(shieldGeometry, shieldShaderMaterial);
    this.shieldMesh.visible = false; this.mesh.add(this.shieldMesh);
  }

  private updateShieldVisual(deltaTime: number): void {
    if (this.shieldMesh && this.shieldMesh.material instanceof THREE.ShaderMaterial) {
      this.shieldMesh.visible = this.stats.shieldCharges > 0;
      const material = this.shieldMesh.material as THREE.ShaderMaterial;
      material.uniforms.uTime.value += deltaTime;
      if (material.uniforms.uHitEffectTime.value > 0.0) {
          material.uniforms.uHitEffectTime.value -= deltaTime * 2.5;
          material.uniforms.uHitEffectTime.value = Math.max(0.0, material.uniforms.uHitEffectTime.value);
      }
    }
  }

  public updateBoundary(worldTop: number, worldBottom: number, worldLeft: number, worldRight: number): void {
    this.worldTopBoundary = worldTop; this.worldBottomBoundary = worldBottom;
    this.worldLeftBoundary = worldLeft; this.worldRightBoundary = worldRight;
  }

  public startDash(): void {
    const now = performance.now();
    if (this.isDashing || (now - this.lastDashTime < DASH_COOLDOWN_MS)) return;
    this.isDashing = true; this.dashStartTime = now; this.lastDashTime = now;
    this.dashInitialX = this.mesh.position.x;
  }

  public update(movement: { left: boolean; right: boolean; up: boolean; down: boolean }, deltaTime: number, gameInstance?: Game): void {
    const currentHalfWidth = this.modelNode ? Player.PLAYER_WIDTH / 2 : this.playerHalfWidth;
    const currentHalfHeight = this.modelNode ? Player.PLAYER_HEIGHT / 2 : this.playerHalfHeight;
    const effectiveLeftBoundary = this.worldLeftBoundary + currentHalfWidth;
    const effectiveRightBoundary = this.worldRightBoundary - currentHalfWidth;
    const effectiveTopBoundary = this.worldTopBoundary - currentHalfHeight;
    const effectiveBottomBoundary = this.worldBottomBoundary + currentHalfHeight;

    if (this.isDashing) {
      const now = performance.now(); const elapsedDashTime = now - this.dashStartTime;
      const progress = Math.min(elapsedDashTime / DASH_DURATION_MS, 1.0);
      this.mesh.position.x = THREE.MathUtils.lerp(this.dashInitialX, this.dashInitialX + DASH_DISTANCE, progress);
      const verticalAcceleration = new THREE.Vector2(0, 0);
      if (movement.up) verticalAcceleration.y += ACCELERATION_FACTOR; if (movement.down) verticalAcceleration.y -= ACCELERATION_FACTOR;
      this.velocity.y += verticalAcceleration.y; this.velocity.y *= DAMPING_FACTOR;
      if (Math.abs(this.velocity.y) > MAX_SPEED) this.velocity.y = Math.sign(this.velocity.y) * MAX_SPEED;
      if (Math.abs(this.velocity.y) < 0.001) this.velocity.y = 0;
      this.mesh.position.y += this.velocity.y;
      if (gameInstance && this.stats.dashAttackDamage > 0) {
        const playerBox = this.getBoundingBox();
        for (let i = gameInstance.enemies.length - 1; i >= 0; i--) {
          const enemy = gameInstance.enemies[i];
          if (!enemy || !enemy.mesh || enemy.isConverted || enemy.health <= 0) continue;
          const enemyBox = enemy.getBoundingBox();
          if (playerBox.intersectsBox(enemyBox)) {
            const damageResult = enemy.takeDamage(this.stats.dashAttackDamage, this.stats.dashAttackDamage, false, gameInstance);
            const damageColor = 0xffddaa; 
            const damageText = new (this.scene.userData.FloatingDamageText as typeof FloatingDamageText)(this.scene, damageResult.actualDamageDealt.toString(), enemy.mesh.position.clone().add(new THREE.Vector3(0,0.3,0)), damageColor, false);
            gameInstance.floatingDamageNumbers.push(damageText);
            if (damageResult.didDie && enemy.mesh) gameInstance.handleEnemyDeath(enemy, enemy.mesh.position.clone());
          }
        }
      }
      if (progress >= 1.0) { this.isDashing = false; this.velocity.x = 0; }
    } else {
      const acceleration = new THREE.Vector2(0, 0);
      if (movement.left) acceleration.x -= ACCELERATION_FACTOR; if (movement.right) acceleration.x += ACCELERATION_FACTOR;
      if (movement.up) acceleration.y += ACCELERATION_FACTOR; if (movement.down) acceleration.y -= ACCELERATION_FACTOR;
      this.velocity.add(acceleration); this.velocity.multiplyScalar(DAMPING_FACTOR);
      if (this.velocity.length() > MAX_SPEED) this.velocity.normalize().multiplyScalar(MAX_SPEED);
      if (this.velocity.lengthSq() < 0.0001) this.velocity.set(0,0);
      this.mesh.position.x += this.velocity.x; this.mesh.position.y += this.velocity.y;
    }

    this.mesh.position.x = Math.max(effectiveLeftBoundary, Math.min(effectiveRightBoundary, this.mesh.position.x));
    this.mesh.position.y = Math.max(effectiveBottomBoundary, Math.min(effectiveTopBoundary, this.mesh.position.y));
    if (!this.isDashing) { if (this.mesh.position.x === effectiveLeftBoundary || this.mesh.position.x === effectiveRightBoundary) this.velocity.x = 0; }
    if (this.mesh.position.y === effectiveBottomBoundary || this.mesh.position.y === effectiveTopBoundary) this.velocity.y = 0;

    if (this.modelNode) {
      this.targetPitch = 0;
      if (Math.abs(this.velocity.y) > 0.005) {
        this.targetPitch = MAX_PITCH_ANGLE * (this.velocity.y / MAX_SPEED);
      }
      this.currentPitch = THREE.MathUtils.lerp(this.currentPitch, this.targetPitch, PITCH_ADJUST_SPEED);
      this.modelNode.rotation.z = this.currentPitch;

      this.targetRoll = 0;
      if (Math.abs(this.velocity.x) > 0.005) {
          this.targetRoll = -MAX_ROLL_ANGLE * (this.velocity.x / MAX_SPEED);
      }
      this.currentRoll = THREE.MathUtils.lerp(this.currentRoll, this.targetRoll, ROLL_ADJUST_SPEED);
      this.modelNode.rotation.x = this.currentRoll;
    }

    if (this.mixer) this.mixer.update(deltaTime);
    if (this.muzzleFlash) this.muzzleFlash.update(deltaTime);
    this.updateShieldVisual(deltaTime);
    this.updateTurrets(deltaTime, gameInstance);

    if (this.isSpreadShotgunActive) {
      const now = performance.now();
      if (now >= this.spreadShotgunEndTime) {
        this.isSpreadShotgunActive = false;
        // No need to send event here, GameContainer will reflect based on this.stats.spreadShotgunUnlocked
      }
      // Timer update is handled by GameContainer based on player stats
      const remainingSeconds = Math.max(0, Math.ceil((this.spreadShotgunEndTime - now) / 1000));
      this.gameInstance.onGameEvent({ type: 'spreadShotgunTimerUpdate', spreadShotgunRemainingSeconds: remainingSeconds });
    }
  }

  private updateTurrets(deltaTime: number, gameInstance?: Game): void {
    if (!gameInstance || !this.loadedTurretModel) return;
    if (this.turrets.length < this.stats.turretCount) {
      const turretIndex = this.turrets.length;
      let relativeY = (Player.PLAYER_HEIGHT / 2 + 0.15);
      if (turretIndex === 1) relativeY = -(Player.PLAYER_HEIGHT / 2 + 0.15);
      const newTurret = new Turret(this, new THREE.Vector3(0, relativeY, 0), this.scene, this.loadedTurretModel.clone());
      this.turrets.push(newTurret);
    } else if (this.turrets.length > this.stats.turretCount) {
      const turretToRemove = this.turrets.pop();
      turretToRemove?.dispose();
    }
    for (const turret of this.turrets) turret.update(deltaTime, gameInstance.enemies, gameInstance);
  }

  public shoot(): Projectile | Projectile[] | null {
    if (!this.canShoot || this.isDashing) return null;

    if (this.muzzleFlash) this.muzzleFlash.start();

    if (this.shootSound) {
        const volumes = [0.6, 0.8, 1.0];
        this.shootSound.volume = volumes[Math.floor(Math.random() * volumes.length)];
        this.shootSound.currentTime = 0; // Rewind to start
        this.shootSound.play().catch(error => console.warn("Error playing shoot sound:", error));
    }


    const projectileStartWorldPosition = new THREE.Vector3();
    const currentSpawnOffset = this.modelNode ? Player.PLAYER_WIDTH / 2 + 0.1 : this.projectileSpawnOffset + 0.1;
    const localSpawnPoint = new THREE.Vector3(currentSpawnOffset, 0, 0);
    this.mesh.localToWorld(projectileStartWorldPosition.copy(localSpawnPoint));

    const baseDamage = this.stats.getEffectiveProjectileDamage();
    const scale = this.stats.getEffectiveProjectileScale();
    let speedMultiplier = this.stats.getEffectiveProjectileSpeedMultiplier();
    
    const effectsToApply: ProjectileStatusEffectData[] = [];
    if (this.stats.rollForBurn()) {
        effectsToApply.push({ 
            type: PStats.BurnChancePercent, 
            duration: this.stats.burnDurationSeconds,
            damagePerTick: this.stats.burnDamagePerTick,
            tickInterval: this.stats.burnTickIntervalSeconds,
        });
    }
    if (this.stats.rollForFreeze()) {
        effectsToApply.push({
            type: PStats.FreezeChancePercent,
            duration: this.stats.freezeDurationSeconds,
            slowFactor: this.stats.freezeSlowPercent / 100, 
        });
    }
    if (this.stats.rollForStun()) {
        effectsToApply.push({
            type: PStats.StunChancePercent,
            totalStunDuration: this.stats.stunTotalDebuffDurationSeconds,
            stunPhaseDuration: this.stats.stunDurationSeconds,
            stunMoveInterval: this.stats.stunIntervalSeconds,
        });
    }
    if (this.stats.rollForPoison()) {
         effectsToApply.push({
            type: PStats.PoisonChancePercent,
            duration: this.stats.poisonDurationSeconds,
            damagePerTick: this.stats.poisonDamagePerTick,
            tickInterval: this.stats.poisonTickIntervalSeconds,
        });
    }


    let isCrit = false;
    if (Math.random() * 100 < this.stats.getEffectiveCritChancePercent()) isCrit = true;
    const critDamageMult = this.stats.getEffectiveCritDamageMultiplierPercent();

    const projectilesToReturn: Projectile[] = [];

    if (this.isSpreadShotgunActive) {
        const spreadAngleRad = THREE.MathUtils.degToRad(SPREAD_SHOTGUN_ANGLE_DEG);
        const angleStep = spreadAngleRad / (SPREAD_SHOTGUN_BASE_PROJECTILE_COUNT -1);
        const startAngle = -spreadAngleRad / 2;
        const shotgunSpeedMultiplier = speedMultiplier * 0.5; // Halve speed for shotgun

        for (let i = 0; i < SPREAD_SHOTGUN_BASE_PROJECTILE_COUNT; i++) {
            const angle = startAngle + i * angleStep;
            const direction = new THREE.Vector3(1, 0, 0); 
            direction.applyAxisAngle(new THREE.Vector3(0, 0, 1), angle); 
            
            const worldDirection = direction.clone().applyQuaternion(this.mesh.quaternion);

            projectilesToReturn.push(new Projectile(
                this.scene, projectileStartWorldPosition.clone(), worldDirection,
                PLAYER_PROJECTILE_COLOR, shotgunSpeedMultiplier, 'player', // Use halved speed
                baseDamage * 0.6, 
                scale * 0.8, isCrit, critDamageMult,
                [...effectsToApply] 
            ));
        }
    } else {
        // Standard forward projectile
        projectilesToReturn.push(new Projectile(
            this.scene, projectileStartWorldPosition.clone(), new THREE.Vector3(1, 0, 0).applyQuaternion(this.mesh.quaternion),
            PLAYER_PROJECTILE_COLOR, speedMultiplier, 'player',
            baseDamage,
            scale, isCrit, critDamageMult,
            effectsToApply
        ));

        // "BACK IS GOOD TOO" - if unlocked
        if (this.stats.backwardsShotUnlocked) {
            const backwardsSpawnOffset = this.modelNode ? -Player.PLAYER_WIDTH / 2 - 0.1 : -this.projectileSpawnOffset - 0.1;
            const backwardsLocalSpawnPoint = new THREE.Vector3(backwardsSpawnOffset, 0, 0);
            const backwardsProjectileStartWorldPosition = new THREE.Vector3();
            this.mesh.localToWorld(backwardsProjectileStartWorldPosition.copy(backwardsLocalSpawnPoint));
            
            projectilesToReturn.push(new Projectile(
                this.scene, backwardsProjectileStartWorldPosition, new THREE.Vector3(-1, 0, 0).applyQuaternion(this.mesh.quaternion),
                PLAYER_PROJECTILE_COLOR, speedMultiplier * 0.8, 'player', // Slightly slower?
                baseDamage * 0.7, // Slightly less damage?
                scale * 0.9, isCrit, critDamageMult, // Slightly smaller?
                effectsToApply // Potentially different/no effects for back shot?
            ));
        }
    }

    this.canShoot = false; this.lastPlayerShotTime = performance.now();
    setTimeout(() => { this.canShoot = true; }, this.stats.getEffectiveAttackCooldownMs());
    
    return projectilesToReturn; // Always return array
  }

  public takeDamage(amount: number): number {
    if (this.isDashing) return 0;
    let damageToHealth = amount; let shieldWasHit = false;
    if (this.stats.shieldCharges > 0) {
        shieldWasHit = true;
        const reduction = amount * (this.stats.getShieldDamageReductionPercent() / 100);
        const damageAfterShield = Math.max(0, amount - reduction);
        this.stats.consumeShieldCharge();
        if (this.shieldMesh && this.shieldMesh.material instanceof THREE.ShaderMaterial) {
            (this.shieldMesh.material as THREE.ShaderMaterial).uniforms.uHitEffectTime.value = 1.0;
        }
        damageToHealth = damageAfterShield;
    }
    this.health -= damageToHealth; this.health = Math.max(0, this.health);
    if (!shieldWasHit && damageToHealth > 0 && (this.scene.userData as any).clock) {
        this.startFlashingRed(0.3, (this.scene.userData as any).clock as THREE.Clock);
    }
    return damageToHealth;
  }

  public heal(amount: number): void { this.health = Math.min(this.maxHealth, this.health + amount); }

  public updateMaxHealth(): void {
    const oldMaxHealth = this.maxHealth; this.maxHealth = this.stats.getEffectiveMaxHealth();
    const diff = this.maxHealth - oldMaxHealth; if (diff > 0) this.health += diff;
    this.health = Math.min(this.health, this.maxHealth);
  }

  public getBoundingBox(): THREE.Box3 {
    const box = new THREE.Box3(); this.mesh.updateWorldMatrix(true, false);
    if (this.modelNode) box.setFromObject(this.modelNode, true);
    else {
        const fallbackWidth = Player.PLAYER_WIDTH > 0 ? Player.PLAYER_WIDTH : 0.6;
        const fallbackHeight = Player.PLAYER_HEIGHT > 0 ? Player.PLAYER_HEIGHT : 0.8;
        const fallbackDepth = 0.6; const fallbackSize = new THREE.Vector3(fallbackWidth, fallbackHeight, fallbackDepth);
        const worldPosition = new THREE.Vector3(); this.mesh.getWorldPosition(worldPosition);
        box.setFromCenterAndSize(worldPosition, fallbackSize);
    }
    return box;
  }

  public resetForNewGame(): void {
    this.stats.resetStats(); 
    this.maxHealth = this.stats.getEffectiveMaxHealth(); 
    this.health = this.maxHealth;
    this.mesh.position.x = this.worldLeftBoundary + (this.worldRightBoundary - this.worldLeftBoundary) / 4;
    this.mesh.position.y = (this.worldTopBoundary + this.worldBottomBoundary) / 2;
    this.velocity.set(0,0);
    if (this.modelNode) {
        this.modelNode.rotation.x = 0;
        this.modelNode.rotation.z = 0;
    }
    this.currentPitch = 0; this.targetPitch = 0; this.currentRoll = 0; this.targetRoll = 0;
    this.isFlashingRed = false; this.flashRedEndTime = 0; this.originalMaterials.clear();
    if (this.shieldMesh && this.shieldMesh.material instanceof THREE.ShaderMaterial) {
        (this.shieldMesh.material as THREE.ShaderMaterial).uniforms.uHitEffectTime.value = 0.0;
    }
    this.isDashing = false; this.lastDashTime = 0;
    this.turrets.forEach(turret => turret.dispose()); this.turrets = [];
    this.isSpreadShotgunActive = false;
    this.spreadShotgunEndTime = 0;
    // Send initial unlocked abilities status
    this.gameInstance.onGameEvent({ type: 'specialAttackUpdate', unlockedAbilities: this.stats.getUnlockedAbilitiesStatus() });
  }

  public startFlashingRed(duration: number, clock: THREE.Clock): void {
    if (this.isFlashingRed || !this.modelNode) return;
    this.isFlashingRed = true; this.flashRedEndTime = clock.getElapsedTime() + duration;
    this.originalMaterials.clear();
    this.modelNode.traverse((object) => {
        if (object instanceof THREE.Mesh && object.material) {
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            materials.forEach(material => {
                if (material instanceof THREE.MeshStandardMaterial) {
                    if (!this.originalMaterials.has(material.uuid)) {
                        this.originalMaterials.set(material.uuid, { emissive: material.emissive.clone(), emissiveIntensity: material.emissiveIntensity });
                    }
                    material.emissive.setHex(0xff0000); material.emissiveIntensity = 1.5;
                }
            });
        }
    });
  }

  public updateFlashRed(clock: THREE.Clock): void {
    if (!this.isFlashingRed || !this.modelNode) return;
    if (clock.getElapsedTime() >= this.flashRedEndTime) {
        this.isFlashingRed = false;
        this.modelNode.traverse((object) => {
            if (object instanceof THREE.Mesh && object.material) {
                const materials = Array.isArray(object.material) ? object.material : [object.material];
                materials.forEach(material => {
                    if (material instanceof THREE.MeshStandardMaterial) {
                        const original = this.originalMaterials.get(material.uuid);
                        if (original) { material.emissive.copy(original.emissive); material.emissiveIntensity = original.emissiveIntensity; }
                        else { material.emissive.setHex(0x000000); material.emissiveIntensity = 0; }
                    }
                });
            }
        });
        this.originalMaterials.clear();
    }
  }

  public activateSpecial(abilitySlot: number): void { // slotIndex is 0-5
    let abilityType: UnlockableAbilityType | null = null;
    switch (abilitySlot) {
        case 0: if (this.stats.superLaserUnlocked) abilityType = UAType.SUPER_LASER; break;
        case 1: if (this.stats.spreadShotgunUnlocked) abilityType = UAType.SPREAD_SHOTGUN; break;
        case 2: if (this.stats.iAmNuclearUnlocked) abilityType = UAType.I_AM_NUCLEAR; break;
        case 3: if (this.stats.backwardsShotUnlocked) { /* Handled by normal shoot, no "activation" */ return; } break; 
        // case 4: if (this.stats.bbpUnlocked) abilityType = UAType.BBP; break; // TODO
        // case 5: if (this.stats.crescentMoonUnlocked) abilityType = UAType.CRESCENT_MOON; break; // TODO
    }

    if (!abilityType) return;

    // Logic for activating the ability (Super Laser, Shotgun, Nuclear)
    // We "consume" the ability for one-time use by temporarily disabling its "unlocked" state.
    // This is a simplification; a more robust system might use charges or cooldowns tied to the tech tree.

    switch (abilityType) {
      case UAType.SUPER_LASER:
        this.gameInstance.triggerSuperLaser(this.mesh.position, this.mesh.quaternion);
        this.stats.superLaserUnlocked = false; // Consumed
        break;
      case UAType.SPREAD_SHOTGUN:
        this.isSpreadShotgunActive = true;
        this.spreadShotgunEndTime = performance.now() + SPREAD_SHOTGUN_DURATION_MS;
        this.gameInstance.onGameEvent({ type: 'spreadShotgunTimerUpdate', spreadShotgunRemainingSeconds: Math.ceil(SPREAD_SHOTGUN_DURATION_MS / 1000) });
        this.stats.spreadShotgunUnlocked = false; // Consumed
        break;
      case UAType.I_AM_NUCLEAR:
        this.gameInstance.triggerNuclearExplosion(this.mesh.position);
        this.stats.iAmNuclearUnlocked = false; // Consumed
        break;
    }
    this.gameInstance.onGameEvent({ type: 'specialAttackUpdate', unlockedAbilities: this.stats.getUnlockedAbilitiesStatus() });
  }


  public dispose(): void {
    if (this.mixer) { this.mixer.stopAllAction(); this.mixer = null; }
    if (this.muzzleFlash) { this.muzzleFlash.dispose(); this.muzzleFlash = null; }
    if (this.shootSound) {
        this.shootSound.pause();
        this.shootSound.src = ''; // Release the resource
        this.shootSound = null;
    }
    if (this.shieldMesh) {
      this.mesh.remove(this.shieldMesh); this.shieldMesh.geometry.dispose();
      if (this.shieldMesh.material instanceof THREE.Material) this.shieldMesh.material.dispose();
      this.shieldMesh = null;
    }
    this.turrets.forEach(turret => turret.dispose()); this.turrets = [];
    if (this.mesh.parent) this.scene.remove(this.mesh);
    this.mesh.traverse(child => {
      if (child !== this.mesh && child instanceof THREE.Mesh) {
        if (!(child.userData.isTurretPlaceholder)) {
            child.geometry?.dispose();
            const material = child.material as THREE.Material | THREE.Material[];
            if (Array.isArray(material)) material.forEach(mat => mat?.dispose());
            else if (material) material.dispose();
        }
      }
    });
    if (this.modelNode) this.modelNode = null;
  }
}


    