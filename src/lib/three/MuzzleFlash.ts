
import * as THREE from 'three';

export default class MuzzleFlash {
  public mesh: THREE.Mesh; 
  private scene: THREE.Scene; // Still needed if MuzzleFlash were to add itself to scene, but now parented
  private texture: THREE.Texture;
  private numCols: number;
  private numRows: number;
  private totalFrames: number;
  private frameDuration: number;
  private currentFrame: number = 0;
  private elapsedTime: number = 0;
  private isPlaying: boolean = false;
  private planeSize: number;
  private uvOffsetX: number;
  private uvOffsetY: number;

  constructor(
    scene: THREE.Scene, // Keep for context, though mesh is added by Player
    texture: THREE.Texture, // Accept pre-loaded texture
    numCols: number,
    numRows: number,
    totalFrames: number,
    animationDuration: number,
    planeSize: number = 1.0,
    uvOffsetX: number = 0,
    uvOffsetY: number = 0
  ) {
    this.scene = scene;
    this.numCols = numCols;
    this.numRows = numRows;
    this.totalFrames = totalFrames;
    this.frameDuration = animationDuration / totalFrames;
    this.planeSize = planeSize;
    this.uvOffsetX = uvOffsetX;
    this.uvOffsetY = uvOffsetY;

    this.texture = texture; // Use pre-loaded texture
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.needsUpdate = true; 
    this.texture.repeat.set(1 / this.numCols, 1 / this.numRows);

    const geometry = new THREE.PlaneGeometry(this.planeSize, this.planeSize);
    const material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      blending: THREE.AdditiveBlending, 
      depthWrite: false, 
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.visible = false; 
    
    this.updateTextureOffset(); 
  }

  private updateTextureOffset(): void {
    const col = this.currentFrame % this.numCols;
    const row = Math.floor(this.currentFrame / this.numCols);
    const frameWidthUV = 1 / this.numCols;
    const frameHeightUV = 1 / this.numRows;
    this.texture.offset.x = (col / this.numCols) + (this.uvOffsetX * frameWidthUV);
    this.texture.offset.y = (1 - (row + 1) / this.numRows) + (this.uvOffsetY * frameHeightUV);
  }

  public start(): void {
    this.currentFrame = 0;
    this.elapsedTime = 0;
    this.isPlaying = true;
    this.mesh.visible = true;
    this.updateTextureOffset();
  }

  public update(deltaTime: number): void {
    if (!this.isPlaying) return;
    this.elapsedTime += deltaTime;
    if (this.elapsedTime >= this.frameDuration) {
      this.elapsedTime -= this.frameDuration; 
      this.currentFrame++;
      if (this.currentFrame >= this.totalFrames) {
        this.isPlaying = false;
        this.mesh.visible = false;
        this.currentFrame = 0; 
      }
      this.updateTextureOffset();
    }
  }
  
  public dispose(): void {
    // Mesh is part of Player's group, Player handles its geometry/material disposal.
    // Texture is managed by Game's LoadingManager.
    // Only local state reset might be needed if reused, but typically new instances are created.
    this.isPlaying = false;
    if(this.mesh) this.mesh.visible = false;
  }
}
