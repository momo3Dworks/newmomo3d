
// This file is no longer used as Special Power-Up Orbs have been removed.
// The logic for acquiring special abilities is now handled by the skill point system.

/*
import * as THREE from 'three';
import type { SpecialAttackType } from '@/types';

const HOMING_EFFECT_RADIUS_SQ_SPECIAL = 3000; 
const HOMING_FORCE_MULTIPLIER_SPECIAL = 3.0;
const MAX_ORB_SPEED_SPECIAL = 2.5;

export default class SpecialPowerUpOrb {
  public mesh: THREE.Mesh;
  private scene: THREE.Scene;
  private velocity: THREE.Vector3;
  public specialType: SpecialAttackType;
  private lifetime: number = 12; 
  private age: number = 0;
  private playerPositionGetter: (() => THREE.Vector3) | null = null;

  private static GEOMETRY: THREE.IcosahedronGeometry | null = null;
  private material: THREE.MeshStandardMaterial; 

  private pulseTime: number = 0;
  private baseEmissiveIntensity: number = 2.5;


  constructor(
    scene: THREE.Scene,
    startPosition: THREE.Vector3,
    initialVelocity: THREE.Vector3,
    specialType: SpecialAttackType,
    playerPositionGetter: (() => THREE.Vector3) | null = null
  ) {
    this.scene = scene;
    this.velocity = initialVelocity.clone();
    this.specialType = specialType;
    this.playerPositionGetter = playerPositionGetter;

    if (!SpecialPowerUpOrb.GEOMETRY) {
      SpecialPowerUpOrb.GEOMETRY = new THREE.IcosahedronGeometry(0.12, 0); 
    }
    
    this.material = new THREE.MeshStandardMaterial({
        color: 0xffffff, 
        emissive: new THREE.Color(0xff00ff), 
        emissiveIntensity: this.baseEmissiveIntensity,
        roughness: 0.3,
        metalness: 0.2,
        transparent: true,
        opacity: 0.9,
    });
    this.setEmissiveColorByType();


    this.mesh = new THREE.Mesh(SpecialPowerUpOrb.GEOMETRY, this.material);
    this.mesh.position.copy(startPosition);
    this.mesh.position.z = 0.15; 
    this.scene.add(this.mesh);
  }

  private setEmissiveColorByType(): void {
    switch (this.specialType) {
        case 'SUPER_LASER':
            this.material.emissive.setHex(0xFFFF00); // Yellow
            break;
        case 'SPREAD_SHOTGUN':
            this.material.emissive.setHex(0x00FF00); // Green
            break;
        case 'I_AM_NUCLEAR':
            this.material.emissive.setHex(0xFF0000); // Red
            break;
        default:
            this.material.emissive.setHex(0xFF00FF); // Magenta fallback
    }
  }


  public update(deltaTime: number): void {
    this.pulseTime += deltaTime;
    this.material.emissiveIntensity = this.baseEmissiveIntensity + Math.sin(this.pulseTime * 5) * 1.0;
    this.mesh.rotation.y += deltaTime * 0.5;
    this.mesh.rotation.x += deltaTime * 0.3;


    if (this.playerPositionGetter) {
      const playerPosition = this.playerPositionGetter();
      const directionToPlayer = playerPosition.clone().sub(this.mesh.position);
      const distanceToPlayerSq = directionToPlayer.lengthSq();

      if (distanceToPlayerSq < HOMING_EFFECT_RADIUS_SQ_SPECIAL && distanceToPlayerSq > 0.01) {
        const homingForce = directionToPlayer.normalize().multiplyScalar(HOMING_FORCE_MULTIPLIER_SPECIAL);
        this.velocity.addScaledVector(homingForce, deltaTime * 60);
      }
    }

    if (this.velocity.lengthSq() > MAX_ORB_SPEED_SPECIAL * MAX_ORB_SPEED_SPECIAL) {
      this.velocity.normalize().multiplyScalar(MAX_ORB_SPEED_SPECIAL);
    }

    this.mesh.position.addScaledVector(this.velocity, deltaTime);
    this.age += deltaTime;
  }

  public isOutOfBounds(worldLeft: number, worldRight: number, worldTop: number, worldBottom: number): boolean {
    const buffer = 3;
    if (
      this.mesh.position.x < worldLeft - buffer ||
      this.mesh.position.x > worldRight + buffer ||
      this.mesh.position.y < worldBottom - buffer ||
      this.mesh.position.y > worldTop + buffer ||
      this.age > this.lifetime
    ) {
      return true;
    }
    return false;
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
    this.material.dispose();
  }
}
*/
// Ensure the file is not empty if it's still imported somewhere by mistake
export {};

    