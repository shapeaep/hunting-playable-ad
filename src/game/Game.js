import * as THREE from 'three';
import sdk from '@smoud/playable-sdk';
import { CONFIG } from '../config';
import spawnPointsData from '../spawn-points.js';
import { World } from './World';
import { AnimalManager } from './Animals';
import { BulletTime } from './BulletTime';
import { AudioManager } from './AudioManager';
import { DebugEditor } from './DebugEditor';
import { Rifle } from './Rifle';

// Load spawn points from JS module (for production build)
CONFIG.spawnPoints = Array.isArray(spawnPointsData) ? spawnPointsData : [];

/**
 * Main game controller - Camera on tower looks at moving animal
 */
export class Game {
    constructor(canvas) {
        this.canvas = canvas;
        
        // Game state
        this.state = {
            score: 0,
            kills: 0,
            currentFov: CONFIG.baseFov,
            targetFov: CONFIG.baseFov,
            canShoot: true,
            isAiming: false,
            timeScale: 1,
            gameEnded: false,
            // Camera shake
            shakeIntensity: 0,
            shakeTime: 0
        };
        
        // Current target animal
        this.currentAnimal = null;
        
        // Camera lookAt state (smooth tracking)
        this.cameraLookAt = {
            current: new THREE.Vector3(),
            target: new THREE.Vector3(),
        };
        
        // Crosshair offset (for aiming)
        this.crosshair = {
            offsetX: 0,  // -1 to 1 (screen space)
            offsetY: 0,
            startX: 0,
            startY: 0,
            touchStartX: 0,
            touchStartY: 0,
        };
        
        this.init();
    }
    
    init() {
        this.setupRenderer();
        this.setupScene();
        this.setupCamera();
        this.setupLighting();
        
        this.world = new World(this.scene);
        this.world.create();
        
        this.animalManager = new AnimalManager(this.scene, this.world);
        
        this.bulletTime = new BulletTime(this.scene, this.camera);
        
        // First-person rifle (follows camera)
        this.rifle = new Rifle(this.camera, this.scene);
        
        this.raycaster = new THREE.Raycaster();
        
        // Audio system
        this.audio = new AudioManager();
        
        this.setupInput();
        this.clock = new THREE.Clock();
        
        // Debug editor (press E to toggle)
        this.debugEditor = new DebugEditor(this);
        
        // Initialize UI state
        this.showAimUI(false);
        this.updateScoreUI();
        
        // Spawn first animal after a short delay
        setTimeout(() => this.spawnNextAnimal(), CONFIG.firstSpawnDelay || 500);
    }
    
    /**
     * Initialize audio on first user interaction
     */
    initAudio() {
        if (!this.audioInitialized) {
            this.audio.init();
            this.audio.startAmbient();
            this.audioInitialized = true;
        }
    }
    
    /**
     * Spawn the next animal (ONLY from spawn points)
     */
    spawnNextAnimal() {
        // Only spawn from spawn points - no random fallback
        if (!CONFIG.spawnPoints || CONFIG.spawnPoints.length === 0) {
            console.log('⚠️ No spawn points defined! Press E to enter debug mode and place spawn points.');
            return;
        }
        
        // Check if we have more spawn points
        if (this.state.kills >= CONFIG.spawnPoints.length) {
            console.log('✅ All spawn points completed!');
            this.state.gameEnded = true;
            setTimeout(() => this.showCTA(), 500);
            return;
        }
        
        const spawnPoint = CONFIG.spawnPoints[this.state.kills];
        const animal = this.animalManager.spawnAnimal(
            spawnPoint.type || 'deer',
            spawnPoint.x,
            spawnPoint.z
        );
        
        if (!animal) return;
        
        this.currentAnimal = animal;
        console.log(`🦌 Spawned ${spawnPoint.type || 'deer'} at spawn point #${this.state.kills + 1}/${CONFIG.spawnPoints.length}`);
        
        // Look at new animal
        const lookAt = this.getAnimalLookAtPosition(animal);
        this.cameraLookAt.target.copy(lookAt);
        
        // Snap camera on first spawn
        if (this.state.kills === 0) {
            this.cameraLookAt.current.copy(lookAt);
        }
    }
    
