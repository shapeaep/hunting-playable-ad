import * as THREE from 'three';
import { CONFIG } from '../config';

// API endpoint for spawn points (built into webpack dev server)
const API_URL = '/api/spawn-points';

/**
 * Debug Editor - Free-fly camera and spawn point placement
 * Features:
 * - Load existing spawn points from config on start
 * - Auto-save spawn points to config.js via dev server
 * - Right-click to delete spawn points
 * - Visual markers for all spawn points
 */
export class DebugEditor {
    constructor(game) {
        this.game = game;
        this.camera = game.camera;
        this.scene = game.scene;
        this.canvas = game.canvas;
        
        this.active = false;
        this.flySpeed = 50;
        this.lookSpeed = 0.002;
        
        // Movement keys state
        this.keys = { w: false, a: false, s: false, d: false, q: false, space: false, shift: false };
        
        // Mouse look
        this.mouseLocked = false;
        
        // Saved game camera state
        this.savedCameraPos = null;
        this.savedCameraRot = null;
        this.savedFov = null;
        
        // Spawn points
        this.spawnPoints = [];
        this.markers = [];
        this.selectedType = 'deer';
        this.currentCoords = { x: 0, z: 0 };
        
        // Raycaster for ground intersection and marker picking
        this.raycaster = new THREE.Raycaster();
        this.screenCenter = new THREE.Vector2(0, 0);
        
        // Auto-save debounce
        this.saveTimeout = null;
        this.lastSaveStatus = '';
        
        this.setupInput();
        
        // Load existing spawn points from config
        this.loadExistingPoints();
    }
    
    async loadExistingPoints() {
        // Определяем dev режим по URL
        const isDev = window.location.hostname === 'localhost' && window.location.port === '8080';
        
        if (isDev) {
            // Development: Load from API
            try {
                const response = await fetch(API_URL);
                const data = await response.json();
                if (data.success && data.points && data.points.length > 0) {
                    this.spawnPoints = data.points.map(p => ({
                        x: p.x,
                        z: p.z,
                        type: p.type
                    }));
                    console.log(`%c📍 Loaded ${this.spawnPoints.length} spawn points from API`, 'color: #2196F3');
                    return;
                }
            } catch (e) {
                // API недоступен - fallback to CONFIG
            }
        }
        
        // Production или fallback: берём из CONFIG (загружены из JSON импорта)
        if (CONFIG.spawnPoints && Array.isArray(CONFIG.spawnPoints) && CONFIG.spawnPoints.length > 0) {
            this.spawnPoints = CONFIG.spawnPoints.map(p => ({
                x: p.x,
                z: p.z,
                type: p.type || 'deer'
            }));
            console.log(`%c📍 Loaded ${this.spawnPoints.length} spawn points from config`, 'color: #2196F3');
        }
    }
    
    setupInput() {
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        document.addEventListener('keyup', (e) => this.onKeyUp(e));
        document.addEventListener('mousemove', (e) => this.onMouseMove(e));
        document.addEventListener('click', (e) => this.onClick(e));
        document.addEventListener('contextmenu', (e) => this.onRightClick(e));
        document.addEventListener('pointerlockchange', () => this.onPointerLockChange());
    }
    
    onKeyDown(e) {
        // Toggle debug mode with E or `
        if ((e.code === 'Backquote' || e.code === 'KeyE') && !e.repeat) {
            e.preventDefault();
            this.toggle();
            return;
        }
        
        if (!this.active) return;
        
        // Movement keys
        if (e.code === 'KeyW') this.keys.w = true;
        if (e.code === 'KeyA') this.keys.a = true;
        if (e.code === 'KeyS') this.keys.s = true;
        if (e.code === 'KeyD') this.keys.d = true;
        if (e.code === 'KeyQ') this.keys.q = true;
        if (e.code === 'Space') { this.keys.space = true; e.preventDefault(); }
        if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.keys.shift = true;
        
        // Spawn editor controls
        if (e.code === 'Digit1') { this.selectedType = 'deer'; this.updateUI(); }
        if (e.code === 'Digit2') { this.selectedType = 'bear'; this.updateUI(); }
        if (e.code === 'Digit3') { this.selectedType = 'rabbit'; this.updateUI(); }
        if (e.code === 'KeyC' && !e.repeat) this.copyToClipboard();
        if (e.code === 'KeyX' && !e.repeat) this.clearPoints();
        if (e.code === 'KeyZ' && !e.repeat) this.undoLastPoint();
    }
    
