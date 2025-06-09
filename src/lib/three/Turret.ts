
import * as THREE from 'three';
import type Player from './Player';
import type Enemy from './Enemy';
import Projectile from './Projectile';
import type Game from './Game';
import { PLAYER_PROJECTILE_COLOR, PlayerStatType as PStats } from '@/types';

const TURRET_SIZE = 0.2;
const TURRET_FIRE_COOLDOWN_BASE_MS = 700;
const TURRET_TARGETING_RANGE_SQ = 400;

export default class Turret {
  public mesh: THREE.Group;
  private ownerPlayer: Player;
  private relativePosition: THREE.Vector3;
  private lastFireTime: number = 0;
  private targetEnemy: Enemy | null = null;
  private projectileSpawnOffsetLocal: THREE.Vector3;
  private modelNode: THREE.Object3D | null = null;

  constructor(ownerPlayer: Player, relativePosition: THREE.Vector3, scene: THREE.Scene, turretModel: THREE.Group) {
    this.ownerPlayer = ownerPlayer;
    this.relativePosition = relativePosition;

    this.mesh = new THREE.Group(); // This group will hold the loaded model
    this.mesh.position.copy(this.relativePosition);
    this.ownerPlayer.mesh.add(this.mesh);

    this.projectileSpawnOffsetLocal = new THREE.Vector3(0.15, 0, 0); // Relative to turret's orientation

    this.initializeModel(turretModel);
  }

  private initializeModel(turretModelInstance: THREE.Group): void {
    this.modelNode = turretModelInstance; // Use the pre-loaded and cloned model
    this.modelNode.scale.set(0.075, 0.075, 0.075);
    this.modelNode.rotation.y = Math.PI / 2; // Orient to face "forward" from player's perspective initially
                                         // Actual aiming is done by rotating the parent `this.mesh` group
    this.modelNode.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    this.mesh.add(this.modelNode); // Add the actual model to the turret's group
  }


  public update(deltaTime: number, enemies: Enemy[], gameInstance: Game): void {
    this.findTarget(enemies);
    this.aim();
    this.attemptShoot(gameInstance);
  }

  private findTarget(enemies: Enemy[]): void {
    if (this.targetEnemy && (this.targetEnemy.health <= 0 || this.targetEnemy.isConverted || this.targetEnemy.isOutOfBounds())) {
      this.targetEnemy = null;
    }
    if (!this.targetEnemy) {
      let closestEnemy: Enemy | null = null;
      let minDistanceSq = TURRET_TARGETING_RANGE_SQ;
      const turretWorldPosition = new THREE.Vector3();
      this.mesh.getWorldPosition(turretWorldPosition); // Get world position of the turret's group
      for (const enemy of enemies) {
        if (enemy.isConverted || enemy.health <= 0 || enemy.isOutOfBounds()) continue;
        // Turrets should shoot enemies in front of the player, not behind.
        // Compare enemy X relative to player's X or turret's world X.
        if (enemy.mesh.position.x < turretWorldPosition.x - TURRET_SIZE * 2) continue;
        const distanceSq = turretWorldPosition.distanceToSquared(enemy.mesh.position);
        if (distanceSq < minDistanceSq) {
          minDistanceSq = distanceSq;
          closestEnemy = enemy;
        }
      }
      this.targetEnemy = closestEnemy;
    }
  }

  private aim(): void {
    if (this.targetEnemy && this.targetEnemy.mesh && this.modelNode) {
      const targetWorldPosition = this.targetEnemy.mesh.position.clone();
      const turretWorldPosition = new THREE.Vector3();
      this.mesh.getWorldPosition(turretWorldPosition); // Use the group's world position

      const directionToTarget = targetWorldPosition.sub(turretWorldPosition);
      const angle = Math.atan2(directionToTarget.y, directionToTarget.x);
      
      // Rotate the turret's group (this.mesh) to aim.
      // The modelNode inside is already oriented "forward" (e.g., along its local +X or +Z).
      // If model's "forward" is local +X, this angle directly applies to Z rotation of the group.
      this.mesh.rotation.z = angle; 
    } else if (this.modelNode) {
      // Optional: Smoothly return to a default orientation if no target
      this.mesh.rotation.z += (0 - this.mesh.rotation.z) * 0.1;
    }
  }

  private attemptShoot(gameInstance: Game): void {
    if (!this.targetEnemy || this.ownerPlayer.isDashing || !this.modelNode) return;

    const playerStats = this.ownerPlayer.stats;
    const effectiveFireCooldown = TURRET_FIRE_COOLDOWN_BASE_MS * (100 / Math.max(1, 100 + playerStats.attackSpeedBonusPercent));

    if (Date.now() - this.lastFireTime > effectiveFireCooldown) {
      // Projectile spawn position: transform local offset by the turret group's world matrix
      const spawnPosWorld = new THREE.Vector3();
      this.mesh.localToWorld(spawnPosWorld.copy(this.projectileSpawnOffsetLocal));

      const directionToTarget = this.targetEnemy.mesh.position.clone().sub(spawnPosWorld).normalize();
      
      // Check if target is roughly in front of the turret model
      // The turret group (this.mesh) is rotated. Its world quaternion defines its orientation.
      // A vector pointing "forward" from the turret group.
      const turretForward = new THREE.Vector3(1,0,0).applyQuaternion(this.mesh.quaternion);
      if (directionToTarget.dot(turretForward) < 0.3) { // Target needs to be somewhat in front
          return;
      }

      const baseDamageTurret = playerStats.getEffectiveProjectileDamage();
      const scale = playerStats.getEffectiveProjectileScale();
      const speedMultiplier = playerStats.getEffectiveProjectileSpeedMultiplier();
      let isCrit = false;
      if (Math.random() * 100 < playerStats.getEffectiveCritChancePercent()) { isCrit = true; }
      const critDamageMult = playerStats.getEffectiveCritDamageMultiplierPercent();
      const statusEffects: { type: PStats, value: number }[] = [];

      const projectile = new Projectile(
          gameInstance.scene, spawnPosWorld, directionToTarget, PLAYER_PROJECTILE_COLOR,
          speedMultiplier, 'player', baseDamageTurret, scale, isCrit, critDamageMult, statusEffects
      );
      gameInstance.projectiles.push(projectile);
      this.lastFireTime = Date.now();
    }
  }

  public dispose(): void {
    if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
    // Model geometry and material are managed by the Game's LoadingManager
    // or disposed when the player model is disposed if it's a shared asset.
    // Here, we just ensure the group is cleaned up.
    this.mesh.clear(); // Removes all children
  }
}
