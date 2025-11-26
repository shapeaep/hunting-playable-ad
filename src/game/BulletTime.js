import * as THREE from 'three';
import { CONFIG } from '@/config';

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
        this.targetPos = null;
        this.targetAnimal = null;
        this.startTime = 0;
        this.cameraAngle = 0;
        this.progress = 0;
        
        this.bulletMaterial = new THREE.MeshBasicMaterial({ color: CONFIG.colors.bullet });
    }
    
    createBullet() {
        const bullet = new THREE.Group();
        
        // Body
        const bodyGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.15, 8);
        const body = new THREE.Mesh(bodyGeo, this.bulletMaterial);
        body.rotation.x = Math.PI / 2;
        bullet.add(body);
        
        // Tip
        const tipGeo = new THREE.ConeGeometry(0.02, 0.05, 8);
        const tip = new THREE.Mesh(tipGeo, this.bulletMaterial);
        tip.rotation.x = -Math.PI / 2;
        tip.position.z = 0.1;
        bullet.add(tip);
        
        // Trail
        const trailGeo = new THREE.CylinderGeometry(0.005, 0.015, 0.4, 6);
        const trailMat = new THREE.MeshBasicMaterial({
            color: 0xffffcc,
            transparent: true,
            opacity: 0.6
        });
        const trail = new THREE.Mesh(trailGeo, trailMat);
        trail.rotation.x = Math.PI / 2;
        trail.position.z = -0.25;
        bullet.add(trail);
        
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
        
        // UI
        document.getElementById('bullet-time')?.classList.add('active');
        document.getElementById('slowmo-text')?.classList.add('visible');
        document.getElementById('hint').style.display = 'none';
        
        return CONFIG.bulletTimeSpeed; // Return time scale
    }
    
    update(delta) {
        if (!this.active) return false;
        
        const elapsed = Date.now() - this.startTime;
        this.progress = Math.min(elapsed / CONFIG.bulletTimeDuration, 1);
        const eased = this.easeInOutCubic(this.progress);
        
        // Move bullet
        const startPos = this.mainCamera.position.clone();
        this.bullet.position.lerpVectors(startPos, this.targetPos, eased);
        this.bullet.lookAt(this.targetPos);
        
        // Orbit camera around bullet
        this.cameraAngle += delta * 1.5;
        const bulletPos = this.bullet.position.clone();
        
        const camDist = 3 + (1 - this.progress) * 5;
        const camHeight = 1 + Math.sin(this.progress * Math.PI) * 2;
        
        this.camera.position.set(
            bulletPos.x + Math.cos(this.cameraAngle) * camDist,
            bulletPos.y + camHeight,
            bulletPos.z + Math.sin(this.cameraAngle) * camDist
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

