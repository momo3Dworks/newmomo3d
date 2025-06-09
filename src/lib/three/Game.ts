
import * as THREE from 'three';
import Player from './Player';
import Enemy from './Enemy';
import Projectile from './Projectile';
import SpriteAnimation from './SpriteAnimation';
import XPOrb from './XPOrb';
import FloatingDamageText from './FloatingDamageText';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SSRPass } from 'three/examples/jsm/postprocessing/SSRPass.js';
import { VolumetricCloudShader } from './shaders/VolumetricCloudShader';
import { EnemyType, ENEMY_STATS, CardData, PlayerStatType, PYRAMID_PROJECTILE_DAMAGE, PLAYER_INITIAL_HEALTH, GameEvent, LIFE_STEAL_VALUE_PERCENT, MAX_TURRETS, DOT_COLORS, UnlockableAbilityType as UAType, ProjectileStatusEffectData, CardTier } from '@/types';
import { generateCardPool } from '@/lib/game-logic/cardGenerator';


export default class Game {
  public scene!: THREE.Scene;
  public camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  public player!: Player;
  public enemies: Enemy[] = [];
  public projectiles: Projectile[] = [];
  private xpOrbs: XPOrb[] = [];
  private activeExplosions: SpriteAnimation[] = [];
  public floatingDamageNumbers: FloatingDamageText[] = [];
  private activeSuperLaser: THREE.Mesh | null = null;
  private superLaserEndTime: number = 0;


  private backgroundClouds: THREE.Mesh[] = [];

  private score: number = 0;
  private gameOver: boolean = false;
  public isPaused: boolean = false;
  public isPausedForUpgrade: boolean = false; 
  private animationFrameId?: number;
  private timePausedAt: number = 0;

  public onGameEvent: (event: GameEvent) => void;
  private onGameOverCallback: (finalScore: number) => void;
  private onLoadingProgress: (progress: number) => void;
  private onLoadingComplete: () => void;

  private targetGameHeight: number = 6;
  private worldLeftEdge!: number;
  private worldRightEdge!: number;
  private worldTopEdge!: number;
  private worldBottomEdge!: number;

  private movement = { left: false, right: false, up: false, down: false, shoot: false };
  private lastEnemySpawnTime: number = 0;
  private enemySpawnInterval: number = 2000;
  private baseEnemySpawnInterval: number = 2000;
  private readonly MIN_ENEMY_SPAWN_INTERVAL: number = 300;

  private isBossActive: boolean = false;
  private bossPendingSpawn: boolean = false;
  private isInWorld2: boolean = false; 

  public generatedEnvMap: THREE.Texture | null = null;
  public clock: THREE.Clock;
  private composer!: EffectComposer;
  private bloomPass!: UnrealBloomPass;
  private ssrPass!: SSRPass;

  public originalCameraPosition: THREE.Vector3 = new THREE.Vector3();
  public cameraShakeActive: boolean = false;
  public cameraShakeDuration: number = 0;
  public cameraShakeIntensity: number = 0;
  public cameraShakeStartTime: number = 0;

  private cardPool: CardData[];
  public playerLevel: number = 0; 
  private cardsAppliedCount: number = 0;

  private readonly NUM_CLOUDS = 40;
  private readonly CLOUD_MIN_SPEED = 0.5;
  private readonly CLOUD_MAX_SPEED = 2.8;
  private readonly CLOUD_MIN_SIZE_Y = 2;
  private readonly CLOUD_MAX_SIZE_Y = 7;
  private readonly CLOUD_ASPECT_RATIO_X_FACTOR = 1.8;
  private readonly CLOUD_Z_POSITION = 3;
  private readonly CLOUD_Z_VARIATION = 10;

  private readonly CLOUD_PALETTE: THREE.Color[] = [
    new THREE.Color(0xffffff),   
    new THREE.Color(0xE6F2FF),   
    new THREE.Color(0xD0E0F0),   
    new THREE.Color(0xB0D8FF)    
  ];

  private loadingManager!: THREE.LoadingManager;
  private assets: {
    playerModel?: THREE.Group;
    turretModel?: THREE.Group;
    drone1Model?: THREE.Group;
    drone1Animations?: THREE.AnimationClip[];
    pyramidModel?: THREE.Group;
    pyramidAnimations?: THREE.AnimationClip[];
    muzzleFlashTexture?: THREE.Texture;
    explosionTexture?: THREE.Texture;
    hdriTexture?: THREE.Texture;
  } = {};


  constructor(
    private canvas: HTMLCanvasElement,
    onGameEvent: (event: GameEvent) => void,
    onGameOverCallback: (finalScore: number) => void,
    onLoadingProgress: (progress: number) => void,
    onLoadingComplete: () => void
  ) {
    this.onGameEvent = onGameEvent;
    this.onGameOverCallback = onGameOverCallback;
    this.onLoadingProgress = onLoadingProgress;
    this.onLoadingComplete = onLoadingComplete;

    this.clock = new THREE.Clock();
    this.cardPool = generateCardPool();

    this.initEssentialThreeSetup();
    this.initLoadingManagerAndLoadAssets();
  }

