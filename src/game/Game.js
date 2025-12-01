import * as THREE from 'three';
import sdk from '@smoud/playable-sdk';
import { CONFIG } from '../config';
import { World } from './World';
import { AnimalManager } from './Animals';
import { BulletTime } from './BulletTime';
import { AudioManager } from './AudioManager';

/**
 * Main game controller
 */
export class Game {
    constructor(canvas) {
        this.canvas = canvas;
        
        // State
        this.state = {
            score: 0,
            kills: 0,
            currentFov: CONFIG.baseFov,
            targetFov: CONFIG.baseFov,
            targetRotation: { x: -0.2, y: 0 },
            currentRotation: { x: -0.2, y: 0 },
            canShoot: true,
            targetedAnimal: null,
            timeScale: 1,
            isUserInputting: false,
            // Camera shake
            shakeIntensity: 0,
            shakeTime: 0
        };
        
        // Joystick
        this.joystick = {
            active: false,
            startX: 0,
            startY: 0,
            deltaX: 0,
            deltaY: 0,
            // Store initial camera rotation when joystick starts
            startRotationX: 0,
            startRotationY: 0,
            stick: null,
            zone: null,
            releaseHint: null,
            maxRadius: 50,
            firstShotDone: false
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
        for (let i = 0; i < CONFIG.animalCount; i++) {
            this.animalManager.spawn();
        }
        
        this.bulletTime = new BulletTime(this.scene, this.camera);
        
        this.raycaster = new THREE.Raycaster();
        this.screenCenter = new THREE.Vector2(0, 0);
        
        // Audio system
        this.audio = new AudioManager();
        
        this.setupJoystick();
        // Shoot button removed - shooting happens on joystick release
        // this.setupShootButton();
        this.setupInput();
        this.clock = new THREE.Clock();
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
        this.camera.position.set(0, CONFIG.towerHeight, 0);
    }
    
    setupLighting() {
        // Store light references for debug
        this.lights = {};
        
        this.lights.ambient = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(this.lights.ambient);
        
        this.lights.sun = new THREE.DirectionalLight(0xfff8e8, 3);
        this.lights.sun.position.set(-110, 200, 95);
        this.lights.sun.castShadow = true;
        this.lights.sun.shadow.mapSize.width = CONFIG.shadowMapSize;
        this.lights.sun.shadow.mapSize.height = CONFIG.shadowMapSize;
        this.lights.sun.shadow.camera.near = 10;
        this.lights.sun.shadow.camera.far = 300;
        this.lights.sun.shadow.camera.left = -100;
        this.lights.sun.shadow.camera.right = 100;
        this.lights.sun.shadow.camera.top = 100;
        this.lights.sun.shadow.camera.bottom = -100;
        this.lights.sun.shadow.bias = -0.001;
        this.scene.add(this.lights.sun);
        
        this.lights.rim = new THREE.DirectionalLight(0xffe4b5, 1.3);
        this.lights.rim.position.set(-50, 30, -50);
        this.scene.add(this.lights.rim);
        
        // Setup debug panel (commented out visualization)
        this.setupLightDebug();
    }
    
    setupLightDebug() {
        // Create debug panel
        const panel = document.createElement('div');
        panel.id = 'light-debug';
        panel.innerHTML = `
            <div class="debug-header">
                <span>🔆 Light Debug</span>
                <button id="debug-toggle">−</button>
            </div>
            <div class="debug-content" id="debug-content">
                <div class="debug-section">
                    <h4>Ambient</h4>
                    <label>Intensity: <span id="amb-int-val">0.7</span></label>
                    <input type="range" id="amb-intensity" min="0" max="2" step="0.1" value="0.7">
                </div>
                <div class="debug-section">
                    <h4>Sun</h4>
                    <label>Intensity: <span id="sun-int-val">3</span></label>
                    <input type="range" id="sun-intensity" min="0" max="3" step="0.1" value="3">
                    <label>Pos X: <span id="sun-x-val">-110</span></label>
                    <input type="range" id="sun-x" min="-200" max="200" step="5" value="-110">
                    <label>Pos Y: <span id="sun-y-val">200</span></label>
                    <input type="range" id="sun-y" min="10" max="200" step="5" value="200">
                    <label>Pos Z: <span id="sun-z-val">95</span></label>
                    <input type="range" id="sun-z" min="-200" max="200" step="5" value="95">
                </div>
                <div class="debug-section">
                    <h4>Rim</h4>
                    <label>Intensity: <span id="rim-int-val">1.3</span></label>
                    <input type="range" id="rim-intensity" min="0" max="2" step="0.1" value="1.3">
                    <label>Pos X: <span id="rim-x-val">-50</span></label>
                    <input type="range" id="rim-x" min="-200" max="200" step="5" value="-50">
                    <label>Pos Y: <span id="rim-y-val">30</span></label>
                    <input type="range" id="rim-y" min="10" max="200" step="5" value="30">
                    <label>Pos Z: <span id="rim-z-val">-50</span></label>
                    <input type="range" id="rim-z" min="-200" max="200" step="5" value="-50">
                </div>
                <div class="debug-section">
                    <h4>Renderer</h4>
                    <label>Exposure: <span id="exp-val">1</span></label>
                    <input type="range" id="exposure" min="0.5" max="3" step="0.1" value="1">
                </div>
                <button id="copy-settings" class="debug-btn">📋 Copy to Code</button>
                <div id="copy-status"></div>
            </div>
        `;
        
        // COMMENTED OUT - uncomment to show debug panel on screen
        // document.body.appendChild(panel);
        
        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            #light-debug {
                position: fixed;
                top: 10px;
                right: 10px;
                background: rgba(0,0,0,0.85);
                color: #fff;
                padding: 0;
                border-radius: 8px;
                font-size: 11px;
                z-index: 9999;
                width: 220px;
                font-family: monospace;
                pointer-events: auto;
            }
            .debug-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 12px;
                background: rgba(255,255,255,0.1);
                border-radius: 8px 8px 0 0;
                cursor: pointer;
            }
            .debug-header button {
                background: none;
                border: none;
                color: #fff;
                font-size: 16px;
                cursor: pointer;
                padding: 0 5px;
            }
            .debug-content {
                padding: 10px;
                max-height: 400px;
                overflow-y: auto;
            }
            .debug-content.collapsed {
                display: none;
            }
            .debug-section {
                margin-bottom: 12px;
                padding-bottom: 8px;
                border-bottom: 1px solid rgba(255,255,255,0.1);
            }
            .debug-section:last-child {
                border-bottom: none;
                margin-bottom: 0;
            }
            .debug-section h4 {
                margin: 0 0 6px 0;
                color: #6bb8d0;
                font-size: 11px;
            }
            .debug-section label {
                display: block;
                margin: 4px 0 2px;
                color: #aaa;
            }
            .debug-section input[type="range"] {
                width: 100%;
                margin: 2px 0 6px;
            }
            .debug-section span {
                color: #fff;
                font-weight: bold;
            }
            .debug-btn {
                width: 100%;
                padding: 8px;
                margin-top: 8px;
                background: #4a90a4;
                border: none;
                border-radius: 4px;
                color: #fff;
                cursor: pointer;
                font-size: 11px;
                font-family: monospace;
            }
            .debug-btn:hover {
                background: #5ba0b4;
            }
            #copy-status {
                text-align: center;
                padding: 4px;
                color: #6f6;
                font-size: 10px;
            }
        `;
        // COMMENTED OUT - uncomment to add styles for debug panel
        // document.head.appendChild(style);
    }
    
    setupJoystick() {
        const zone = document.getElementById('joystick-zone');
        const stick = document.getElementById('joystick-stick');
        const releaseHint = document.getElementById('release-hint');
        if (!zone || !stick) return;
        
        this.joystick.stick = stick;
        this.joystick.zone = zone;
        this.joystick.releaseHint = releaseHint;
        
        const getPos = (e) => {
            const touch = e.touches?.[0] || e;
            return { x: touch.clientX, y: touch.clientY };
        };
        
        const onStart = (e) => {
            e.preventDefault();
            if (this.bulletTime.active) return;
            
            // Init audio on first interaction
            this.initAudio();
            
            // Zoom in immediately when joystick pressed
            this.state.targetFov = CONFIG.zoomedFov;
            
            // Hide joystick elements, show release hint (only before first shot)
            stick.classList.remove('tutorial');
            zone.classList.add('active');
            if (!this.joystick.firstShotDone) {
                releaseHint?.classList.add('visible');
            }
            
            // Use touch position as start point - full screen is control area
            const pos = getPos(e);
            this.joystick.active = true;
            this.joystick.startX = pos.x;
            this.joystick.startY = pos.y;
            this.joystick.deltaX = 0;
            this.joystick.deltaY = 0;
            // Save current camera rotation as starting point
            this.joystick.startRotationX = this.state.targetRotation.x;
            this.joystick.startRotationY = this.state.targetRotation.y;
        };
        
        const onMove = (e) => {
            if (!this.joystick.active) return;
            e.preventDefault();
            const pos = getPos(e);
            this.updateJoystick(pos.x, pos.y);
            
            // Mark as inputting when joystick is moved
            if (Math.abs(this.joystick.deltaX) > 0.1 || Math.abs(this.joystick.deltaY) > 0.1) {
                this.state.isUserInputting = true;
            }
        };
        
        const onEnd = () => {
            // Shoot when joystick is released
            if (this.joystick.active) {
                this.shoot();
                // Mark first shot done - hide tutorial elements permanently
                if (!this.joystick.firstShotDone) {
                    this.joystick.firstShotDone = true;
                    releaseHint?.classList.remove('visible');
                }
            }
            
            // Zoom out when released
            this.state.targetFov = CONFIG.baseFov;
            
            // Hide UI elements
            zone.classList.remove('active');
            
            // Show tutorial animation only before first shot
            if (!this.joystick.firstShotDone) {
                stick.classList.add('tutorial');
            }
            
            this.joystick.active = false;
            this.joystick.deltaX = 0;
            this.joystick.deltaY = 0;
            this.state.isUserInputting = false;
            stick.style.transform = 'translate(-50%, -50%)';
        };
        
        // Listen on entire document for full-screen control
        document.addEventListener('touchstart', onStart, { passive: false });
        document.addEventListener('mousedown', onStart);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('mousemove', onMove);
        document.addEventListener('touchend', onEnd);
        document.addEventListener('mouseup', onEnd);
    }
    
    updateJoystick(x, y) {
        const { startX, startY } = this.joystick;
        
        // Calculate delta from start position
        const dx = x - startX;
        const dy = y - startY;
        
        // Normalize by screen size - full screen is the control area
        // Moving across half the screen width = full speed
        const screenScale = Math.min(window.innerWidth, window.innerHeight) * 0.5;
        
        this.joystick.deltaX = dx / screenScale;
        this.joystick.deltaY = dy / screenScale;
        
        // Clamp to -1 to 1 range
        this.joystick.deltaX = Math.max(-1, Math.min(1, this.joystick.deltaX));
        this.joystick.deltaY = Math.max(-1, Math.min(1, this.joystick.deltaY));
    }
    
    setupShootButton() {
        const btn = document.getElementById('shoot-btn');
        if (!btn) return;
        
        this.shootBtn = btn;
        
        const onShoot = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const ripple = document.createElement('div');
            ripple.className = 'ripple';
            btn.appendChild(ripple);
            setTimeout(() => ripple.remove(), 400);
            
            this.shoot();
        };
        
        btn.addEventListener('touchstart', onShoot, { passive: false });
        btn.addEventListener('mousedown', onShoot);
    }
    
    setupInput() {
        // Camera rotation is only via joystick (setupJoystick)
        // No canvas drag/touch camera control
        
        // Spacebar to shoot
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !e.repeat) {
                e.preventDefault();
                this.shoot();
            }
        });
        
        document.getElementById('cta')?.addEventListener('click', () => {
            sdk.install(); // Redirects to store via SDK
        });
        
        window.addEventListener('resize', () => this.resize());
    }
    
    // ============ AUTO-AIM SYSTEM ============
    
    /**
     * Find the nearest animal that's close to where we're looking
     */
    findNearestAnimalInView() {
        const aa = CONFIG.autoAim;
        if (!aa?.enabled) return null;
        
        let nearest = null;
        let nearestScreenDist = aa.screenRadius || 150;
        
        this.animalManager.getAlive().forEach(animal => {
            const worldPos = animal.position.clone();
            worldPos.y += 0.8;
            
            const screenPos = worldPos.clone().project(this.camera);
            
            const screenX = screenPos.x * window.innerWidth / 2;
            const screenY = screenPos.y * window.innerHeight / 2;
            const distFromCenter = Math.sqrt(screenX * screenX + screenY * screenY);
            
            if (screenPos.z < 1 && distFromCenter < nearestScreenDist) {
                nearestScreenDist = distFromCenter;
                nearest = { animal, screenX, screenY, distFromCenter };
            }
        });
        
        return nearest;
    }
    
    /**
     * Apply auto-aim correction - smooth and precise
     */
    applyAutoAim() {
        const aa = CONFIG.autoAim;
        if (!aa?.enabled) return;
        
        // Don't apply when joystick is active (user is aiming)
        if (this.joystick.active) return;
        
        // Don't apply when user is actively controlling
        if (this.state.isUserInputting) return;
        
        const target = this.findNearestAnimalInView();
        if (!target) return;
        
        const deadzone = aa.deadzone || 50;
        const baseStrength = aa.strength || 0.0003;
        const precisionStrength = aa.precisionStrength || 0.0008; // Stronger when close
        
        // Don't correct if already in deadzone
        if (target.distFromCenter < deadzone) return;
        
        // Calculate distance zones
        const distanceFromDeadzone = target.distFromCenter - deadzone;
        const maxDistance = (aa.screenRadius || 200) - deadzone;
        const normalizedDist = Math.min(distanceFromDeadzone / maxDistance, 1);
        
        // Adaptive strength: weak when far, stronger when close (for precision)
        // Use smooth curve: starts slow, accelerates as we get closer
        const distanceFactor = 1 - normalizedDist; // 1 when close, 0 when far
        const adaptiveStrength = baseStrength + (precisionStrength - baseStrength) * (1 - distanceFactor * distanceFactor);
        
        // Smooth easing - cubic ease-out for natural feel
        const eased = 1 - Math.pow(1 - normalizedDist, 3);
        
        // Final strength with smooth easing
        const finalStrength = adaptiveStrength * eased;
        
        // Direction to target
        const dirX = target.screenX / target.distFromCenter;
        const dirY = target.screenY / target.distFromCenter;
        
        // Calculate correction - proportional to distance but capped
        const maxStep = aa.maxStep || 0.001;
        const step = Math.min(finalStrength * distanceFromDeadzone, maxStep);
        
        const correctionY = -dirX * step;
        const correctionX = dirY * step;
        
        // Apply smoothly to both rotations
        this.state.currentRotation.y += correctionY;
        this.state.currentRotation.x += correctionX;
        this.state.targetRotation.y += correctionY;
        this.state.targetRotation.x += correctionX;
        
        // Clamp pitch and yaw
        const minX = CONFIG.pitchLimit.min;
        const maxX = CONFIG.pitchLimit.max;
        const minY = CONFIG.yawLimit.min;
        const maxY = CONFIG.yawLimit.max;
        this.state.targetRotation.x = THREE.MathUtils.clamp(this.state.targetRotation.x, minX, maxX);
        this.state.currentRotation.x = THREE.MathUtils.clamp(this.state.currentRotation.x, minX, maxX);
        this.state.targetRotation.y = THREE.MathUtils.clamp(this.state.targetRotation.y, minY, maxY);
        this.state.currentRotation.y = THREE.MathUtils.clamp(this.state.currentRotation.y, minY, maxY);
    }
    
    // ============ TARGETING ============
    
    checkTargeting() {
        if (this.bulletTime.active) return;
        
        this.raycaster.setFromCamera(this.screenCenter, this.camera);
        
        let closestAnimal = null;
        let closestDistance = Infinity;
        
        this.animalManager.getAlive().forEach(animal => {
            const animalPos = animal.position.clone();
            animalPos.y += 0.8;
            
            const toAnimal = animalPos.clone().sub(this.camera.position);
            const rayDir = this.raycaster.ray.direction;
            const dot = toAnimal.dot(rayDir);
            
            if (dot < 0) return;
            
            const closest = this.camera.position.clone().add(rayDir.clone().multiplyScalar(dot));
            const dist = closest.distanceTo(animalPos);
            const targetRadius = animal.userData.boundingRadius * 2;
            
            if (dist < targetRadius) {
                const actualDist = this.camera.position.distanceTo(animalPos);
                if (actualDist < closestDistance) {
                    closestDistance = actualDist;
                    closestAnimal = animal;
                }
            }
        });
        
        this.state.targetedAnimal = closestAnimal;
        
        const targetInfo = document.getElementById('target-info');
        
        // Update 3D labels
        this.animalManager.hideAllLabels();
        
        if (closestAnimal) {
            // Show 3D label for targeted animal
            this.animalManager.showLabel(closestAnimal);
            
            targetInfo?.classList.add('visible');
            document.getElementById('target-distance').textContent = 
                Math.round(closestDistance) + 'm';
        } else {
            targetInfo?.classList.remove('visible');
        }
    }
    
    // ============ SHOOTING ============
    
    shoot() {
        if (!this.state.canShoot || this.bulletTime.active) return;
        
        // Init audio if needed and play gunshot
        this.initAudio();
        this.audio.playGunshot();
        
        this.state.canShoot = false;
        
        // Check if we have a target
        if (this.state.targetedAnimal) {
            // Hit - start bullet time
            this.animalManager.hideAllLabels(); // Hide labels during bullet time
            this.state.timeScale = this.bulletTime.start(this.state.targetedAnimal);
            this.setBulletTimeUI(true);
            // Camera shake is now triggered inside bulletTime.start()
        } else {
            // Miss - show miss text and camera shake
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
        const shake = CONFIG.cameraShake || { intensity: 0.015, duration: 300 };
        this.state.shakeIntensity = shake.intensity * intensityMultiplier;
        this.state.shakeTime = shake.duration;
    }
    
    updateCameraShake(delta) {
        if (this.state.shakeTime <= 0) return { x: 0, y: 0 };
        
        const shake = CONFIG.cameraShake || { frequency: 25 };
        this.state.shakeTime -= delta * 1000;
        
        // Decay intensity over time
        const progress = Math.max(0, this.state.shakeTime / (CONFIG.cameraShake?.duration || 300));
        const intensity = this.state.shakeIntensity * progress;
        
        // High frequency shake
        const time = Date.now() * shake.frequency * 0.001;
        const shakeX = Math.sin(time * 13.7) * intensity;
        const shakeY = Math.cos(time * 17.3) * intensity;
        
        return { x: shakeX, y: shakeY };
    }
    
    setBulletTimeUI(active) {
        ['scope', 'crosshair', 'joystick-zone', 'target-info'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.toggle('hidden', active);
        });
    }
    
    onBulletHit(animal) {
        if (!animal) return;
        
        animal.userData.alive = false;
        this.state.score += animal.userData.points;
        this.state.kills++;
        
        this.updateScoreUI();
        this.showHitEffect();
        this.showScorePopup(animal.userData.points);
        
        this.animalManager.animateDeath(animal, () => {
            this.animalManager.spawn();
        });
        
        if (this.state.kills >= CONFIG.showCtaAfterKills) {
            setTimeout(() => this.showCTA(), 500);
        }
    }
    
    // ============ UI ============
    
    updateScoreUI() {
        const el = document.getElementById('score');
        if (el) el.textContent = this.state.score;
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
        sdk.finish(); // Mark playable as complete
        
        // Auto redirect after delay
        const delay = CONFIG.autoRedirectDelay || 0;
        if (delay > 0) {
            setTimeout(() => {
                sdk.install(); // Redirects to store via SDK
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
        // Joystick input - DIRECT 1:1 control, no accumulation
        if (this.joystick.active) {
            const sensitivity = CONFIG.joystickSpeed || 0.15;
            
            // Direct mapping: finger position -> camera rotation offset from start
            this.state.targetRotation.y = this.joystick.startRotationY - this.joystick.deltaX * sensitivity;
            this.state.targetRotation.x = this.joystick.startRotationX - this.joystick.deltaY * sensitivity;
            
            // Clamp
            this.state.targetRotation.x = THREE.MathUtils.clamp(
                this.state.targetRotation.x,
                CONFIG.pitchLimit.min,
                CONFIG.pitchLimit.max
            );
            this.state.targetRotation.y = THREE.MathUtils.clamp(
                this.state.targetRotation.y,
                CONFIG.yawLimit.min,
                CONFIG.yawLimit.max
            );
        } else {
            // Auto-aim only when joystick not active
            this.applyAutoAim();
        }
        
        // Apply camera shake
        const shake = this.updateCameraShake(delta);
        
        // Apply rotation directly to camera - instant, no smoothing
        this.camera.rotation.order = 'YXZ';
        this.camera.rotation.y = this.state.targetRotation.y + shake.y;
        this.camera.rotation.x = this.state.targetRotation.x + shake.x;
    }
    
    // ============ GAME LOOP ============
    
    update() {
        const delta = Math.min(this.clock.getDelta(), 0.1);
        
        if (this.bulletTime.active) {
            const finished = this.bulletTime.update(delta);
            if (finished) {
                const hitAnimal = this.bulletTime.end();
                this.onBulletHit(hitAnimal);
                this.state.timeScale = 1;
                this.state.targetedAnimal = null;
                this.setBulletTimeUI(false);
                // Camera shake on return (50% weaker)
                this.startCameraShake(0.5);
                setTimeout(() => { this.state.canShoot = true; }, CONFIG.shootCooldown);
            }
            this.renderer.render(this.scene, this.bulletTime.camera);
        } else {
            // FOV (frame-rate independent)
            const zoomSmoothing = 1 - Math.pow(1 - CONFIG.zoomSpeed, delta * 60);
            this.state.currentFov = THREE.MathUtils.lerp(
                this.state.currentFov,
                this.state.targetFov,
                zoomSmoothing
            );
            this.camera.fov = this.state.currentFov;
            this.camera.updateProjectionMatrix();
            
            this.updateCamera(delta);
            this.checkTargeting();
            this.animalManager.update(delta, this.state.timeScale);
            this.animalManager.updateLabels(); // Update 3D label positions
            
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