    onKeyUp(e) {
        if (e.code === 'KeyW') this.keys.w = false;
        if (e.code === 'KeyA') this.keys.a = false;
        if (e.code === 'KeyS') this.keys.s = false;
        if (e.code === 'KeyD') this.keys.d = false;
        if (e.code === 'KeyQ') this.keys.q = false;
        if (e.code === 'Space') this.keys.space = false;
        if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.keys.shift = false;
    }
    
    onMouseMove(e) {
        if (!this.active || !this.mouseLocked) return;
        
        this.camera.rotation.y -= e.movementX * this.lookSpeed;
        this.camera.rotation.x -= e.movementY * this.lookSpeed;
        // Clamp pitch
        this.camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.camera.rotation.x));
    }
    
    onClick(e) {
        if (!this.active) return;
        
        if (!this.mouseLocked) {
            // Lock mouse on first click
            this.canvas.requestPointerLock();
        } else {
            // Place spawn point
            this.placePoint();
        }
    }
    
    onRightClick(e) {
        if (!this.active || !this.mouseLocked) return;
        
        e.preventDefault();
        
        // Delete nearest spawn point to crosshair
        this.deleteNearestPoint();
    }
    
    onPointerLockChange() {
        this.mouseLocked = document.pointerLockElement === this.canvas;
        this.updateUI();
    }
    
    toggle() {
        this.active = !this.active;
        
        if (this.active) {
            this.enter();
        } else {
            this.exit();
        }
    }
    
    enter() {
        // Save current camera state
        this.savedCameraPos = this.camera.position.clone();
        this.savedCameraRot = {
            x: this.camera.rotation.x,
            y: this.camera.rotation.y
        };
        this.savedFov = this.camera.fov;
        this.savedLookAt = this.game.cameraLookAt?.current?.clone();
        
        // Reset FOV to normal (not zoomed)
        this.camera.fov = CONFIG.baseFov;
        this.camera.updateProjectionMatrix();
        
        // Set camera to free look mode
        this.camera.rotation.order = 'YXZ';
        
        // Hide game UI
        this.setGameUIVisible(false);
        
        // Create debug UI
        this.createUI();
        
        // Create markers for existing spawn points
        this.recreateAllMarkers();
        
        console.log('%c🔧 DEBUG MODE ENABLED', 'color: #4CAF50; font-size: 16px; font-weight: bold');
        console.log('Controls: WASD=Move, Space/Q=Up/Down, Shift=Fast, Mouse=Look');
        console.log('Spawn: 1/2/3=Type, LClick=Place, RClick=Delete, Z=Undo, C=Copy, X=Clear, E=Exit');
    }
    
    exit() {
        // Exit pointer lock
        document.exitPointerLock();
        
        // Restore camera position to tower
        this.camera.position.set(0, CONFIG.towerHeight, 0);
        
        // Reset camera rotation (important!)
        this.camera.rotation.set(0, 0, 0);
        this.camera.rotation.order = 'YXZ';
        
        // Restore FOV
        this.camera.fov = CONFIG.baseFov;
        this.game.state.currentFov = CONFIG.baseFov;
        this.game.state.targetFov = CONFIG.baseFov;
        this.camera.updateProjectionMatrix();
        
        // Restore lookAt - if we have an animal, look at it
        if (this.game.currentAnimal && this.game.currentAnimal.userData.alive) {
            const lookAt = this.game.getAnimalLookAtPosition(this.game.currentAnimal);
            this.game.cameraLookAt.current.copy(lookAt);
            this.game.cameraLookAt.target.copy(lookAt);
        } else if (this.savedLookAt && this.game.cameraLookAt) {
            this.game.cameraLookAt.current.copy(this.savedLookAt);
            this.game.cameraLookAt.target.copy(this.savedLookAt);
        }
        
        // Show game UI
        this.setGameUIVisible(true);
        
        // Remove debug UI
        this.removeUI();
        
        // Hide markers (but keep data)
        this.hideAllMarkers();
        
        console.log('%c🔧 DEBUG MODE DISABLED', 'color: #f44336; font-size: 16px');
        console.log('%c💡 Refresh page (F5) to see animals at new spawn points', 'color: #FF9800');
    }
    
    setGameUIVisible(visible) {
        const elements = ['scope', 'crosshair', 'joystick-zone', 'kills-panel', 'tap-hint', 'release-hint'];
        elements.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = visible ? '' : 'none';
        });
    }
    
    update(delta) {
        if (!this.active) return;
        
        const speed = this.flySpeed * (this.keys.shift ? 3 : 1) * delta;
        
        // Get camera direction vectors
        const forward = new THREE.Vector3();
        this.camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();
        
        const right = new THREE.Vector3();
        right.crossVectors(forward, new THREE.Vector3(0, 1, 0));
        
        // Apply movement
        if (this.keys.w) this.camera.position.addScaledVector(forward, speed);
        if (this.keys.s) this.camera.position.addScaledVector(forward, -speed);
        if (this.keys.d) this.camera.position.addScaledVector(right, speed);
        if (this.keys.a) this.camera.position.addScaledVector(right, -speed);
        if (this.keys.space) this.camera.position.y += speed;
        if (this.keys.q) this.camera.position.y -= speed;
        
        // Update crosshair target position
        this.updateCrosshairTarget();
        
        // Update UI
        this.updateUI();
    }
    
    updateCrosshairTarget() {
        this.raycaster.setFromCamera(this.screenCenter, this.camera);
        
        const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const intersection = new THREE.Vector3();
        this.raycaster.ray.intersectPlane(groundPlane, intersection);
        
        if (intersection) {
            this.currentCoords = {
                x: parseFloat(intersection.x.toFixed(1)),
                z: parseFloat(intersection.z.toFixed(1))
            };
        }
    }
    
    placePoint() {
        const point = {
            x: this.currentCoords.x,
            z: this.currentCoords.z,
            type: this.selectedType
        };
        
        this.spawnPoints.push(point);
        this.createMarker(point, this.spawnPoints.length - 1);
        this.updateUI();
        this.scheduleSave();
        
        console.log(`%c+ Added ${point.type.toUpperCase()} at (${point.x}, ${point.z})`, 'color: #4CAF50');
    }
    
    deleteNearestPoint() {
        if (this.spawnPoints.length === 0) return;
        
        // Find the nearest point to current crosshair position
        let nearestIdx = -1;
        let nearestDist = Infinity;
        
        for (let i = 0; i < this.spawnPoints.length; i++) {
            const p = this.spawnPoints[i];
            const dist = Math.sqrt(
                Math.pow(p.x - this.currentCoords.x, 2) + 
                Math.pow(p.z - this.currentCoords.z, 2)
            );
            if (dist < nearestDist) {
                nearestDist = dist;
                nearestIdx = i;
            }
        }
        
        // Only delete if within reasonable distance (10 units)
        if (nearestIdx >= 0 && nearestDist < 10) {
            const deleted = this.spawnPoints.splice(nearestIdx, 1)[0];
            this.recreateAllMarkers();
            this.updateUI();
            this.scheduleSave();
            
            console.log(`%c- Removed ${deleted.type.toUpperCase()} at (${deleted.x}, ${deleted.z})`, 'color: #f44336');
        }
    }
    
    undoLastPoint() {
        if (this.spawnPoints.length === 0) {
            console.log('%c⚠ No points to undo', 'color: #FF9800');
            return;
        }
        
        const removed = this.spawnPoints.pop();
        this.recreateAllMarkers();
        this.updateUI();
        this.scheduleSave();
        
        console.log(`%c↩ Undid ${removed.type.toUpperCase()} at (${removed.x}, ${removed.z})`, 'color: #FF9800');
    }
    
    createMarker(point, index) {
        const colors = {
            deer: 0xFFD700,
            bear: 0x9C27B0,
            rabbit: 0x9E9E9E
        };
        
        const marker = new THREE.Group();
        marker.userData.spawnIndex = index;
        
        // Pole
        const poleGeo = new THREE.CylinderGeometry(0.1, 0.1, 3, 8);
        const poleMat = new THREE.MeshBasicMaterial({ color: colors[point.type] || 0xffffff });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.y = 1.5;
        marker.add(pole);
        
        // Sphere on top
        const sphereGeo = new THREE.SphereGeometry(0.4, 8, 8);
        const sphereMat = new THREE.MeshBasicMaterial({ color: colors[point.type] || 0xffffff });
        const sphere = new THREE.Mesh(sphereGeo, sphereMat);
        sphere.position.y = 3.2;
        marker.add(sphere);
        
        // Number label (index + 1)
        // Using a simple ring to indicate index (visual distinction)
        const ringGeo = new THREE.RingGeometry(0.5, 0.6, 16);
        const ringMat = new THREE.MeshBasicMaterial({ 
            color: 0xffffff, 
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.7
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.y = 0.1;
        ring.rotation.x = -Math.PI / 2;
        marker.add(ring);
        
        // Position marker
        const y = this.game.world ? this.game.world.getTerrainHeight(point.x, point.z) : 0;
        marker.position.set(point.x, y, point.z);
        
        this.scene.add(marker);
        this.markers.push(marker);
    }
    
    recreateAllMarkers() {
        // Remove all existing markers
        this.markers.forEach(marker => this.scene.remove(marker));
        this.markers = [];
        
        // Create markers for all spawn points
        this.spawnPoints.forEach((point, index) => {
            this.createMarker(point, index);
        });
    }
    
    hideAllMarkers() {
        this.markers.forEach(marker => this.scene.remove(marker));
        this.markers = [];
    }
    
    clearPoints() {
        if (this.spawnPoints.length === 0) {
            console.log('%c⚠ No points to clear', 'color: #FF9800');
            return;
        }
        
        this.markers.forEach(marker => this.scene.remove(marker));
        this.markers = [];
        this.spawnPoints = [];
        this.updateUI();
        this.scheduleSave();
        
        console.log('%c✖ Cleared all spawn points', 'color: #f44336');
    }
    
    // Auto-save with debounce
    scheduleSave() {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        
        this.lastSaveStatus = 'saving...';
        this.updateSaveStatus();
        
        this.saveTimeout = setTimeout(() => {
            this.saveToServer();
        }, 500); // 500ms debounce
    }
    
    async saveToServer() {
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ points: this.spawnPoints })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Обновляем CONFIG напрямую в рантайме
                CONFIG.spawnPoints = [...this.spawnPoints];
                this.lastSaveStatus = '✓ saved';
                console.log(`%c💾 Auto-saved ${this.spawnPoints.length} points to config.js`, 'color: #4CAF50');
            } else {
                this.lastSaveStatus = '✗ error';
                console.error('Failed to save:', data.error);
            }
        } catch (error) {
            // Даже без сервера обновляем CONFIG в рантайме
            CONFIG.spawnPoints = [...this.spawnPoints];
            this.lastSaveStatus = '✗ offline (runtime only)';
            console.warn('Dev server not running - changes applied to runtime only');
        }
        
        this.updateSaveStatus();
    }
    
    updateSaveStatus() {
        const statusEl = document.getElementById('debug-save-status');
        if (statusEl) {
            statusEl.textContent = this.lastSaveStatus;
            statusEl.className = 'debug-save-status';
            if (this.lastSaveStatus.includes('✓')) {
                statusEl.classList.add('saved');
            } else if (this.lastSaveStatus.includes('✗')) {
                statusEl.classList.add('error');
            }
        }
    }
    
    copyToClipboard() {
        if (this.spawnPoints.length === 0) {
            console.log('%c⚠ No spawn points to copy', 'color: #FF9800');
            return;
        }
        
        const code = `spawnPoints: [\n${this.spawnPoints.map(p => 
            `        { x: ${p.x}, z: ${p.z}, type: '${p.type}' }`
        ).join(',\n')}\n    ]`;
        
        navigator.clipboard.writeText(code).then(() => {
            console.log('%c📋 Copied to clipboard!', 'color: #4CAF50; font-size: 14px');
            console.log(code);
        }).catch(() => {
            console.log('%c📋 Config code:', 'color: #2196F3; font-size: 14px');
            console.log(code);
        });
    }
    
    createUI() {
        const overlay = document.createElement('div');
        overlay.id = 'debug-editor-ui';
        overlay.innerHTML = `
            <div class="debug-panel">
                <div class="debug-title">🔧 DEBUG MODE</div>
                <div class="debug-section">
                    <div class="debug-label">Camera (Player) Position</div>
                    <div class="debug-coords">
                        X: <b id="debug-cam-x">0</b>
                        Y: <b id="debug-cam-y">0</b>
                        Z: <b id="debug-cam-z">0</b>
                    </div>
                </div>
                <div class="debug-section">
                    <div class="debug-label">Current Animal</div>
                    <div class="debug-coords" id="debug-animal-info">
                        No animal
                    </div>
                </div>
                <div class="debug-section">
                    <div class="debug-label">Ground Target (Click to place)</div>
                    <div class="debug-coords">
                        X: <b id="debug-target-x">0</b>
                        Z: <b id="debug-target-z">0</b>
                    </div>
                </div>
                <div class="debug-section">
                    <div class="debug-label">Spawn Type</div>
                    <div class="debug-type">
                        <span id="debug-type-display">DEER</span>
                        <span class="debug-hint">(1/2/3)</span>
                    </div>
                </div>
                <div class="debug-section">
                    <div class="debug-keys">
                        <span class="key">WASD</span> Move
                        <span class="key">Space</span> Up
                        <span class="key">Q</span> Down
                        <span class="key">Shift</span> Fast
                    </div>
                    <div class="debug-keys">
                        <span class="key">LClick</span> Place
                        <span class="key">RClick</span> Delete
                        <span class="key">Z</span> Undo
                    </div>
                    <div class="debug-keys">
                        <span class="key">C</span> Copy
                        <span class="key">X</span> Clear All
                        <span class="key">E</span> Exit
                    </div>
                </div>
                <div class="debug-status" id="debug-mouse-status">
                    🖱️ Click to enable mouse look
                </div>
                <div class="debug-count">
                    Points: <b id="debug-point-count">0</b>
                    <span id="debug-save-status" class="debug-save-status"></span>
                </div>
            </div>
            <div class="debug-crosshair">+</div>
        `;
        document.body.appendChild(overlay);
        
        const style = document.createElement('style');
        style.id = 'debug-editor-styles';
        style.textContent = `
            #debug-editor-ui {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 10000;
                pointer-events: none;
            }
            .debug-panel {
                position: absolute;
                top: 10px;
                left: 10px;
                background: rgba(0, 0, 0, 0.9);
                color: #fff;
                padding: 15px;
                border-radius: 10px;
                font-family: 'Consolas', 'Monaco', monospace;
                font-size: 13px;
                border: 2px solid #4CAF50;
                min-width: 280px;
            }
            .debug-title {
                font-size: 18px;
                font-weight: bold;
                color: #4CAF50;
                margin-bottom: 12px;
                padding-bottom: 8px;
                border-bottom: 1px solid #333;
            }
            .debug-section {
                margin-bottom: 10px;
            }
            .debug-label {
                color: #888;
                font-size: 10px;
                text-transform: uppercase;
                margin-bottom: 3px;
            }
            .debug-coords {
                font-size: 13px;
            }
            .debug-coords b {
                color: #FFC107;
                min-width: 45px;
                display: inline-block;
            }
            .debug-type span:first-child {
                color: #2196F3;
                font-weight: bold;
                font-size: 15px;
            }
            .debug-hint {
                color: #666;
                font-size: 11px;
                margin-left: 8px;
            }
            .debug-keys {
                margin-bottom: 4px;
                color: #aaa;
                font-size: 11px;
            }
            .debug-keys .key {
                background: #333;
                padding: 2px 5px;
                border-radius: 3px;
                color: #fff;
                margin-right: 2px;
                font-size: 10px;
            }
            .debug-status {
                color: #FF9800;
                font-size: 12px;
                margin: 10px 0;
                padding: 5px;
                background: rgba(255,152,0,0.1);
                border-radius: 4px;
            }
            .debug-status.active {
                color: #4CAF50;
                background: rgba(76,175,80,0.1);
            }
            .debug-count {
                color: #aaa;
                font-size: 12px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .debug-count b {
                color: #4CAF50;
            }
            .debug-save-status {
                font-size: 11px;
                color: #888;
            }
            .debug-save-status.saved {
                color: #4CAF50;
            }
            .debug-save-status.error {
                color: #f44336;
            }
            .debug-crosshair {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: #4CAF50;
                font-size: 32px;
                font-weight: bold;
                text-shadow: 0 0 5px #000, 0 0 10px #000;
            }
        `;
        document.head.appendChild(style);
        
        // Update initial values
        this.updateUI();
    }
    
    removeUI() {
        document.getElementById('debug-editor-ui')?.remove();
        document.getElementById('debug-editor-styles')?.remove();
    }
    
    updateUI() {
        if (!this.active) return;
        
        // Camera position
        const camX = document.getElementById('debug-cam-x');
        const camY = document.getElementById('debug-cam-y');
        const camZ = document.getElementById('debug-cam-z');
        if (camX) camX.textContent = this.camera.position.x.toFixed(1);
        if (camY) camY.textContent = this.camera.position.y.toFixed(1);
        if (camZ) camZ.textContent = this.camera.position.z.toFixed(1);
        
        // Current animal info
        const animalInfo = document.getElementById('debug-animal-info');
        if (animalInfo) {
            const animal = this.game.currentAnimal;
            if (animal && animal.userData.alive) {
                const type = animal.userData.type?.toUpperCase() || 'UNKNOWN';
                const x = animal.position.x.toFixed(1);
                const z = animal.position.z.toFixed(1);
                animalInfo.innerHTML = `<b style="color:#2196F3">${type}</b> at X: <b>${x}</b> Z: <b>${z}</b>`;
            } else {
                animalInfo.textContent = 'No animal';
            }
        }
        
        // Target coords
        const targetX = document.getElementById('debug-target-x');
        const targetZ = document.getElementById('debug-target-z');
        if (targetX) targetX.textContent = this.currentCoords.x.toFixed(1);
        if (targetZ) targetZ.textContent = this.currentCoords.z.toFixed(1);
        
        // Type
        const typeDisplay = document.getElementById('debug-type-display');
        if (typeDisplay) typeDisplay.textContent = this.selectedType.toUpperCase();
        
        // Point count
        const countDisplay = document.getElementById('debug-point-count');
        if (countDisplay) countDisplay.textContent = this.spawnPoints.length;
        
        // Mouse status
        const mouseStatus = document.getElementById('debug-mouse-status');
        if (mouseStatus) {
            if (this.mouseLocked) {
                mouseStatus.textContent = '🖱️ Mouse look ACTIVE (ESC to unlock)';
                mouseStatus.classList.add('active');
            } else {
                mouseStatus.textContent = '🖱️ Click to enable mouse look';
                mouseStatus.classList.remove('active');
            }
        }
    }
}
