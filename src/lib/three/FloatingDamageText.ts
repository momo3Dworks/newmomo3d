
import * as THREE from 'three';

export default class FloatingDamageText {
  private scene: THREE.Scene;
  public sprite: THREE.Sprite;
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D | null;
  private texture: THREE.CanvasTexture;
  private material: THREE.SpriteMaterial;

  private lifetime: number = 1.0; // seconds
  private age: number = 0;
  private initialPosition: THREE.Vector3;
  private velocity: THREE.Vector3 = new THREE.Vector3(0, 0.5, 0); // Moves upwards
  private initialScale: number;

  constructor(
    scene: THREE.Scene,
    text: string,
    position: THREE.Vector3,
    colorHex: number,
    isCritical: boolean
  ) {
    this.scene = scene;
    this.initialPosition = position.clone();
    this.initialScale = isCritical ? 0.6 : 0.4; // Crits are larger

    this.canvas = document.createElement('canvas');
    this.context = this.canvas.getContext('2d');
    
    if (!this.context) {
        console.error("Failed to get 2D context for damage text");
        // Fallback to prevent crash, though text won't render
        this.texture = new THREE.CanvasTexture(this.canvas);
        this.material = new THREE.SpriteMaterial({ transparent: true, opacity: 0 });
        this.sprite = new THREE.Sprite(this.material);
        return;
    }

    const fontSize = isCritical ? 48 : 32;
    this.context.font = `bold ${fontSize}px Arial`;
    this.context.fillStyle = `#${colorHex.toString(16).padStart(6, '0')}`;
    
    const textMetrics = this.context.measureText(text);
    this.canvas.width = THREE.MathUtils.ceilPowerOfTwo(textMetrics.width + 10); // Add some padding
    this.canvas.height = THREE.MathUtils.ceilPowerOfTwo(fontSize + 10);

    // Re-apply font settings after canvas resize
    this.context.font = `bold ${fontSize}px Arial`;
    this.context.fillStyle = `#${colorHex.toString(16).padStart(6, '0')}`;
    this.context.textAlign = 'center';
    this.context.textBaseline = 'middle';
    this.context.fillText(text, this.canvas.width / 2, this.canvas.height / 2);

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.needsUpdate = true;

    this.material = new THREE.SpriteMaterial({
      map: this.texture,
      transparent: true,
      blending: THREE.AdditiveBlending, // Brighter look
      depthWrite: false,
    });

    this.sprite = new THREE.Sprite(this.material);
    this.sprite.scale.set(this.initialScale * (this.canvas.width / this.canvas.height), this.initialScale, 1);
    this.sprite.position.copy(this.initialPosition);
    this.sprite.position.z += 0.2; // Slightly in front of other elements

    this.scene.add(this.sprite);
  }

  update(deltaTime: number): void {
    if (!this.sprite) return;

    this.age += deltaTime;
    if (this.age > this.lifetime) {
      this.sprite.visible = false; // Mark for removal
      return;
    }

    // Movement
    this.sprite.position.addScaledVector(this.velocity, deltaTime);
    // Simplified "glitch": slight random horizontal jitter
    this.sprite.position.x += (Math.random() - 0.5) * 0.05;


    // Fade out
    const HIDE_START_PERCENT = 0.5; // Start fading at 50% of lifetime
    if (this.age / this.lifetime > HIDE_START_PERCENT) {
      this.material.opacity = 1.0 - (this.age / this.lifetime - HIDE_START_PERCENT) / (1 - HIDE_START_PERCENT);
    }
    
    // Optional: slight scale down
    // const scaleProgress = 1 - (this.age / this.lifetime);
    // this.sprite.scale.set(this.initialScale * scaleProgress * (this.canvas.width / this.canvas.height), this.initialScale * scaleProgress, 1);
  }

  isFinished(): boolean {
    return this.age > this.lifetime || !this.sprite?.visible;
  }

  dispose(): void {
    if (this.sprite) {
      if (this.sprite.parent) {
        this.scene.remove(this.sprite);
      }
      this.material.dispose();
      this.texture.dispose();
    }
    // @ts-ignore
    this.sprite = null;
    // @ts-ignore
    this.canvas = null;
    // @ts-ignore
    this.context = null;
  }
}