    /**
     * Get look-at position for animal (center of body)
     */
    getAnimalLookAtPosition(animal) {
        if (!animal) return new THREE.Vector3(0, 0, -50);
        
        const pos = animal.position.clone();
        pos.y += 1; // Look at animal's center/body
        return pos;
    }
    
    setupRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            powerPreference: 'high-performance'
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.maxPixelRatio));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1;
    }
    
    setupScene() {
        this.scene = new THREE.Scene();
    }
    
    setupCamera() {
        this.camera = new THREE.PerspectiveCamera(
            CONFIG.baseFov,
            window.innerWidth / window.innerHeight,
            0.1,
            500
        );
        // Camera fixed on tower
        this.camera.position.set(0, CONFIG.towerHeight, 0);
        
        // Initialize lookAt to forward
        this.cameraLookAt.current.set(0, CONFIG.towerHeight - 2, -50);
        this.cameraLookAt.target.set(0, CONFIG.towerHeight - 2, -50);
    }
    
    setupLighting() {
        const ambient = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(ambient);
        
        const sun = new THREE.DirectionalLight(0xfff8e8, 3);
        sun.position.set(-110, 200, 95);
        sun.castShadow = true;
        sun.shadow.mapSize.width = CONFIG.shadowMapSize;
        sun.shadow.mapSize.height = CONFIG.shadowMapSize;
        sun.shadow.camera.near = 10;
        sun.shadow.camera.far = 300;
        sun.shadow.camera.left = -100;
        sun.shadow.camera.right = 100;
        sun.shadow.camera.top = 100;
        sun.shadow.camera.bottom = -100;
        sun.shadow.bias = -0.001;
        this.scene.add(sun);
        
        const rim = new THREE.DirectionalLight(0xffe4b5, 1.3);
        rim.position.set(-50, 30, -50);
        this.scene.add(rim);
    }
    
    setupInput() {
        const getPos = (e) => {
            const touch = e.touches?.[0] || e;
            return { x: touch.clientX, y: touch.clientY };
        };
        
        const onStart = (e) => {
            if (this.state.gameEnded) return;
            if (this.bulletTime.active) return;
            if (this.debugEditor?.active) return;
            
            e.preventDefault();
            this.initAudio();
            
            // Start aiming
            this.state.isAiming = true;
            this.state.targetFov = CONFIG.zoomedFov;
            
            // Store touch start position
            const pos = getPos(e);
            this.crosshair.touchStartX = pos.x;
            this.crosshair.touchStartY = pos.y;
            this.crosshair.startX = this.crosshair.offsetX;
            this.crosshair.startY = this.crosshair.offsetY;
            
            // Show scope UI
            this.showAimUI(true);
            
            // Rifle scope animation
            this.rifle?.playScopeIn();
        };
        
        const onMove = (e) => {
            if (!this.state.isAiming) return;
            e.preventDefault();
            
            const pos = getPos(e);
            const deltaX = pos.x - this.crosshair.touchStartX;
            const deltaY = pos.y - this.crosshair.touchStartY;
            
            // Convert to normalized offset (-1 to 1)
            const sensitivity = CONFIG.aimSensitivity;
            const limit = CONFIG.crosshairLimit;
            
            this.crosshair.offsetX = THREE.MathUtils.clamp(
                this.crosshair.startX + deltaX * sensitivity,
                -limit, limit
            );
            this.crosshair.offsetY = THREE.MathUtils.clamp(
                this.crosshair.startY + deltaY * sensitivity,
                -limit, limit
            );
            
            // Update crosshair position
            this.updateCrosshairUI();
        };
        
        const onEnd = () => {
            if (!this.state.isAiming) return;
            
            // Shoot when released (Reload animation will play)
            this.shoot();
            
            // End aiming
            this.state.isAiming = false;
            this.state.targetFov = CONFIG.baseFov;
            
            // Reset crosshair
            this.crosshair.offsetX = 0;
            this.crosshair.offsetY = 0;
            
            // Hide scope UI
            this.showAimUI(false);
            this.updateCrosshairUI();
            
            // После выстрела Reload анимация сама вернётся к Idle
            // НЕ вызываем playScopeOut() - иначе конфликт анимаций
        };
        
        // Touch events
        document.addEventListener('touchstart', onStart, { passive: false });
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onEnd);
        
        // Mouse events
        document.addEventListener('mousedown', onStart);
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onEnd);
        
        // Spacebar to shoot (for testing)
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !e.repeat) {
                e.preventDefault();
                if (!this.state.isAiming) {
                    this.state.isAiming = true;
                    this.state.targetFov = CONFIG.zoomedFov;
                    this.showAimUI(true);
                    this.rifle?.playScopeIn();
                }
            }
        });
        
        document.addEventListener('keyup', (e) => {
            if (e.code === 'Space') {
                if (this.state.isAiming) {
                    this.shoot();
                    this.state.isAiming = false;
                    this.state.targetFov = CONFIG.baseFov;
                    this.showAimUI(false);
                    // Reload анимация сама вернётся к Idle
                }
            }
        });
        
        // CTA button
        document.getElementById('cta')?.addEventListener('click', () => {
            sdk.install();
        });
        
        window.addEventListener('resize', () => this.resize());
    }
    
    showAimUI(show) {
        const scope = document.getElementById('scope');
        const crosshair = document.getElementById('crosshair');
        const tapHint = document.getElementById('tap-hint');
        const releaseHint = document.getElementById('release-hint');
        const joystick = document.getElementById('joystick-zone');
        const killsPanel = document.getElementById('kills-panel');
        
        if (show) {
            scope?.classList.add('visible');
            crosshair?.classList.add('visible');
            releaseHint?.classList.add('visible');
            // Hide these when aiming
            if (tapHint) tapHint.style.display = 'none';
            if (joystick) joystick.style.display = 'none';
            if (killsPanel) killsPanel.style.display = 'none';
        } else {
            scope?.classList.remove('visible');
            crosshair?.classList.remove('visible');
            releaseHint?.classList.remove('visible');
            // Show these when not aiming
            if (tapHint) tapHint.style.display = '';
            if (joystick) joystick.style.display = '';
            if (killsPanel) killsPanel.style.display = '';
        }
    }
    
    updateCrosshairUI() {
        const crosshair = document.getElementById('crosshair');
        if (!crosshair) return;
        
        const offsetX = this.crosshair.offsetX * window.innerWidth * 0.3;
        const offsetY = this.crosshair.offsetY * window.innerHeight * 0.3;
        
        crosshair.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`;
    }
    
    /**
     * Check what we're aiming at (raycast from camera through crosshair)
     */
    checkTargeting() {
        if (!this.currentAnimal || !this.currentAnimal.userData.alive) return null;
        
        // Create ray from camera through crosshair position (center of screen + offset)
        const crosshairPos = new THREE.Vector2(
            this.crosshair.offsetX * 0.5,
            -this.crosshair.offsetY * 0.5
        );
        
        this.raycaster.setFromCamera(crosshairPos, this.camera);
        
        // Check if ray is close enough to the animal
        const animalPos = this.currentAnimal.position.clone();
        animalPos.y += 0.8; // Center of body
        
        const toAnimal = animalPos.clone().sub(this.camera.position);
        const rayDir = this.raycaster.ray.direction;
        const dot = toAnimal.dot(rayDir);
        
        if (dot < 0) return null;
        
        // Find closest point on ray to animal
        const closest = this.camera.position.clone().add(rayDir.clone().multiplyScalar(dot));
        const dist = closest.distanceTo(animalPos);
        
        // Larger hit radius for easier aiming
        const targetRadius = (this.currentAnimal.userData.boundingRadius || 1) * 2.5;
        
        if (dist < targetRadius) {
            return this.currentAnimal;
        }
        
        return null;
    }
    
    /**
     * Shoot
     */
    shoot() {
        if (!this.state.canShoot || this.bulletTime.active) return;
        if (this.state.gameEnded) return;
        
        this.initAudio();
        this.audio.playGunshot();
        this.rifle?.playReload();
        this.state.canShoot = false;
        
        const targetAnimal = this.checkTargeting();
        
        if (targetAnimal) {
            // Hit - start bullet time
            this.animalManager.hideAllLabels();
            this.state.timeScale = this.bulletTime.start(targetAnimal);
            this.setBulletTimeUI(true);
        } else {
            // Miss
            this.showMiss();
            this.startCameraShake(0.7);
            setTimeout(() => { this.state.canShoot = true; }, CONFIG.shootCooldown);
        }
    }
    
    showMiss() {
        const miss = document.createElement('div');
        miss.className = 'miss-popup';
        miss.textContent = 'MISS';
        miss.style.left = '50%';
        miss.style.top = '45%';
        document.getElementById('ui')?.appendChild(miss);
        setTimeout(() => miss.remove(), 1200);
    }
    
    startCameraShake(intensityMultiplier = 1.0) {
        const shake = CONFIG.cameraShake || { intensity: 0.02, duration: 250 };
        this.state.shakeIntensity = shake.intensity * intensityMultiplier;
        this.state.shakeTime = shake.duration;
    }
    
    updateCameraShake(delta) {
        if (this.state.shakeTime <= 0) return { x: 0, y: 0 };
        
        const shake = CONFIG.cameraShake || { frequency: 30 };
        this.state.shakeTime -= delta * 1000;
        
        const progress = Math.max(0, this.state.shakeTime / (CONFIG.cameraShake?.duration || 250));
        const intensity = this.state.shakeIntensity * progress;
        
        const time = Date.now() * shake.frequency * 0.001;
        const shakeX = Math.sin(time * 13.7) * intensity;
        const shakeY = Math.cos(time * 17.3) * intensity;
        
        return { x: shakeX, y: shakeY };
    }
    
    setBulletTimeUI(active) {
        const elementsToHide = ['joystick-zone', 'kills-panel', 'tap-hint', 'release-hint'];
        
        if (active) {
            // Hide all UI during bullet time
            this.showAimUI(false);
            elementsToHide.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });
            // Hide rifle during bullet time
            this.rifle?.setVisible(false);
        } else {
            // Show UI after bullet time
            elementsToHide.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = '';
            });
            // Show rifle after bullet time
            this.rifle?.setVisible(true);
        }
    }
    
    onBulletHit(animal) {
        if (!animal) return;
        
        animal.userData.alive = false;
        this.state.score += animal.userData.points;
        this.state.kills++;
        
        this.updateScoreUI();
        this.showHitEffect();
        this.showScorePopup(animal.userData.points);
        
        // Animate death
        this.animalManager.animateDeath(animal, () => {
            this.animalManager.remove(animal);
            
            // Check if all spawn points completed
            const totalTargets = CONFIG.spawnPoints?.length || CONFIG.showCtaAfterKills;
            if (this.state.kills >= totalTargets) {
                this.state.gameEnded = true;
                setTimeout(() => this.showCTA(), 500);
            } else {
                // Spawn next animal from next spawn point
                setTimeout(() => this.spawnNextAnimal(), CONFIG.nextSpawnDelay || 800);
            }
        });
    }
    
    // ============ UI ============
    
    updateScoreUI() {
        const el = document.getElementById('score');
        if (el) el.textContent = this.state.score;
        
        // Update kills counter - use spawn points count or config
        const killsEl = document.getElementById('kills-count');
        if (killsEl) {
            const totalTargets = CONFIG.spawnPoints?.length || CONFIG.showCtaAfterKills;
            killsEl.textContent = `${this.state.kills}/${totalTargets}`;
        }
    }
    
    showHitEffect() {
        const el = document.getElementById('hit-effect');
        el?.classList.add('show');
        setTimeout(() => el?.classList.remove('show'), 200);
    }
    
    showScorePopup(points) {
        const popup = document.createElement('div');
        popup.className = 'score-popup';
        popup.textContent = '+' + points;
        popup.style.left = '50%';
        popup.style.top = '40%';
        document.getElementById('ui')?.appendChild(popup);
        setTimeout(() => popup.remove(), 1500);
    }
    
    showCTA() {
        const el = document.getElementById('cta');
        if (el) el.style.display = 'block';
        sdk.finish();
        
        const delay = CONFIG.autoRedirectDelay || 0;
        if (delay > 0) {
            setTimeout(() => {
                sdk.install();
            }, delay);
        }
    }
    
    resize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.bulletTime.resize();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    // ============ CAMERA UPDATE ============
    
    updateCamera(delta) {
        // Update target lookAt if we have an animal
        if (this.currentAnimal && this.currentAnimal.userData.alive) {
            this.cameraLookAt.target.copy(this.getAnimalLookAtPosition(this.currentAnimal));
        }
        
        // Smooth lookAt interpolation
        const smoothness = CONFIG.cameraFollow?.smoothness || 0.05;
        const t = 1 - Math.pow(1 - smoothness, delta * 60);
        this.cameraLookAt.current.lerp(this.cameraLookAt.target, t);
        
        // Apply camera shake
        const shake = this.updateCameraShake(delta);
        
        // Camera stays on tower, just looks at animal
        const lookAtWithShake = this.cameraLookAt.current.clone();
        lookAtWithShake.x += shake.x * 10;
        lookAtWithShake.y += shake.y * 10;
        
        this.camera.lookAt(lookAtWithShake);
    }
    
    // ============ GAME LOOP ============
    
    update() {
        const delta = Math.min(this.clock.getDelta(), 0.1);
        
        // Debug mode - free fly camera
        if (this.debugEditor?.active) {
            this.debugEditor.update(delta);
            this.animalManager.update(delta, 1);
            this.animalManager.updateLabels();
            this.renderer.render(this.scene, this.camera);
            return;
        }
        
        if (this.bulletTime.active) {
            const finished = this.bulletTime.update(delta);
            if (finished) {
                const hitAnimal = this.bulletTime.end();
                this.onBulletHit(hitAnimal);
                this.state.timeScale = 1;
                this.setBulletTimeUI(false);
                this.startCameraShake(0.5);
                setTimeout(() => { this.state.canShoot = true; }, CONFIG.shootCooldown);
            }
            this.renderer.render(this.scene, this.bulletTime.camera);
        } else {
            // FOV interpolation
            const zoomSmoothing = 1 - Math.pow(1 - CONFIG.zoomSpeed, delta * 60);
            this.state.currentFov = THREE.MathUtils.lerp(
                this.state.currentFov,
                this.state.targetFov,
                zoomSmoothing
            );
            this.camera.fov = this.state.currentFov;
            this.camera.updateProjectionMatrix();
            
            // Update camera follow
            this.updateCamera(delta);
            
            // Update rifle animations
            this.rifle?.update(delta);
            
            // Update animals
            this.animalManager.update(delta, this.state.timeScale);
            this.animalManager.updateLabels();
            
            this.renderer.render(this.scene, this.camera);
        }
    }
    
    start() {
        const loop = () => {
            requestAnimationFrame(loop);
            this.update();
        };
        loop();
    }
}