  private initEssentialThreeSetup(): void {
    this.scene = new THREE.Scene();
    this.scene.userData.FloatingDamageText = FloatingDamageText;
    (this.scene.userData as any).clock = this.clock;

    const initialFallbackBackgroundColor = new THREE.Color(0x1A1A2A);
    this.scene.background = initialFallbackBackgroundColor;

    const fov = 75;
    const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
    const near = 0.1;
    const far = 20000;
    this.camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    (this.scene as any).camera = this.camera;

    const fovInRadians = fov * (Math.PI / 180);
    this.camera.position.z = 1.6 * (this.targetGameHeight / 2) / Math.tan(fovInRadians / 2);
    this.camera.position.x = 0;
    this.camera.position.y = 0;
    this.originalCameraPosition.copy(this.camera.position);

    this.calculateWorldBoundaries();

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.initBackgroundClouds();

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.15);
    this.scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.25);
    directionalLight.position.set(5, 10, 7.5);
    this.scene.add(directionalLight);

    this.composer = new EffectComposer(this.renderer);
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    this.ssrPass = new SSRPass({
      renderer: this.renderer, scene: this.scene, camera: this.camera,
      width: this.canvas.clientWidth, height: this.canvas.clientHeight,
      groundReflector: null, selects: null,
    });
    this.ssrPass.thickness = 0.018; this.ssrPass.infiniteThick = false; this.ssrPass.opacity = 0.7;
    this.composer.addPass(this.ssrPass);

    this.bloomPass = new UnrealBloomPass( new THREE.Vector2(this.canvas.clientWidth, this.canvas.clientHeight), 0.2, 0.1, 0.9); 
    this.composer.addPass(this.bloomPass);

    this.setupEventListeners();
    this.setPlayerLevel(0); 
    this.updateCardSpawnModifier(0);
    this.handleResize();
  }

  private initLoadingManagerAndLoadAssets(): void {
    this.loadingManager = new THREE.LoadingManager();
    const gltfLoader = new GLTFLoader(this.loadingManager);
    const textureLoader = new THREE.TextureLoader(this.loadingManager);
    const rgbeLoader = new RGBELoader(this.loadingManager);

    this.loadingManager.onStart = (url, itemsLoaded, itemsTotal) => {
      this.onLoadingProgress(0);
    };

    this.loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
      const progress = (itemsLoaded / itemsTotal) * 100;
      this.onLoadingProgress(progress);
    };

    this.loadingManager.onLoad = () => {
      this.finalizeGameSetupAfterLoad();
      this.onLoadingComplete();
    };

    this.loadingManager.onError = (url) => {
      console.error(`Error loading asset: ${url}`);
    };

    gltfLoader.load('/models/MOMOSHIP.glb', (gltf) => { this.assets.playerModel = gltf.scene; });
    gltfLoader.load('/models/TORRETS.glb', (gltf) => { this.assets.turretModel = gltf.scene; });
    gltfLoader.load('/models/DRONE1.glb', (gltf) => {
      this.assets.drone1Model = gltf.scene;
      this.assets.drone1Animations = gltf.animations;
    });
    gltfLoader.load('/models/PYRAMID.glb', (gltf) => {
      this.assets.pyramidModel = gltf.scene;
      this.assets.pyramidAnimations = gltf.animations;
    });
    textureLoader.load('/textures/muzzle_flash_spritesheet2.png', (texture) => { this.assets.muzzleFlashTexture = texture; });
    textureLoader.load('/textures/Enemy_Death2.png', (texture) => { this.assets.explosionTexture = texture; });
    rgbeLoader.load('/sky_3.hdr', (texture) => { this.assets.hdriTexture = texture; });
  }

  private finalizeGameSetupAfterLoad(): void {
    if (!this.renderer || !this.scene || !this.assets.hdriTexture ||
        !this.assets.playerModel || !this.assets.muzzleFlashTexture ||
        !this.assets.explosionTexture || !this.assets.turretModel ||
        !this.assets.drone1Model || !this.assets.pyramidModel
    ) {
      console.warn("Some assets may not be fully loaded, game setup continuing with available assets.");
    }

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    pmremGenerator.compileEquirectangularShader();
    if(this.assets.hdriTexture) {
        this.assets.hdriTexture.mapping = THREE.EquirectangularReflectionMapping;
        this.generatedEnvMap = pmremGenerator.fromEquirectangular(this.assets.hdriTexture).texture;
        this.scene.background = this.generatedEnvMap;
        this.scene.environment = this.generatedEnvMap;
    }
    pmremGenerator.dispose();

    const playerX = this.worldLeftEdge + (this.worldRightEdge - this.worldLeftEdge) / 4;
    this.player = new Player(
        this.scene,
        playerX,
        this.worldTopEdge, this.worldBottomEdge, this.worldLeftEdge, this.worldRightEdge,
        this,
        this.assets.playerModel!.clone(),
        this.assets.muzzleFlashTexture!,
        this.assets.turretModel!.clone()
    );

    SpriteAnimation.setDefaultExplosionTexture(this.assets.explosionTexture!);
    this.composer.render();
  }


  public setPlayerLevel(level: number): void {
    const oldLevel = this.playerLevel;
    this.playerLevel = level;

    const levelSpawnModifier = 1 + (this.playerLevel * 0.24);
    this.enemySpawnInterval = Math.max(this.MIN_ENEMY_SPAWN_INTERVAL, this.baseEnemySpawnInterval / Math.max(1, levelSpawnModifier));

    if (this.player && this.playerLevel > oldLevel && this.playerLevel % 10 === 0 && this.playerLevel > 0) {
      this.player.stats.availableSkillPoints += 3;
      this.onGameEvent({ type: 'skillPointsUpdated', availableSkillPoints: this.player.stats.availableSkillPoints });
      this.triggerLevelUpUpgradeSelection(true); 
    } else if (this.playerLevel > oldLevel && this.playerLevel > 0 && this.playerLevel % 10 !== 0) {
      this.triggerLevelUpUpgradeSelection(false); 
    }


    
    if (this.playerLevel > oldLevel && this.playerLevel === 10 && !this.isInWorld2) {
      this.bossPendingSpawn = true;
    }
    
  }

  public updateCardSpawnModifier(cardsApplied: number): void {
    this.cardsAppliedCount = cardsApplied;
  }

  private calculateWorldBoundaries(): void {
    const aspect = this.camera.aspect;
    if (isNaN(aspect) || !isFinite(aspect) || aspect <= 0) {
        console.error("Game.calculateWorldBoundaries: Invalid camera aspect ratio:", aspect, ". Using fallback or last valid values if possible.");
        if (this.worldTopEdge === undefined) { 
            this.worldTopEdge = this.targetGameHeight / 2;
            this.worldBottomEdge = -this.targetGameHeight / 2;
            const fallbackAspect = 16/9; 
            this.worldRightEdge = (this.targetGameHeight * fallbackAspect) / 2;
            this.worldLeftEdge = -(this.targetGameHeight * fallbackAspect) / 2;
        }
        return;
    }
    const visibleGameHeightAtZ0 = this.targetGameHeight;
    const visibleGameWidthAtZ0 = visibleGameHeightAtZ0 * aspect;

    this.worldTopEdge = visibleGameHeightAtZ0 / 2;
    this.worldBottomEdge = -visibleGameHeightAtZ0 / 2;
    this.worldRightEdge = visibleGameWidthAtZ0 / 1.4;
    this.worldLeftEdge = -visibleGameWidthAtZ0 / 1.55;
  }

  private initBackgroundClouds(): void {
    const cloudGeometry = new THREE.PlaneGeometry(1, 1);
    const screenResolution = new THREE.Vector2();
    this.renderer.getSize(screenResolution);

    for (let i = 0; i < this.NUM_CLOUDS; i++) {
      const cloudMaterial = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.clone(VolumetricCloudShader.uniforms),
        vertexShader: VolumetricCloudShader.vertexShader,
        fragmentShader: VolumetricCloudShader.fragmentShader,
        transparent: true, depthWrite: false, blending: THREE.NormalBlending,
      });
      cloudMaterial.uniforms.uResolution.value.copy(screenResolution);
      cloudMaterial.uniforms.uSeed.value = Math.random() * 200.0;
      const randomCloudColor = this.CLOUD_PALETTE[Math.floor(Math.random() * this.CLOUD_PALETTE.length)];
      cloudMaterial.uniforms.uCloudColor.value.copy(randomCloudColor);

      const cloudMesh = new THREE.Mesh(cloudGeometry, cloudMaterial);
      const sizeY = THREE.MathUtils.randFloat(this.CLOUD_MIN_SIZE_Y, this.CLOUD_MAX_SIZE_Y);
      const sizeX = sizeY * this.CLOUD_ASPECT_RATIO_X_FACTOR * (Math.random() * 0.4 + 0.8);
      cloudMesh.scale.set(sizeX, sizeY, 1);

      if (i < this.NUM_CLOUDS / 2) {
        cloudMesh.position.y = THREE.MathUtils.randFloat(this.worldBottomEdge - sizeY * 0.1, (this.worldBottomEdge + this.worldTopEdge) / 2 - sizeY * 0.1);
      } else {
        cloudMesh.position.y = THREE.MathUtils.randFloat((this.worldBottomEdge + this.worldTopEdge) / 2 + sizeY * 0.1, this.worldTopEdge + sizeY * 0.1);
      }
      cloudMesh.position.x = this.worldRightEdge + sizeX / 2 + THREE.MathUtils.randFloat(sizeX * 0.1, sizeX * 0.5);
      cloudMesh.position.z = this.CLOUD_Z_POSITION - Math.random() * this.CLOUD_Z_VARIATION;

      cloudMesh.userData.speed = THREE.MathUtils.randFloat(this.CLOUD_MIN_SPEED, this.CLOUD_MAX_SPEED);
      cloudMesh.userData.glowPhaseOffset = Math.random() * Math.PI * 2;
      cloudMesh.userData.glowFrequency = THREE.MathUtils.randFloat(0.2, 0.6);
      cloudMesh.renderOrder = -1;

      this.scene.add(cloudMesh);
      this.backgroundClouds.push(cloudMesh);
    }
  }

  private updateBackgroundClouds(deltaTime: number): void {
    const screenResolution = new THREE.Vector2();
    this.renderer.getSize(screenResolution);
    (this.scene.userData as any).deltaTime = deltaTime;

    for (const cloud of this.backgroundClouds) {
      cloud.position.x -= cloud.userData.speed * deltaTime;
      const material = cloud.material as THREE.ShaderMaterial;
      material.uniforms.uTime.value += deltaTime;
      material.uniforms.uResolution.value.copy(screenResolution);
      const baseGlow = 0.2; const maxGlow = 2.6; 
      const glowAmplitude = (maxGlow - baseGlow) / 2; const glowMidpoint = baseGlow + glowAmplitude;
      const sinValue = Math.sin(material.uniforms.uTime.value * cloud.userData.glowFrequency + cloud.userData.glowPhaseOffset);
      material.uniforms.uGlowFactor.value = glowMidpoint + sinValue * glowAmplitude;
      const cloudScaledWidth = cloud.scale.x;
      if (cloud.position.x + cloudScaledWidth / 2 < this.worldLeftEdge - cloudScaledWidth * 0.1) {
        this.resetCloud(cloud);
      }
    }
  }

  private resetCloud(cloud: THREE.Mesh): void {
    const screenResolution = new THREE.Vector2();
    this.renderer.getSize(screenResolution);
    const material = cloud.material as THREE.ShaderMaterial;
    const sizeY = THREE.MathUtils.randFloat(this.CLOUD_MIN_SIZE_Y, this.CLOUD_MAX_SIZE_Y);
    const sizeX = sizeY * this.CLOUD_ASPECT_RATIO_X_FACTOR * (Math.random() * 0.4 + 0.8);
    cloud.scale.set(sizeX, sizeY, 1);
    const cloudScaledWidth = cloud.scale.x;
    cloud.position.x = this.worldRightEdge + cloudScaledWidth / 2 + THREE.MathUtils.randFloat(cloudScaledWidth * 0.1, cloudScaledWidth * 0.5);
    const cloudIndex = this.backgroundClouds.indexOf(cloud);
    if (cloudIndex < this.NUM_CLOUDS / 2 && cloudIndex !== -1) {
        cloud.position.y = THREE.MathUtils.randFloat(this.worldBottomEdge - sizeY * 0.1, (this.worldBottomEdge + this.worldTopEdge) / 2 - sizeY * 0.1);
    } else {
        cloud.position.y = THREE.MathUtils.randFloat((this.worldBottomEdge + this.worldTopEdge) / 2 + sizeY * 0.1, this.worldTopEdge + sizeY * 0.1);
    }
    cloud.position.z = this.CLOUD_Z_POSITION - Math.random() * this.CLOUD_Z_VARIATION;
    cloud.userData.speed = THREE.MathUtils.randFloat(this.CLOUD_MIN_SPEED, this.CLOUD_MAX_SPEED);
    cloud.userData.glowPhaseOffset = Math.random() * Math.PI * 2;
    cloud.userData.glowFrequency = THREE.MathUtils.randFloat(0.2, 0.6);
    material.uniforms.uSeed.value = Math.random() * 200.0;
    const randomCloudColor = this.CLOUD_PALETTE[Math.floor(Math.random() * this.CLOUD_PALETTE.length)];
    material.uniforms.uCloudColor.value.copy(randomCloudColor);
  }


  private setupEventListeners(): void {
    window.addEventListener('keydown', this.handleKeyDown.bind(this));
    window.addEventListener('keyup', this.handleKeyUp.bind(this));
    window.addEventListener('resize', this.handleResize.bind(this));
  }

  private removeEventListeners(): void {
    window.removeEventListener('keydown', this.handleKeyDown.bind(this));
    window.removeEventListener('keyup', this.handleKeyUp.bind(this));
    window.removeEventListener('resize', this.handleResize.bind(this));
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (this.gameOver || this.isPaused || this.isPausedForUpgrade || !this.player) return;
    const key = event.key.toLowerCase();
    switch (key) {
      case 'a': this.movement.left = true; break;
      case 'd': this.movement.right = true; break;
      case 'w': this.movement.up = true; break;
      case 's': this.movement.down = true; break;
      case ' ': this.movement.shoot = true; event.preventDefault(); break;
      case 'shift':
        if (this.player) this.player.startDash();
        event.preventDefault();
        break;
      case '1': this.player.activateSpecial(0); break; 
      case '2': this.player.activateSpecial(1); break; 
      case '3': this.player.activateSpecial(2); break; 
    }
  }

  private handleKeyUp(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();
    switch (key) {
      case 'a': this.movement.left = false; break;
      case 'd': this.movement.right = false; break;
      case 'w': this.movement.up = false; break;
      case 's': this.movement.down = false; break;
      case ' ': this.movement.shoot = false; break;
    }
  }

  public handleResize(): void {
    const parentElement = this.canvas.parentElement;
    if (!parentElement) return;
    const width = parentElement.clientWidth;
    const height = parentElement.clientHeight;

    if (width === 0 || height === 0) {
        console.warn("Game.handleResize: Canvas dimensions are zero. Skipping resize operations.");
        return;
    }

    this.canvas.width = width; this.canvas.height = height;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.calculateWorldBoundaries();
    this.originalCameraPosition.copy(this.camera.position);
    this.renderer.setSize(width, height);
    if (this.composer) this.composer.setSize(width, height);
    if (this.bloomPass) this.bloomPass.resolution.set(width, height);
    if (this.ssrPass) this.ssrPass.setSize(width, height);
    
    const screenResolution = new THREE.Vector2(width, height);
    for (const cloud of this.backgroundClouds) {
        if (cloud.material instanceof THREE.ShaderMaterial) {
            cloud.material.uniforms.uResolution.value.copy(screenResolution);
        }
        const sizeY = cloud.scale.y; const sizeX = sizeY * this.CLOUD_ASPECT_RATIO_X_FACTOR;
        cloud.scale.x = sizeX;
    }
    if (!this.player && this.composer) {
      this.composer.render();
    } else if (this.player && !this.animationFrameId && !this.gameOver && !this.isPaused) {
      const playerX = this.worldLeftEdge + (this.worldRightEdge - this.worldLeftEdge) / 4;
      this.player.mesh.position.x = playerX;
      this.player.mesh.position.y = Math.max(this.worldBottomEdge + (Player.PLAYER_HEIGHT / 4), Math.min(this.worldTopEdge - (Player.PLAYER_HEIGHT / 4), this.player.mesh.position.y));
      this.player.updateBoundary(this.worldTopEdge, this.worldBottomEdge, this.worldLeftEdge, this.worldRightEdge);
      if (this.composer) this.composer.render();
    }
  }

  public startGame(): void {
    if (!this.player) {
      console.warn("Player not initialized, cannot start game.");
      return;
    }
    this.score = 0;
    this.playerLevel = 0; 
    this.gameOver = false;
    this.isPaused = false;
    this.isPausedForUpgrade = false;
    this.isBossActive = false;
    this.bossPendingSpawn = false;
    this.isInWorld2 = false; 
    (this.scene.userData as any).clock = this.clock;
    (this.scene.userData as any).FloatingDamageText = FloatingDamageText;

    this.player.resetForNewGame();
    this.onGameEvent({ type: 'playerHealthUpdate', health: this.player.health, maxHealth: this.player.maxHealth, previousHealth: this.player.maxHealth });
    this.onGameEvent({ type: 'scoreUpdate', score: this.score, xpGained: 0 });
    this.onGameEvent({ type: 'bossHealthUpdate', bossId: undefined, currentHealth: 0, maxHealth: 0 }); 
    this.onGameEvent({ type: 'specialAttackUpdate', unlockedAbilities: this.player.stats.getUnlockedAbilitiesStatus() }); 
    this.onGameEvent({ type: 'spreadShotgunTimerUpdate', spreadShotgunRemainingSeconds: 0 });
    this.onGameEvent({ type: 'skillPointsUpdated', availableSkillPoints: this.player.stats.availableSkillPoints });


    this.clock.start();
    if((this.scene.userData as any).clock !== this.clock) (this.scene.userData as any).clock = this.clock;

    this.cameraShakeActive = false; this.cameraShakeDuration = 0;
    this.cameraShakeIntensity = 0; this.cameraShakeStartTime = 0;
    if (this.camera && this.originalCameraPosition) { this.camera.position.copy(this.originalCameraPosition); }

    this.enemies.forEach(enemy => enemy?.dispose()); this.enemies = [];
    this.projectiles.forEach(projectile => projectile?.dispose()); this.projectiles = [];
    this.activeExplosions.forEach(explosion => explosion?.dispose()); this.activeExplosions = [];
    this.xpOrbs.forEach(orb => orb?.dispose()); this.xpOrbs = [];
    this.floatingDamageNumbers.forEach(text => text?.dispose()); this.floatingDamageNumbers = [];
    this.backgroundClouds.forEach(cloud => this.resetCloud(cloud));
    this.lastEnemySpawnTime = performance.now();
    if(this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = undefined;
    this.setPlayerLevel(0); 
    this.updateCardSpawnModifier(0);

    if (!this.animationFrameId) this.animate();
  }

  public pauseGame(forUpgrade: boolean = false): void {
    if (this.gameOver || (this.isPaused && !forUpgrade && !this.isPausedForUpgrade) || !this.animationFrameId) return;
    if (forUpgrade) this.isPausedForUpgrade = true;
    else this.isPaused = true;
    if (this.animationFrameId) { cancelAnimationFrame(this.animationFrameId); this.animationFrameId = undefined; }
    this.timePausedAt = performance.now();
  }

  public resumeGame(): void {
    if ((!this.isPaused && !this.isPausedForUpgrade) || this.gameOver) return;
    const wasPausedForUpgrade = this.isPausedForUpgrade;
    this.isPaused = false; this.isPausedForUpgrade = false;
    
    if (this.bossPendingSpawn && wasPausedForUpgrade) { this.spawnBoss(); this.bossPendingSpawn = false; }
    if (!this.animationFrameId) this.animate();
  }

  public quitGame(): void {
    this.gameOver = true;
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = undefined;
    this.isPaused = false; this.isPausedForUpgrade = false;
    this.isBossActive = false; this.bossPendingSpawn = false;
    this.isInWorld2 = false;
    this.onGameEvent({ type: 'bossHealthUpdate', bossId: undefined, currentHealth: 0, maxHealth: 0 }); 


    this.enemies.forEach(enemy => enemy?.dispose()); this.enemies = [];
    this.projectiles.forEach(projectile => projectile?.dispose()); this.projectiles = [];
    this.activeExplosions.forEach(explosion => explosion?.dispose()); this.activeExplosions = [];
    this.xpOrbs.forEach(orb => orb?.dispose()); this.xpOrbs = [];
    this.floatingDamageNumbers.forEach(text => text?.dispose()); this.floatingDamageNumbers = [];
    const playerX = this.worldLeftEdge + (this.worldRightEdge - this.worldLeftEdge) / 4;
    const playerY = (this.worldTopEdge + this.worldBottomEdge) / 2;
    if(this.player && this.player.mesh) this.player.mesh.position.set(playerX, playerY, 0);
    this.movement = { left: false, right: false, up: false, down: false, shoot: false };
    if (this.composer) this.composer.render();
  }


  private spawnEnemy(): void {
    if (this.isBossActive || this.bossPendingSpawn || !this.player) return;
    const currentTime = performance.now();
    if (currentTime - this.lastEnemySpawnTime > this.enemySpawnInterval) {
      const spawnX = this.worldRightEdge + 1; const despawnX = this.worldLeftEdge -1;

      let enemyTypeWeights = [
        { type: EnemyType.SPHERE, weight: 1.2 },
        { type: EnemyType.CUBE, weight: 0.8 },
        { type: EnemyType.PYRAMID, weight: 1.0 }
      ];

      if (this.isInWorld2) {
        enemyTypeWeights = [
          { type: EnemyType.SPHERE, weight: 0.7 },
          { type: EnemyType.CUBE, weight: 0.5 },
          { type: EnemyType.PYRAMID, weight: 0.4 }, 
          { type: EnemyType.RHOMBUS, weight: 1.0 },
          { type: EnemyType.DOUBLE_SPHERE, weight: 0.8 },
          { type: EnemyType.HEXAGON, weight: 0.6 },
        ];
      }

      const availableEnemyTypesWeighted = enemyTypeWeights.filter(ew => {
        if (ew.type === EnemyType.SPHERE && (!this.assets.drone1Model || !this.assets.drone1Animations)) return false;
        if (ew.type === EnemyType.PYRAMID && (!this.assets.pyramidModel || !this.assets.pyramidAnimations)) return false;
        
        return true;
      });

      if (availableEnemyTypesWeighted.length === 0) {
        this.lastEnemySpawnTime = currentTime;
        return;
      }

      const totalWeight = availableEnemyTypesWeighted.reduce((sum, ew) => sum + ew.weight, 0);
      let randomPick = Math.random() * totalWeight;
      let chosenType: EnemyType = availableEnemyTypesWeighted[0].type; 

      for (const ew of availableEnemyTypesWeighted) {
        if (randomPick < ew.weight) {
          chosenType = ew.type;
          break;
        }
        randomPick -= ew.weight;
      }
      
      let playerPositionGetter: (() => THREE.Vector3) | undefined =
          ((chosenType === EnemyType.PYRAMID || chosenType === EnemyType.BOSS_PYRAMID_MK1 || chosenType === EnemyType.DOUBLE_SPHERE || chosenType === EnemyType.HEXAGON) && this.player && this.player.mesh)
          ? () => this.player.mesh.position.clone()
          : undefined;

      let modelInstanceForEnemy: THREE.Group | undefined = undefined;
      let animationsForEnemy: THREE.AnimationClip[] | undefined = undefined;

      if (chosenType === EnemyType.SPHERE && this.assets.drone1Model && this.assets.drone1Animations) {
          modelInstanceForEnemy = this.assets.drone1Model.clone();
          animationsForEnemy = this.assets.drone1Animations;
      } else if (chosenType === EnemyType.PYRAMID && this.assets.pyramidModel && this.assets.pyramidAnimations) {
          modelInstanceForEnemy = this.assets.pyramidModel.clone();
          animationsForEnemy = this.assets.pyramidAnimations;
      }


      if (chosenType === EnemyType.CUBE || chosenType === EnemyType.RHOMBUS) {
        const snakeLength = 3; 
        const enemyGeoData = chosenType === EnemyType.CUBE ? {width: 0.6, height: 0.6} : {width: 0.5, height: 0.5}; 
        const xOffsetBetweenEnemies = enemyGeoData.width * 0.7; const effectiveEnemyHeight = enemyGeoData.height * 0.7;
        const totalSnakeHeight = (snakeLength -1) * effectiveEnemyHeight;
        const minYForBase = this.worldBottomEdge + effectiveEnemyHeight / 2; const maxYForBase = this.worldTopEdge - totalSnakeHeight - effectiveEnemyHeight / 2;
        if (maxYForBase < minYForBase) { this.lastEnemySpawnTime = currentTime; return; }
        const baseRandomY = Math.random() * (maxYForBase - minYForBase) + minYForBase;
        for (let i = 0; i < snakeLength; i++) {
            const currentSpawnX = spawnX + i * xOffsetBetweenEnemies; const currentSpawnY = baseRandomY + (i * effectiveEnemyHeight);
            this.enemies.push(new Enemy(this.scene, new THREE.Vector3(currentSpawnX, currentSpawnY, 0), despawnX, this.worldRightEdge, chosenType, this.worldTopEdge, this.worldBottomEdge, undefined, undefined, undefined, this, this.isInWorld2));
        }
      } else {
        const enemyY = Math.random() * (this.worldTopEdge - 0.5 - (this.worldBottomEdge + 0.5)) + (this.worldBottomEdge + 0.5);
        this.enemies.push(new Enemy(this.scene, new THREE.Vector3(spawnX, enemyY, 0), despawnX, this.worldRightEdge, chosenType, this.worldTopEdge, this.worldBottomEdge, playerPositionGetter, modelInstanceForEnemy, animationsForEnemy, this, this.isInWorld2));
      }
      this.lastEnemySpawnTime = currentTime;
    }
  }

  private spawnBoss(): void {
    if (this.isBossActive || !this.player) return;

    try {
        this.isBossActive = true;
        this.bossPendingSpawn = false;

        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemyToClear = this.enemies[i];
            if (!enemyToClear) { this.enemies.splice(i, 1); continue; }

            const stats = ENEMY_STATS[enemyToClear.type];
            if (stats && !stats.isBoss) {
                enemyToClear.dispose(); this.enemies.splice(i, 1);
            } else if (!stats) {
                console.warn(`Game.spawnBoss: Enemy type ${enemyToClear.type} not found in ENEMY_STATS during clear. Disposing and removing.`);
                enemyToClear.dispose(); this.enemies.splice(i, 1);
            }
        }

        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const projectileToClear = this.projectiles[i];
             if (!projectileToClear) { this.projectiles.splice(i, 1); continue; }
            if (projectileToClear.owner === 'enemy') {
                projectileToClear.dispose(); this.projectiles.splice(i, 1);
            }
        }

        const spawnX = this.worldRightEdge + 2;
        const spawnY = (this.worldTopEdge + this.worldBottomEdge) / 2;
        const despawnX = this.worldLeftEdge - 5;
        const playerPositionGetter = (this.player && this.player.mesh) ? () => this.player.mesh.position.clone() : undefined;

        
        const bossTypeToSpawn = EnemyType.BOSS_PYRAMID_MK1; 
        
        const boss = new Enemy(this.scene, new THREE.Vector3(spawnX, spawnY, 0), despawnX, this.worldRightEdge, bossTypeToSpawn, this.worldTopEdge, this.worldBottomEdge, playerPositionGetter, undefined, undefined, this, false); // Boss not affected by isInWorld2 health double
        this.enemies.push(boss);

        this.onGameEvent({
            type: 'bossSpawned',
            bossType: bossTypeToSpawn,
            bossId: boss.mesh ? boss.mesh.uuid : undefined,
            health: boss.health,
            maxHealth: boss.maxHealth
        });


        const levelSpawnModifier = 1 + (this.playerLevel * 0.24);
        this.enemySpawnInterval = Math.max(this.MIN_ENEMY_SPAWN_INTERVAL * 3, (this.baseEnemySpawnInterval / Math.max(1, levelSpawnModifier)) * 3);
        this.lastEnemySpawnTime = performance.now();
    } catch (e: any) {
        console.error("CRITICAL ERROR during Game.spawnBoss():", e.message, e.stack);
        this.setGameOver();
    }
  }

  public handleEnemyDeath(enemy: Enemy, position: THREE.Vector3): void {
    if (!this.player || !enemy.mesh ) return;
    
    let totalXpForThisKill: number;
    if (enemy.type === EnemyType.BOSS_PYRAMID_MK1) {
        totalXpForThisKill = 1000; // Fixed XP for the first boss
    } else {
        const baseXP = enemy.getBaseXP();
        totalXpForThisKill = baseXP * Math.pow(1.5, this.playerLevel);
    }

    const numberOfOrbsToSpawn = 1;
    const xpValuePerOrb = totalXpForThisKill / numberOfOrbsToSpawn; 

    for (let i = 0; i < numberOfOrbsToSpawn; i++) {
        let orbVelocityBase = new THREE.Vector3(-enemy.speed, 0, 0);
        if (enemy.type === EnemyType.CUBE || enemy.type === EnemyType.RHOMBUS) orbVelocityBase.y = enemy.zigzagDirection * enemy.zigzagSpeed;

        const orbVelocity = orbVelocityBase.clone();
        orbVelocity.x -= 0.025;
        orbVelocity.x *= (1 + (Math.random() - 0.5) * 0.4);
        orbVelocity.y *= (1 + (Math.random() - 0.5) * 1.0);
        if (orbVelocity.lengthSq() === 0) orbVelocity.x = -0.01;

        const orbPosition = position.clone();
        orbPosition.x += (Math.random() - 0.5) * 0.3;
        orbPosition.y += (Math.random() - 0.5) * 0.3;

        const playerPosGetter = () => this.player.mesh.position;
        this.xpOrbs.push(new XPOrb(this.scene, orbPosition, orbVelocity, xpValuePerOrb, playerPosGetter));
    }

    const scoreGained = ENEMY_STATS[enemy.type].isBoss ? 250 : 10;
    this.score += scoreGained;
    this.onGameEvent({ type: 'scoreUpdate', score: this.score, xpGained: totalXpForThisKill });

    const explosion = new SpriteAnimation(this.scene, 4, 2, 8, 0.6, ENEMY_STATS[enemy.type].isBoss ? 3.0 : 1.2, 0,0,0xffffff,0xffffff,1.5);
    explosion.play(position); this.activeExplosions.push(explosion);

    const enemyIndex = this.enemies.indexOf(enemy);
    if (enemyIndex > -1) {
      if (this.enemies[enemyIndex] && this.enemies[enemyIndex].mesh) this.enemies[enemyIndex].dispose();
      this.enemies.splice(enemyIndex, 1);
    } else {
        if (enemy.mesh) enemy.dispose();
    }

    if (ENEMY_STATS[enemy.type].isBoss && enemy.mesh) {
        this.isBossActive = false;
        this.onGameEvent({type: 'bossDefeated', bossType: enemy.type, bossId: enemy.mesh ? enemy.mesh.uuid : undefined });
        
        
        if (!this.isInWorld2 && enemy.type === EnemyType.BOSS_PYRAMID_MK1) {
            this.isInWorld2 = true;
            
            
        }

        const levelSpawnModifier = 1 + (this.playerLevel * 0.24);
        this.enemySpawnInterval = Math.max(this.MIN_ENEMY_SPAWN_INTERVAL, this.baseEnemySpawnInterval / Math.max(1, levelSpawnModifier));
        this.lastEnemySpawnTime = performance.now();
        
        if (this.playerLevel % 10 === 0) {
            this.player.stats.availableSkillPoints +=3;
            this.onGameEvent({ type: 'skillPointsUpdated', availableSkillPoints: this.player.stats.availableSkillPoints });
            this.triggerLevelUpUpgradeSelection(true);
        } else {
            this.triggerLevelUpUpgradeSelection(false); 
        }
    }
  }

  private handleCollisions(): void {
    if (!this.player || !this.player.mesh || this.gameOver) return;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const projectile = this.projectiles[i];
      if (!projectile || !projectile.mesh) { this.projectiles.splice(i,1); continue; }

      if (projectile.owner === 'player') {
        const projectileBox = projectile.getBoundingBox();
        for (let j = this.enemies.length - 1; j >= 0; j--) {
          const enemy = this.enemies[j];
          if (!enemy || !enemy.mesh || enemy.isConverted || enemy.health <=0) continue;
          const enemyBox = enemy.getBoundingBox();
          if (projectileBox.intersectsBox(enemyBox)) {
            const damageResult = enemy.takeDamage(projectile.baseDamage, projectile.finalDamage, projectile.isCriticalHit, this);
            const damageColor = projectile.isCriticalHit ? DOT_COLORS.crit : DOT_COLORS.hit;

            if (this.scene.userData.FloatingDamageText && enemy.mesh) {
              const FloatingDamageTextConstructor = this.scene.userData.FloatingDamageText as typeof FloatingDamageText;
              const damageText = new FloatingDamageTextConstructor(this.scene, damageResult.actualDamageDealt.toFixed(1).toString(), enemy.mesh.position.clone().add(new THREE.Vector3(0, ENEMY_STATS[enemy.type].isBoss ? 0.8 : 0.3 ,0)), damageColor, projectile.isCriticalHit);
              this.floatingDamageNumbers.push(damageText);
            }

            if (projectile.statusEffectsToApply && projectile.statusEffectsToApply.length > 0) {
                projectile.statusEffectsToApply.forEach(effectData => {
                    enemy.applyStatusEffect(effectData, this);
                });
            }

            if (this.player.stats.rollForLifeSteal()) {
              const prevHealthLifeSteal = this.player.health;
              const healAmount = damageResult.actualDamageDealt * (LIFE_STEAL_VALUE_PERCENT / 100);
              this.player.heal(healAmount);
              this.onGameEvent({ type: 'playerHealthUpdate', health: this.player.health, maxHealth: this.player.maxHealth, previousHealth: prevHealthLifeSteal });
            }
            if (!damageResult.didDie && this.player.stats.rollForEnemyConversion() && !ENEMY_STATS[enemy.type].isBoss) {
              enemy.convertEnemy(this); 
            }
            projectile.dispose(); this.projectiles.splice(i, 1);
            if (damageResult.didDie && enemy.mesh) this.handleEnemyDeath(enemy, enemy.mesh.position.clone());
            break; 
          }
        }
      } else if (projectile.owner === 'enemy_heal') {
        const healingOrbBox = projectile.getBoundingBox();
        for (let k = this.enemies.length - 1; k >= 0; k--) {
            const potentialHealTarget = this.enemies[k];
            if (!potentialHealTarget || !potentialHealTarget.mesh || potentialHealTarget.isConverted || potentialHealTarget.health <= 0 || potentialHealTarget.health >= potentialHealTarget.maxHealth) continue;
            
            const enemyBox = potentialHealTarget.getBoundingBox();
            if (healingOrbBox.intersectsBox(enemyBox)) {
                potentialHealTarget.heal(projectile.baseDamage); 
                
                if (this.scene.userData.FloatingDamageText && potentialHealTarget.mesh) {
                    const FloatingDamageTextConstructor = this.scene.userData.FloatingDamageText as typeof FloatingDamageText;
                    const healText = new FloatingDamageTextConstructor(this.scene, `+${projectile.baseDamage.toFixed(0)}`, potentialHealTarget.mesh.position.clone().add(new THREE.Vector3(0, 0.3, 0)), DOT_COLORS.heal, false);
                    this.floatingDamageNumbers.push(healText);
                }
                projectile.dispose(); this.projectiles.splice(i, 1);
                break; 
            }
        }
      }
    }
    if (this.gameOver) return;
    const playerBox = this.player.getBoundingBox();
    if (!this.player.isDashing) {
        for (let k = this.enemies.length - 1; k >= 0; k--) {
            const enemy = this.enemies[k];
            if (!enemy || !enemy.mesh || enemy.isConverted || enemy.health <= 0) continue;
            const enemyBox = enemy.getBoundingBox();
            if (playerBox.intersectsBox(enemyBox)) {
                const damageAmount = ENEMY_STATS[enemy.type].collisionDamage;
                const prevHealthPlayerCollision = this.player.health;
                this.player.takeDamage(damageAmount);
                this.onGameEvent({ type: 'playerHealthUpdate', health: this.player.health, maxHealth: this.player.maxHealth, previousHealth: prevHealthPlayerCollision });
                const enemyCollisionDamageTaken = ENEMY_STATS[enemy.type].isBoss ? 5 : 25;
                const enemyDamageResult = enemy.takeDamage(enemyCollisionDamageTaken, enemyCollisionDamageTaken, false, this);
                if(enemyDamageResult.didDie && enemy.mesh) this.handleEnemyDeath(enemy, enemy.mesh.position.clone());
                if (this.player.health <= 0) { this.setGameOver(); return; }
                break;
            }
        }
    }
    for (let l = this.projectiles.length - 1; l >= 0; l--) {
        const projectile = this.projectiles[l];
        if (!projectile || !projectile.mesh || projectile.owner !== 'enemy') continue; 
        const projectileBox = projectile.getBoundingBox();
        if (playerBox.intersectsBox(projectileBox)) {
            const prevHealthProjectileHit = this.player.health;
            this.player.takeDamage(projectile.finalDamage);
            this.onGameEvent({ type: 'playerHealthUpdate', health: this.player.health, maxHealth: this.player.maxHealth, previousHealth: prevHealthProjectileHit });
            projectile.dispose(); this.projectiles.splice(l,1);
            if (this.player.health <= 0) this.setGameOver();
            return;
        }
    }
    for (let m = this.xpOrbs.length - 1; m >= 0; m--) {
        const orb = this.xpOrbs[m];
        if (!orb || !orb.mesh) continue;
        const orbBox = orb.getBoundingBox();
        if (playerBox.intersectsBox(orbBox)) {
            this.onGameEvent({ type: 'scoreUpdate', xpGained: orb.xpValue });
            const healAmount = 2.5;
            this.player.heal(healAmount);
            this.onGameEvent({ type: 'playerHealthUpdate', health: this.player.health, maxHealth: this.player.maxHealth, previousHealth: this.player.health - healAmount });
            orb.dispose(); this.xpOrbs.splice(m, 1);
        }
    }
  }

  private setGameOver(): void {
    if (this.gameOver) return;
    this.gameOver = true;
    if(this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = undefined;
    this.isPaused = false; this.isPausedForUpgrade = false;
    this.isBossActive = false; this.bossPendingSpawn = false;
    this.isInWorld2 = false;
    this.onGameOverCallback(this.score);
    this.movement = { left: false, right: false, up: false, down: false, shoot: false };
  }

  private updateCameraShake(deltaTime: number): void {
    if (this.cameraShakeActive) {
      const elapsed = this.clock.getElapsedTime() - this.cameraShakeStartTime;
      if (elapsed < this.cameraShakeDuration) {
        const offsetX = (Math.random() - 0.5) * this.cameraShakeIntensity * 2;
        const offsetY = (Math.random() - 0.5) * this.cameraShakeIntensity * 2;
        this.camera.position.x = this.originalCameraPosition.x + offsetX;
        this.camera.position.y = this.originalCameraPosition.y + offsetY;
      } else {
        this.camera.position.copy(this.originalCameraPosition);
        this.cameraShakeActive = false;
      }
    }
  }

  public triggerCameraShake(duration: number, intensity: number): void {
    if (this.cameraShakeActive) return;
    this.originalCameraPosition.copy(this.camera.position);
    this.cameraShakeActive = true; this.cameraShakeDuration = duration; this.cameraShakeIntensity = intensity;
    this.cameraShakeStartTime = this.clock.getElapsedTime();
  }

  private updateSuperLaser(deltaTime: number): void {
    if (this.activeSuperLaser && performance.now() > this.superLaserEndTime) {
        this.scene.remove(this.activeSuperLaser);
        this.activeSuperLaser.geometry.dispose();
        (this.activeSuperLaser.material as THREE.Material).dispose();
        this.activeSuperLaser = null;
    }
    if (this.activeSuperLaser) {
        const laserBox = new THREE.Box3().setFromObject(this.activeSuperLaser);
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            if (!enemy || !enemy.mesh || enemy.isConverted || enemy.health <= 0) continue;
            const enemyBox = enemy.getBoundingBox();
            if (laserBox.intersectsBox(enemyBox)) {
                const damageAmount = ENEMY_STATS[enemy.type].isBoss ? 20 : enemy.health; 
                const damageResult = enemy.takeDamage(damageAmount, damageAmount, false, this);
                 if (this.scene.userData.FloatingDamageText && enemy.mesh) {
                    const FloatingDamageTextConstructor = this.scene.userData.FloatingDamageText as typeof FloatingDamageText;
                    const damageText = new FloatingDamageTextConstructor(this.scene, damageResult.actualDamageDealt.toFixed(0).toString(), enemy.mesh.position.clone().add(new THREE.Vector3(0, ENEMY_STATS[enemy.type].isBoss ? 0.8 : 0.3 ,0)), DOT_COLORS.hit, false);
                    this.floatingDamageNumbers.push(damageText);
                }
                if (damageResult.didDie && enemy.mesh) {
                    this.handleEnemyDeath(enemy, enemy.mesh.position.clone());
                }
            }
        }
    }
  }


  private update(deltaTime: number): void {
    if (this.gameOver || this.isPaused || this.isPausedForUpgrade || !this.player) return;
    (this.scene.userData as any).deltaTime = deltaTime;
    this.player.update(this.movement, deltaTime, this);
    this.player.updateFlashRed(this.scene.userData.clock as THREE.Clock);
    if (this.movement.shoot) {
      const newPlayerProjectiles = this.player.shoot();
      if (newPlayerProjectiles) {
        if (Array.isArray(newPlayerProjectiles)) {
            this.projectiles.push(...newPlayerProjectiles);
        } else {
            this.projectiles.push(newPlayerProjectiles);
        }
      }
    }
    this.updateCameraShake(deltaTime); this.updateBackgroundClouds(deltaTime);
    this.updateSuperLaser(deltaTime);

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const projectile = this.projectiles[i];
      if (!projectile || !projectile.mesh) { this.projectiles.splice(i, 1); continue; }
      projectile.update();
      if (projectile.isOutOfBounds(this.worldLeftEdge, this.worldRightEdge, this.worldTopEdge, this.worldBottomEdge)) {
        projectile.dispose(); this.projectiles.splice(i, 1);
      }
    }
    for (let i = this.xpOrbs.length - 1; i >= 0; i--) {
        const orb = this.xpOrbs[i];
        if (!orb || !orb.mesh) { this.xpOrbs.splice(i,1); continue; }
        orb.update(deltaTime);
        if (orb.isOutOfBounds(this.worldLeftEdge, this.worldRightEdge, this.worldTopEdge, this.worldBottomEdge)) {
            orb.dispose(); this.xpOrbs.splice(i, 1);
        }
    }
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (!enemy || !enemy.mesh || enemy.health <= 0) { 
         if (enemy && enemy.health <= 0 && this.enemies.indexOf(enemy) === -1) {  }
         else if (enemy && enemy.mesh) { enemy.dispose(); } 
         this.enemies.splice(i,1); continue;
      }
      
      enemy.updateStatusEffects(deltaTime, this);
      if (enemy.mesh && enemy.health <= 0 && !enemy.isConverted) { 
          this.handleEnemyDeath(enemy, enemy.mesh.position.clone()); 
          continue;
      }
      
      if (!enemy.mesh) { 
        this.enemies.splice(i, 1);
        continue;
      }

      try {
        const enemyProjectiles = enemy.update(deltaTime, this.player?.mesh?.position, this);
        if (enemyProjectiles && enemyProjectiles.length > 0) {
            this.projectiles.push(...enemyProjectiles);
        }
      } catch (e: any) {
        console.error("Error during enemy.update():", e.message, e.stack, enemy);
        if (enemy.type && ENEMY_STATS[enemy.type] && ENEMY_STATS[enemy.type].isBoss) {
            this.setGameOver(); 
            return; 
        } else {
            if(enemy.mesh) enemy.dispose(); 
            this.enemies.splice(i, 1);
            continue; 
        }
      }

      let outOfBounds = false;
      if (enemy.mesh) { 
        if (enemy.isConverted) {
            outOfBounds = enemy.mesh.position.x > this.worldRightEdge + 1;
        } else {
            outOfBounds = enemy.isOutOfBounds();
        }
      } else {
        outOfBounds = true; 
      }

      if (outOfBounds) {
        if(enemy.mesh) enemy.dispose(); 
        this.enemies.splice(i, 1);
      }
    }
    for (let i = this.activeExplosions.length - 1; i >= 0; i--) {
      const explosion = this.activeExplosions[i];
      if (!explosion || !explosion.mesh) { this.activeExplosions.splice(i,1); continue; }
      explosion.update(deltaTime);
      if (explosion.isFinished()) { explosion.dispose(); this.activeExplosions.splice(i, 1); }
    }
    for (let i = this.floatingDamageNumbers.length - 1; i >= 0; i--) {
      const text = this.floatingDamageNumbers[i];
      if (!text || !text.sprite) { this.floatingDamageNumbers.splice(i, 1); continue; }
      text.update(deltaTime);
      if (text.isFinished()) { text.dispose(); this.floatingDamageNumbers.splice(i, 1); }
    }
    this.spawnEnemy(); this.handleCollisions();
  }

  private animate(): void {
    if (this.isPaused || this.isPausedForUpgrade || this.gameOver) {
        if(this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = undefined; return;
    }
    this.animationFrameId = requestAnimationFrame(this.animate.bind(this));
    try {
        const deltaTime = Math.min(this.clock.getDelta(), 0.1); 
        this.update(deltaTime);
        if (this.composer) this.composer.render();
    } catch (e: any) {
        console.error("CRITICAL ERROR in Game.animate() loop:", e.message, e.stack);
        this.setGameOver(); 
    }
  }

  public triggerLevelUpUpgradeSelection(isTechTreeEvent: boolean = false): void {
    if (this.gameOver || !this.player) return;

    this.pauseGame(true); 

    if (isTechTreeEvent) {
        const skillUnlockCards: CardData[] = [
            
            { id: 'skill-unlock-super-laser', name: 'Unlock: Super Laser', description: 'Unleash a devastating beam.', effects: [], tier: CardTier.EPIC, isSkillUnlock: true, skillToUnlock: UAType.SUPER_LASER, skillPointCost: 1 },
            { id: 'skill-unlock-spread-shotgun', name: 'Unlock: Spread Shotgun', description: 'Fire multiple projectiles in a cone for a short duration.', effects: [], tier: CardTier.EPIC, isSkillUnlock: true, skillToUnlock: UAType.SPREAD_SHOTGUN, skillPointCost: 1 },
            { id: 'skill-unlock-i-am-nuclear', name: 'Unlock: I Am Nuclear', description: 'Clear the screen with a massive explosion.', effects: [], tier: CardTier.LEGENDARY, isSkillUnlock: true, skillToUnlock: UAType.I_AM_NUCLEAR, skillPointCost: 1 },
            
            { id: 'skill-unlock-backwards-shot', name: 'Unlock: Backwards Shot', description: 'Fire projectiles behind your ship.', effects: [], tier: CardTier.RARE, isSkillUnlock: true, skillToUnlock: UAType.BACKWARDS_SHOT, skillPointCost: 1 },
            { id: 'skill-unlock-bbp', name: 'Unlock: Big Black Projectile', description: 'Launch a slow, enemy-absorbing projectile. (WIP)', effects: [], tier: CardTier.EPIC, isSkillUnlock: true, skillToUnlock: UAType.BBP, skillPointCost: 1 },
            { id: 'skill-unlock-crescent-moon', name: 'Unlock: Crescent Moon', description: 'Summon a damaging shield in front of the ship. (WIP)', effects: [], tier: CardTier.EPIC, isSkillUnlock: true, skillToUnlock: UAType.CRESCENT_MOON, skillPointCost: 1 },
        ];
        this.onGameEvent({ type: 'levelUpCardSelection', cardsForSelection: skillUnlockCards });
    } else {
        
        const selectedCards: CardData[] = [];
        const poolCopy = [...this.cardPool];
        const drawnIndices = new Set<number>();
        const attempts = Math.min(3, poolCopy.length);
        for (let i = 0; i < attempts; i++) {
            if (drawnIndices.size >= poolCopy.length) break;
            let randomIndex: number;
            do { randomIndex = Math.floor(Math.random() * poolCopy.length); } while (drawnIndices.has(randomIndex));
            drawnIndices.add(randomIndex);
            const card = poolCopy[randomIndex];
            let currentTurretsFromStats = 0;
            if (this.player && this.player.stats && this.player.stats.turretCount > 0) {
                currentTurretsFromStats = this.player.stats.turretCount;
            }
            const isTurretCard = card.effects.some(effect => effect.stat === PlayerStatType.TurretCount);
            if (isTurretCard && currentTurretsFromStats >= MAX_TURRETS) { i--; continue; }
            selectedCards.push(card);
        }
        this.onGameEvent({ type: 'levelUpCardSelection', cardsForSelection: selectedCards });
    }
  }


  public applyPlayerUpgrade(card: CardData): void {
    if (this.player) {
        const prevHealthBeforeUpgrade = this.player.health;
        this.player.stats.applyCard(card); 
        this.player.updateMaxHealth();
        this.player.health = Math.min(this.player.health, this.player.maxHealth);
        this.onGameEvent({ type: 'playerHealthUpdate', health: this.player.health, maxHealth: this.player.maxHealth, previousHealth: prevHealthBeforeUpgrade });
        
        if (card.isSkillUnlock) {
            this.onGameEvent({ type: 'specialAttackUpdate', unlockedAbilities: this.player.stats.getUnlockedAbilitiesStatus() });
            this.onGameEvent({ type: 'skillPointsUpdated', availableSkillPoints: this.player.stats.availableSkillPoints });
        }
    }
  }

  public triggerSuperLaser(playerPosition: THREE.Vector3, playerQuaternion: THREE.Quaternion): void {
    if (this.activeSuperLaser) return; 

    const laserHeight = (this.worldTopEdge - this.worldBottomEdge) * 0.5;
    const laserWidth = 0.2; 
    const laserLength = (this.worldRightEdge - this.worldLeftEdge) * 1.5; 

    const laserGeometry = new THREE.PlaneGeometry(laserLength, laserHeight);
    const laserMaterial = new THREE.MeshBasicMaterial({
        color: 0xffdd33, 
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
    });
    this.activeSuperLaser = new THREE.Mesh(laserGeometry, laserMaterial);

    const playerForward = new THREE.Vector3(1,0,0).applyQuaternion(playerQuaternion);
    const laserOffset = playerForward.clone().multiplyScalar(laserLength / 2 + Player.PLAYER_WIDTH / 2);
    this.activeSuperLaser.position.copy(playerPosition).add(laserOffset);
    this.activeSuperLaser.position.z = playerPosition.z + 0.1; 
    this.activeSuperLaser.quaternion.copy(playerQuaternion);

    this.scene.add(this.activeSuperLaser);
    this.superLaserEndTime = performance.now() + 300; 
    this.triggerCameraShake(0.3,0.05);
  }

  public triggerNuclearExplosion(centerPosition: THREE.Vector3): void {
    const explosion = new SpriteAnimation(this.scene, 4, 2, 8, 0.8, 15, 0,0,0xff8888, 0xffdddd, 2.5); 
    explosion.play(new THREE.Vector3( (this.worldLeftEdge + this.worldRightEdge) / 2 , (this.worldTopEdge + this.worldBottomEdge) / 2, 1) ); 
    this.activeExplosions.push(explosion);
    this.triggerCameraShake(0.8, 0.15);

    for (let i = this.enemies.length - 1; i >= 0; i--) {
        const enemy = this.enemies[i];
        if (!enemy || !enemy.mesh || enemy.isConverted) continue;

        if (ENEMY_STATS[enemy.type].isBoss) {
            const damageResult = enemy.takeDamage(100, 100, false, this);
            if (this.scene.userData.FloatingDamageText && enemy.mesh) {
                const FloatingDamageTextConstructor = this.scene.userData.FloatingDamageText as typeof FloatingDamageText;
                const damageText = new FloatingDamageTextConstructor(this.scene, damageResult.actualDamageDealt.toFixed(0).toString(), enemy.mesh.position.clone().add(new THREE.Vector3(0,0.8,0)), DOT_COLORS.hit, false);
                this.floatingDamageNumbers.push(damageText);
            }
            if (damageResult.didDie && enemy.mesh) { 
                this.handleEnemyDeath(enemy, enemy.mesh.position.clone());
            }
        } else {
            if(enemy.mesh) this.handleEnemyDeath(enemy, enemy.mesh.position.clone()); 
        }
    }
  }


  public dispose(): void {
    if(this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = undefined;
    this.removeEventListeners();

    if (this.generatedEnvMap) { this.generatedEnvMap.dispose(); this.generatedEnvMap = null; }
    if (this.assets.hdriTexture) { this.assets.hdriTexture.dispose(); this.assets.hdriTexture = undefined; }
    if (this.scene) { this.scene.environment = null; this.scene.background = null; }
    this.backgroundClouds.forEach(cloud => {
        if (cloud.geometry) cloud.geometry.dispose();
        if (cloud.material instanceof THREE.Material) cloud.material.dispose();
        if (cloud.parent) this.scene.remove(cloud);
    });
    this.backgroundClouds = [];
    if (this.scene) {
        this.scene.traverse(object => {
            if (object !== this.scene && !(this.backgroundClouds.includes(object as THREE.Mesh))) {
                if (object instanceof THREE.Mesh) {
                    object.geometry?.dispose();
                    if (object.material) {
                      const material = object.material as THREE.Material | THREE.Material[];
                      if (Array.isArray(material)) material.forEach(mat => mat?.dispose());
                      else if (material) material.dispose();
                    }
                }
            }
        });
    }
    this.player?.dispose();
    this.enemies.forEach(e => e?.dispose()); this.enemies = [];
    this.projectiles.forEach(p => p?.dispose()); this.projectiles = [];
    this.activeExplosions.forEach(explosion => explosion?.dispose()); this.activeExplosions = [];
    this.xpOrbs.forEach(orb => orb?.dispose()); this.xpOrbs = [];
    this.floatingDamageNumbers.forEach(text => text?.dispose()); this.floatingDamageNumbers = [];

    this.assets.playerModel?.traverse(child => { if (child instanceof THREE.Mesh) {child.geometry.dispose(); (child.material as THREE.Material).dispose();} });
    this.assets.turretModel?.traverse(child => { if (child instanceof THREE.Mesh) {child.geometry.dispose(); (child.material as THREE.Material).dispose();} });
    this.assets.drone1Model?.traverse(child => { if (child instanceof THREE.Mesh) {child.geometry.dispose(); (child.material as THREE.Material).dispose();} });
    this.assets.pyramidModel?.traverse(child => { if (child instanceof THREE.Mesh) {child.geometry.dispose(); (child.material as THREE.Material).dispose();} });
    this.assets.muzzleFlashTexture?.dispose();
    this.assets.explosionTexture?.dispose();


    if (this.renderer) { this.renderer.dispose(); (this.renderer as any) = null; }
    (this.composer as any) = null;
  }
}

    