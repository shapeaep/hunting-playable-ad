import * as THREE from 'three';
import { CONFIG } from '@/config';
import { World } from './World';
import { AnimalManager } from './Animals';
import { BulletTime } from './BulletTime';

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
            isUserInputting: false
        };
        
        // Joystick
        this.joystick = {
            active: false,
            startX: 0,
            startY: 0,
            deltaX: 0,
            deltaY: 0,
            stick: null,
            maxRadius: 50
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
        
        this.animalManager = new AnimalManager(this.scene);
        for (let i = 0; i < CONFIG.animalCount; i++) {
            this.animalManager.spawn();
        }
        
        this.bulletTime = new BulletTime(this.scene, this.camera);
        
        this.raycaster = new THREE.Raycaster();
        this.screenCenter = new THREE.Vector2(0, 0);
        
        this.setupJoystick();
        this.setupShootButton();
        this.setupInput();
        this.clock = new THREE.Clock();
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
        this.renderer.toneMappingExposure = 1.1;
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
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        
        const sun = new THREE.DirectionalLight(0xfff8e8, 1.4);
        sun.position.set(80, 120, 40);
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
        
        const rim = new THREE.DirectionalLight(0xffe4b5, 0.3);
        rim.position.set(-50, 30, -50);
        this.scene.add(rim);
    }
    
    setupJoystick() {
        const zone = document.getElementById('joystick-zone');
        const stick = document.getElementById('joystick-stick');
        if (!zone || !stick) return;
        
        this.joystick.stick = stick;
        
        const getPos = (e) => {
            const touch = e.touches?.[0] || e;
            return { x: touch.clientX, y: touch.clientY };
        };
        
        const onStart = (e) => {
            e.preventDefault();
            if (this.bulletTime.active) return;
            
            const rect = zone.getBoundingClientRect();
            this.joystick.active = true;
            this.joystick.startX = rect.left + rect.width / 2;
            this.joystick.startY = rect.top + rect.height / 2;
            
            const pos = getPos(e);
            this.updateJoystick(pos.x, pos.y);
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
            this.joystick.active = false;
            this.joystick.deltaX = 0;
            this.joystick.deltaY = 0;
            this.state.isUserInputting = false;
            stick.style.transform = 'translate(-50%, -50%)';
        };
        
        zone.addEventListener('touchstart', onStart, { passive: false });
        zone.addEventListener('mousedown', onStart);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('mousemove', onMove);
        document.addEventListener('touchend', onEnd);
        document.addEventListener('mouseup', onEnd);
    }
    
    updateJoystick(x, y) {
        const { startX, startY, maxRadius, stick } = this.joystick;
        
        let dx = x - startX;
        let dy = y - startY;
        
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > maxRadius) {
            dx = (dx / dist) * maxRadius;
            dy = (dy / dist) * maxRadius;
        }
        
        this.joystick.deltaX = dx / maxRadius;
        this.joystick.deltaY = dy / maxRadius;
        stick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
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
        let isDragging = false;
        let lastX = 0, lastY = 0;
        
        const onPointerDown = (e) => {
            if (this.bulletTime.active) return;
            if (e.target.closest('#joystick-zone') || e.target.closest('#shoot-btn')) return;
            
            isDragging = true;
            const touch = e.touches?.[0] || e;
            lastX = touch.clientX;
            lastY = touch.clientY;
        };
        
        const onPointerMove = (e) => {
            if (!isDragging || this.bulletTime.active) return;
            
            const touch = e.touches?.[0] || e;
            const deltaX = touch.clientX - lastX;
            const deltaY = touch.clientY - lastY;
            
            // Mark as inputting only when actually moving
            if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
                this.state.isUserInputting = true;
            }
            
            this.state.targetRotation.y -= deltaX * CONFIG.sensitivity;
            this.state.targetRotation.x -= deltaY * CONFIG.sensitivity;
            this.state.targetRotation.x = THREE.MathUtils.clamp(
                this.state.targetRotation.x,
                CONFIG.pitchLimit.min,
                CONFIG.pitchLimit.max
            );
            
            lastX = touch.clientX;
            lastY = touch.clientY;
        };
        
        const onPointerUp = () => {
            isDragging = false;
            this.state.isUserInputting = false;
        };
        
        // Canvas events
        this.canvas.addEventListener('touchstart', onPointerDown, { passive: false });
        this.canvas.addEventListener('touchmove', onPointerMove, { passive: false });
        this.canvas.addEventListener('mousedown', onPointerDown);
        this.canvas.addEventListener('mousemove', onPointerMove);
        
        // Global pointer up (catches all releases)
        document.addEventListener('touchend', onPointerUp);
        document.addEventListener('touchcancel', onPointerUp);
        document.addEventListener('mouseup', onPointerUp);
        
        // Spacebar to shoot
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !e.repeat) {
                e.preventDefault();
                this.shoot();
            }
        });
        
        document.getElementById('cta')?.addEventListener('click', () => {
            window.open(CONFIG.ctaUrl, '_blank');
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
     * Apply auto-aim correction - very smooth with large deadzone
     */
    applyAutoAim() {
        const aa = CONFIG.autoAim;
        if (!aa?.enabled) return;
        
        // Don't apply when user is actively controlling
        if (this.state.isUserInputting) return;
        
        const target = this.findNearestAnimalInView();
        if (!target) return;
        
        const deadzone = aa.deadzone || 40;
        const strength = aa.strength || 0.0005;
        
        // Large deadzone - don't correct if close enough
        if (target.distFromCenter < deadzone) return;
        
        // Smooth falloff - correction gets weaker as we approach target
        const distanceFromDeadzone = target.distFromCenter - deadzone;
        const maxDistance = (aa.screenRadius || 200) - deadzone;
        const normalizedDist = Math.min(distanceFromDeadzone / maxDistance, 1);
        
        // Ease-out curve for smoother approach
        const easedStrength = strength * normalizedDist * normalizedDist;
        
        // Direction to target (normalized)
        const dirX = target.screenX / target.distFromCenter;
        const dirY = target.screenY / target.distFromCenter;
        
        // Fixed step toward target
        const step = easedStrength * distanceFromDeadzone;
        
        const correctionY = -dirX * step;
        const correctionX = dirY * step;
        
        // Apply directly to both (keeps them in sync)
        this.state.currentRotation.y += correctionY;
        this.state.currentRotation.x += correctionX;
        this.state.targetRotation.y += correctionY;
        this.state.targetRotation.x += correctionX;
        
        // Clamp pitch
        const minX = CONFIG.pitchLimit.min;
        const maxX = CONFIG.pitchLimit.max;
        this.state.targetRotation.x = THREE.MathUtils.clamp(this.state.targetRotation.x, minX, maxX);
        this.state.currentRotation.x = THREE.MathUtils.clamp(this.state.currentRotation.x, minX, maxX);
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
        const shootBtn = this.shootBtn;
        
        if (closestAnimal) {
            targetInfo?.classList.add('visible');
            document.getElementById('target-name').textContent = 
                closestAnimal.userData.type === 'deer' ? '🦌 Deer' : '🐗 Boar';
            document.getElementById('target-distance').textContent = 
                Math.round(closestDistance) + 'm';
            this.state.targetFov = CONFIG.zoomedFov;
            shootBtn?.classList.remove('disabled');
        } else {
            targetInfo?.classList.remove('visible');
            this.state.targetFov = CONFIG.baseFov;
            shootBtn?.classList.add('disabled');
        }
    }
    
    // ============ SHOOTING ============
    
    shoot() {
        if (!this.state.canShoot || this.bulletTime.active || !this.state.targetedAnimal) return;
        
        this.state.canShoot = false;
        this.state.timeScale = this.bulletTime.start(this.state.targetedAnimal);
        this.setBulletTimeUI(true);
    }
    
    setBulletTimeUI(active) {
        ['scope', 'crosshair', 'joystick-zone', 'shoot-btn', 'target-info'].forEach(id => {
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
    }
    
    resize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.bulletTime.resize();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    // ============ CAMERA UPDATE ============
    
    updateCamera(delta) {
        // Joystick input
        if (this.joystick.active) {
            const speed = CONFIG.joystickSpeed || 2;
            this.state.targetRotation.y -= this.joystick.deltaX * speed * delta;
            this.state.targetRotation.x -= this.joystick.deltaY * speed * delta;
            this.state.targetRotation.x = THREE.MathUtils.clamp(
                this.state.targetRotation.x,
                CONFIG.pitchLimit.min,
                CONFIG.pitchLimit.max
            );
        }
        
        // Auto-aim (only when not inputting)
        this.applyAutoAim();
        
        // Smooth interpolation
        const smoothing = CONFIG.cameraSmoothness || 0.06;
        this.state.currentRotation.x = THREE.MathUtils.lerp(
            this.state.currentRotation.x,
            this.state.targetRotation.x,
            smoothing
        );
        this.state.currentRotation.y = THREE.MathUtils.lerp(
            this.state.currentRotation.y,
            this.state.targetRotation.y,
            smoothing
        );
        
        // Apply
        this.camera.rotation.order = 'YXZ';
        this.camera.rotation.y = this.state.currentRotation.y;
        this.camera.rotation.x = this.state.currentRotation.x;
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
                setTimeout(() => { this.state.canShoot = true; }, CONFIG.shootCooldown);
            }
            this.renderer.render(this.scene, this.bulletTime.camera);
        } else {
            // FOV
            this.state.currentFov = THREE.MathUtils.lerp(
                this.state.currentFov,
                this.state.targetFov,
                CONFIG.zoomSpeed
            );
            this.camera.fov = this.state.currentFov;
            this.camera.updateProjectionMatrix();
            
            this.updateCamera(delta);
            this.checkTargeting();
            this.animalManager.update(delta, this.state.timeScale);
            
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
