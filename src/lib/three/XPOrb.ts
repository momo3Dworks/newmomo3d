
import * as THREE from 'three';

const HOMING_EFFECT_RADIUS_SQ = 2500; // Increased from 25 (sqrt(2500) = 50 unit radius)
const HOMING_FORCE_MULTIPLIER = 2.5;  // Increased from 0.25
const MAX_ORB_SPEED = 2.0; // Increased from 0.2

export default class XPOrb {
  public mesh: THREE.Mesh;
  private scene: THREE.Scene;
  private velocity: THREE.Vector3;
  public xpValue: number;
  private lifetime: number = 10; // seconds before despawning if not collected
  private age: number = 0;

  private static GEOMETRY: THREE.SphereGeometry | null = null;
  private static MATERIAL: THREE.MeshStandardMaterial | null = null;

  constructor(
    scene: THREE.Scene,
    startPosition: THREE.Vector3,
    initialVelocity: THREE.Vector3,
    xpValue: number,
    private playerPositionGetter: (() => THREE.Vector3) | null = null
  ) {
    this.scene = scene;
    this.velocity = initialVelocity.clone();
    this.xpValue = xpValue;

    if (!XPOrb.GEOMETRY) {
      XPOrb.GEOMETRY = new THREE.SphereGeometry(0.05, 8, 8); // Size reduced by 50%
    }
    if (!XPOrb.MATERIAL) {
      XPOrb.MATERIAL = new THREE.MeshStandardMaterial({
        color: 0x00BFFF, // Sky Blue / DeepSkyBlue
        emissive: 0x00BFFF, // Sky Blue / DeepSkyBlue
        emissiveIntensity: 2,
        roughness: 0.5,
        metalness: 0.1,
      });
    }

    this.mesh = new THREE.Mesh(XPOrb.GEOMETRY, XPOrb.MATERIAL);
    this.mesh.position.copy(startPosition);
    this.mesh.position.z = 0.1; // Slightly in front to avoid z-fighting with background/other elements
    this.scene.add(this.mesh);
  }

  public update(deltaTime: number): void {
    if (this.playerPositionGetter) {
      const playerPosition = this.playerPositionGetter();
      const directionToPlayer = playerPosition.clone().sub(this.mesh.position);
      const distanceToPlayerSq = directionToPlayer.lengthSq();

      // Only apply homing if within range and not too close (to prevent jitter)
      if (distanceToPlayerSq < HOMING_EFFECT_RADIUS_SQ && distanceToPlayerSq > 0.01) {
        const homingForce = directionToPlayer.normalize().multiplyScalar(HOMING_FORCE_MULTIPLIER);
        // Add the homing force to the current velocity
        // We scale by deltaTime here to make the force application consistent across frame rates
        this.velocity.addScaledVector(homingForce, deltaTime * 60); // Assuming 60 FPS for force scaling
      }
    }

    // Optional: Add slight damping to prevent infinite acceleration if homing force is constant
    // this.velocity.multiplyScalar(0.995);


    // Cap the orb's speed
    if (this.velocity.lengthSq() > MAX_ORB_SPEED * MAX_ORB_SPEED) {
      this.velocity.normalize().multiplyScalar(MAX_ORB_SPEED);
    }

    this.mesh.position.addScaledVector(this.velocity, deltaTime);
    this.age += deltaTime;
  }

  public isOutOfBounds(worldLeft: number, worldRight: number, worldTop: number, worldBottom: number): boolean {
    const buffer = 3; // Wider buffer for orbs as they might live longer
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
    // Geometry and Material are shared, so they are not disposed here.
    // If they were unique per instance, you would dispose them.
  }
}
