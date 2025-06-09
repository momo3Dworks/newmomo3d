
import * as THREE from 'three';

export default class SpriteAnimation {
  public mesh: THREE.Mesh;
  private scene: THREE.Scene;
  private texture: THREE.Texture;
  private numCols: number;
  private numRows: number;
  private totalFrames: number;
  private frameDuration: number;
  private currentFrame: number = 0;
  private elapsedTime: number = 0;
  public isPlaying: boolean = false;
  private planeSize: number;
  private uvOffsetX: number;
  private uvOffsetY: number;
  private hasPlayedOnce: boolean = false;

  private static defaultExplosionTexture: THREE.Texture | null = null;

  public static setDefaultExplosionTexture(texture: THREE.Texture) {
    SpriteAnimation.defaultExplosionTexture = texture;
    SpriteAnimation.defaultExplosionTexture.colorSpace = THREE.SRGBColorSpace;
    SpriteAnimation.defaultExplosionTexture.magFilter = THREE.NearestFilter;
    SpriteAnimation.defaultExplosionTexture.minFilter = THREE.NearestFilter;
    SpriteAnimation.defaultExplosionTexture.needsUpdate = true;
  }

  constructor(
    scene: THREE.Scene,
    // spriteSheetUrl parameter removed, will use static texture
    numCols: number,
    numRows: number,
    totalFrames: number,
    animationDuration: number,
    planeSize: number = 1.0,
    uvOffsetX: number = 0,
    uvOffsetY: number = 0,
    tintColor: number | THREE.Color = 0xffffff,
    emissiveColor: number | THREE.Color = 0xffffff,
    emissiveIntensity: number = 1.0
  ) {
    this.scene = scene;
    this.numCols = numCols;
    this.numRows = numRows;
    this.totalFrames = totalFrames;
    this.frameDuration = animationDuration / totalFrames;
    this.planeSize = planeSize;
    this.uvOffsetX = uvOffsetX;
    this.uvOffsetY = uvOffsetY;

    if (!SpriteAnimation.defaultExplosionTexture) {
      console.error("SpriteAnimation: Default explosion texture not set!");
      // Create a placeholder to avoid crashing
      this.texture = new THREE.Texture(); // Empty texture
    } else {
      this.texture = SpriteAnimation.defaultExplosionTexture;
    }
    
    this.texture.repeat.set(1 / this.numCols, 1 / this.numRows);

    const geometry = new THREE.PlaneGeometry(this.planeSize, this.planeSize);
    const material = new THREE.MeshStandardMaterial({
      map: this.texture,
      color: new THREE.Color(tintColor),
      emissiveMap: this.texture,
      emissive: new THREE.Color(emissiveColor),
      emissiveIntensity: emissiveIntensity,
      transparent: true,
      alphaTest: 0.01,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending,
      roughness: 1.0,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.visible = false;
    this.updateTextureOffset();
  }

  private updateTextureOffset(): void {
    if (!this.texture) return;
    const col = this.currentFrame % this.numCols;
    const row = Math.floor(this.currentFrame / this.numCols);
    const frameWidthUV = 1 / this.numCols;
    const frameHeightUV = 1 / this.numRows;
    this.texture.offset.x = (col / this.numCols) + (this.uvOffsetX * frameWidthUV);
    this.texture.offset.y = (1 - (row + 1) / this.numRows) + (this.uvOffsetY * frameHeightUV);
  }

  public play(position: THREE.Vector3): void {
    this.mesh.position.copy(position);
    this.currentFrame = 0; this.elapsedTime = 0;
    this.isPlaying = true; this.hasPlayedOnce = true;
    this.mesh.visible = true; this.updateTextureOffset();
    if (!this.mesh.parent) this.scene.add(this.mesh);
  }

  public update(deltaTime: number): void {
    if (!this.isPlaying) return;
    this.elapsedTime += deltaTime;
    if (this.elapsedTime >= this.frameDuration) {
      this.elapsedTime -= this.frameDuration; 
      this.currentFrame++;
      if (this.currentFrame >= this.totalFrames) {
        this.isPlaying = false; this.mesh.visible = false;
        if (this.mesh.parent) this.scene.remove(this.mesh);
      } else {
        this.updateTextureOffset();
      }
    }
  }

  public isFinished(): boolean { return this.hasPlayedOnce && !this.isPlaying; }

  public dispose(): void {
    if (this.mesh.parent) this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    if (this.mesh.material instanceof THREE.Material) this.mesh.material.dispose();
    // Texture is static and managed by Game's LoadingManager, so not disposed here.
  }
}
