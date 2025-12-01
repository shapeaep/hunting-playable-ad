import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { CONFIG } from '../config';
import bulletModelSrc from '../assets/bullet.glb';

/**
 * Bullet time effect - slow motion bullet camera
 */
export class BulletTime {
    constructor(scene, mainCamera) {
        this.scene = scene;
        this.mainCamera = mainCamera;
        
        this.camera = new THREE.PerspectiveCamera(
            50,
            window.innerWidth / window.innerHeight,
            0.1,
            500
        );
        
        this.active = false;
        this.bullet = null;
        this.bulletInner = null; // Inner model for spin rotation
        this.targetPos = null;
        this.targetAnimal = null;
        this.startTime = 0;
        this.cameraAngle = 0;
        this.progress = 0;
        this.bulletSpin = 0; // Bullet spin angle
        
        // Camera shake
        this.shakeIntensity = 0;
        this.shakeTime = 0;
        
        // Load bullet model
        this.bulletModel = null;
        this.loadBulletModel();
    }
    
    loadBulletModel() {
        const loader = new GLTFLoader();
        
        // Setup DRACO decoder
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('node_modules/three/examples/jsm/libs/draco/');
        loader.setDRACOLoader(dracoLoader);
        
        loader.load(bulletModelSrc, (gltf) => {
            this.bulletModel = gltf.scene;
            // Scale
            this.bulletModel.scale.set(10, 10, 10);
            // Rotate 180° so it flies forward
            this.bulletModel.rotation.y = Math.PI;
            
            // Keep original materials, just enhance metalness
            this.bulletModel.traverse((child) => {
                if (child.isMesh) {
                    // Keep original material but make it more metallic
                    if (child.material) {
                        child.material.metalness = 0.3;
                        child.material.roughness = 0.5;
                        child.material.needsUpdate = true;
                    }
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            
            console.log('Bullet model loaded:', this.bulletModel);
        }, undefined, (error) => {
            console.error('Error loading bullet model:', error);
        });
    }
    
    createBullet() {
        const bullet = new THREE.Group();
        
        // Inner group for spin rotation (rotates around Z axis)
        const inner = new THREE.Group();
        bullet.add(inner);
        this.bulletInner = inner;
        
        // Use loaded GLB model
        if (this.bulletModel) {
            console.log('Using GLB bullet model');
            const model = this.bulletModel.clone();
            inner.add(model);
        } else {
            console.log('Using fallback bullet (model not loaded yet)');
            // Fallback: simple bullet shape if model not loaded
            const bodyGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.3, 12);
            const bodyMat = new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 0.8 });
            const body = new THREE.Mesh(bodyGeo, bodyMat);
            body.rotation.x = Math.PI / 2;
            inner.add(body);
            
            // Tip
            const tipGeo = new THREE.ConeGeometry(0.05, 0.15, 12);
            const tip = new THREE.Mesh(tipGeo, bodyMat);
            tip.rotation.x = -Math.PI / 2;
            tip.position.z = 0.22;
            inner.add(tip);
        }
        
        return bullet;
    }
    
    start(targetAnimal) {
        const targetPos = targetAnimal.position.clone();
        targetPos.y += 0.8;
        
        this.bullet = this.createBullet();
        this.bullet.position.copy(this.mainCamera.position);
        this.bullet.lookAt(targetPos);
        this.scene.add(this.bullet);
        
        this.active = true;
        this.targetPos = targetPos;
        this.targetAnimal = targetAnimal;
        this.startTime = Date.now();
        this.cameraAngle = 0;
        this.progress = 0;
        this.bulletSpin = 0;
        
        // UI
        document.getElementById('bullet-time')?.classList.add('active');
        document.getElementById('slowmo-text')?.classList.add('visible');
        
        // Trigger initial camera shake
        this.triggerShake(1.0);
        
        return CONFIG.bulletTimeSpeed; // Return time scale
    }
    
    triggerShake(intensityMultiplier = 1.0) {
        const shake = CONFIG.cameraShake || { intensity: 0.015, duration: 300 };
        this.shakeIntensity = shake.intensity * intensityMultiplier;
        this.shakeTime = shake.duration;
    }
    
    getShakeOffset() {
        if (this.shakeTime <= 0) return { x: 0, y: 0, z: 0 };
        
        const shake = CONFIG.cameraShake || { frequency: 25, duration: 300 };
        
        // Decay intensity over time
        const progress = Math.max(0, this.shakeTime / shake.duration);
        const intensity = this.shakeIntensity * progress;
        
        // Strong shake for bullet cam (needs to be visible at distance)
        const bulletCamMultiplier = 20;
        const time = Date.now() * shake.frequency * 0.001;
        return {
            x: Math.sin(time * 13.7) * intensity * bulletCamMultiplier,
            y: Math.cos(time * 17.3) * intensity * bulletCamMultiplier,
            z: Math.sin(time * 11.1) * intensity * bulletCamMultiplier * 0.5
        };
    }
    
    update(delta) {
        if (!this.active) return false;
        
        // Update shake timer
        if (this.shakeTime > 0) {
            this.shakeTime -= delta * 1000;
        }
        
        const elapsed = Date.now() - this.startTime;
        this.progress = Math.min(elapsed / CONFIG.bulletTimeDuration, 1);
        
        // Linear movement for constant speed bullet
        const bulletProgress = this.progress;
        
        // Move bullet at constant speed
        const startPos = this.mainCamera.position.clone();
        this.bullet.position.lerpVectors(startPos, this.targetPos, bulletProgress);
        this.bullet.lookAt(this.targetPos);
        
        // Spin bullet around its flight axis (Z)
        this.bulletSpin += delta * 3; // Fast spin
        if (this.bulletInner) {
            this.bulletInner.rotation.z = this.bulletSpin;
        }
        
        const bulletPos = this.bullet.position.clone();
        
        // Orbit camera around bullet - slower rotation (half speed)
        this.cameraAngle += delta * 1.0;
        
        // Camera distance stays relatively constant
        const camDist = 4;
        const camHeight = 1.5 + Math.sin(this.cameraAngle * 0.5) * 0.5;
        
        // Apply camera shake
        const shake = this.getShakeOffset();
        
        this.camera.position.set(
            bulletPos.x + Math.cos(this.cameraAngle) * camDist + shake.x,
            bulletPos.y + camHeight + shake.y,
            bulletPos.z + Math.sin(this.cameraAngle) * camDist + shake.z
        );
        this.camera.lookAt(bulletPos);
        
        return this.progress >= 1;
    }
    
    end() {
        const hitAnimal = this.targetAnimal?.userData?.alive ? this.targetAnimal : null;
        
        if (this.bullet) {
            this.scene.remove(this.bullet);
            this.bullet = null;
        }
        
        
        this.active = false;
        this.targetAnimal = null;
        
        document.getElementById('bullet-time')?.classList.remove('active');
        document.getElementById('slowmo-text')?.classList.remove('visible');
        
        return hitAnimal;
    }
    
    easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
    
    resize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
    }
}

