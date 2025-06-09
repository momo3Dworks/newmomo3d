
import * as THREE from 'three';
import type { PlayerStatType, ProjectileStatusEffectData } from '@/types';

const BASE_PROJECTILE_SPEED = 0.4; // Player base projectile speed before multipliers

export default class Projectile {
  public mesh: THREE.Mesh;
  private scene: THREE.Scene;
  private speed: number;
  private direction: THREE.Vector3;
  public owner: 'player' | 'enemy' | 'converted_enemy' | 'enemy_heal';
  public baseDamage: number; // For damage projectiles, or healAmount for healing ones
  public finalDamage: number; // For damage projectiles
  public isCriticalHit: boolean;
  public critDamageMultiplierPercent: number; // e.g., 150 for 1.5x
  public statusEffectsToApply: ProjectileStatusEffectData[];
  public isHealingOrb: boolean;

  constructor(
    scene: THREE.Scene,
    startPosition: THREE.Vector3,
    direction: THREE.Vector3,
    color: THREE.ColorRepresentation,
    speedMultiplierOrAbsoluteSpeed: number,
    owner: 'player' | 'enemy' | 'converted_enemy' | 'enemy_heal',
    inputDamageOrHealAmount: number,
    projectileVisualScale: number,
    isCrit: boolean,
    critDamageMultPercent: number,
    statusEffectsToApplyData: ProjectileStatusEffectData[] = []
  ) {
    this.scene = scene;
    this.direction = direction.normalize();
    this.owner = owner;
    this.isCriticalHit = isCrit;
    this.critDamageMultiplierPercent = critDamageMultPercent;
    this.statusEffectsToApply = statusEffectsToApplyData;
    this.isHealingOrb = owner === 'enemy_heal';

    this.baseDamage = inputDamageOrHealAmount; // This is healAmount if isHealingOrb
    if (this.isHealingOrb) {
      this.finalDamage = 0; // Healing orbs don't do damage
    } else if (this.isCriticalHit) {
      this.finalDamage = this.baseDamage * (this.critDamageMultiplierPercent / 100);
    } else {
      this.finalDamage = this.baseDamage;
    }

    if (owner === 'player') {
      this.speed = BASE_PROJECTILE_SPEED * speedMultiplierOrAbsoluteSpeed;
    } else { // 'enemy', 'converted_enemy', 'enemy_heal'
      this.speed = speedMultiplierOrAbsoluteSpeed;
    }

    let geometry: THREE.BufferGeometry;
    let effectiveScale = (owner === 'enemy' || owner === 'enemy_heal') ? projectileVisualScale * 0.75 : projectileVisualScale;

    if (owner === 'player') {
      geometry = new THREE.CylinderGeometry(0.1 * effectiveScale, 0.02 * effectiveScale, 0.5 * effectiveScale, 8);
      geometry.rotateZ(Math.PI / 2);
    } else if (this.isHealingOrb) {
      geometry = new THREE.SphereGeometry(0.12 * effectiveScale, 6, 6); // Slightly different geometry for healing orbs
    }
     else {
      geometry = new THREE.SphereGeometry(0.15 * effectiveScale, 8, 8);
    }

    const material = new THREE.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: (owner === 'player' || owner === 'enemy_heal') ? 1.2 : 0.8, // Healing orbs brighter
        transparent: this.isHealingOrb,
        opacity: this.isHealingOrb ? 0.8 : 1.0,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.copy(startPosition);
    this.mesh.position.z = 0;

    if (!(geometry instanceof THREE.SphereGeometry) && owner !== 'enemy_heal') { // Don't orient healing orbs for now
        const targetDirection = owner === 'player' ? new THREE.Vector3(1,0,0) : this.direction;
        this.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1,0,0), targetDirection);
    }
    scene.add(this.mesh);
  }

  public update(): void {
    this.mesh.position.addScaledVector(this.direction, this.speed);
  }

  public isOutOfBounds(worldLeft: number, worldRight: number, worldTop: number, worldBottom: number): boolean {
    const buffer = 2;
    return (
      this.mesh.position.x < worldLeft - buffer ||
      this.mesh.position.x > worldRight + buffer ||
      this.mesh.position.y < worldBottom - buffer ||
      this.mesh.position.y > worldTop + buffer
    );
  }

  public getBoundingBox(): THREE.Box3 {
    const box = new THREE.Box3();
    this.mesh.updateWorldMatrix(true, false);
    box.setFromObject(this.mesh, true);
    return box;
  }

  public dispose(): void {
    if (this.mesh.parent) {
        this.scene.remove(this.mesh);
    }
    this.mesh.geometry.dispose();
    if (this.mesh.material instanceof THREE.Material) {
        this.mesh.material.dispose();
    } else if (Array.isArray(this.mesh.material)) {
        this.mesh.material.forEach(material => material.dispose());
    }
  }
}
