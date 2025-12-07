import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import rifleModelSrc from '../assets/rifle.glb';
import { createDracoLoader } from '../utils/dracoLoader';

/**
 * First-person rifle with animations
 */
export class Rifle {
    constructor(camera, scene) {
        this.camera = camera;
        this.scene = scene;
        this.model = null;
        this.mixer = null;
        this.actions = {};
        this.currentAction = null;
        this.isScoped = false;
        
        // Offset относительно камеры (настрой эти значения)
        this.offset = new THREE.Vector3(0.03, -0.03, -0.4);
        this.scale = 1;
        this.rotationY = -0.115;
        
        this.loadModel();
    }
    
    loadModel() {
        const loader = new GLTFLoader();
        loader.setDRACOLoader(createDracoLoader());
        
        loader.load(rifleModelSrc, (gltf) => {
            this.model = gltf.scene;
            
            // Scale
            this.model.scale.setScalar(this.scale);
            
            // Добавляем в scene
            this.scene.add(this.model);
            
            // Setup animations
            if (gltf.animations && gltf.animations.length > 0) {
                this.mixer = new THREE.AnimationMixer(this.model);
                
                gltf.animations.forEach(clip => {
                    const action = this.mixer.clipAction(clip);
                    this.actions[clip.name] = action;
                    
                    // Все анимации останавливаем и сбрасываем weight
                    action.setEffectiveWeight(0);
                    action.play();
                    
                    console.log(`🔫 Animation: ${clip.name}, duration: ${clip.duration.toFixed(2)}s`);
                });
                
                // Один глобальный listener для finished
                this.mixer.addEventListener('finished', this.onAnimationFinished.bind(this));
                
                // Запускаем Idle
                this.playIdle();
            }
            
            console.log('🔫 Rifle ready');
        }, undefined, (error) => {
            console.error('Error loading rifle:', error);
        });
    }
    
    onAnimationFinished(e) {
        const actionName = Object.keys(this.actions).find(
            name => this.actions[name] === e.action
        );
        
        console.log(`🔫 Animation finished: ${actionName}`);
        
        // После Reload плавно возвращаемся к Idle
        if (actionName === 'Reload' && !this.isScoped) {
            this.playIdleSmooth();
        }
        
        // После ScopeInOut в обратном направлении - к Idle
        if (actionName === 'ScopeInOut.001' && e.action.timeScale < 0) {
            this.playIdleSmooth();
        }
    }
    
    /**
     * Crossfade to new action
     */
    fadeToAction(name, duration = 0.2) {
        const newAction = this.actions[name];
        if (!newAction) return null;
        
        if (this.currentAction === newAction) return newAction;
        
        // Crossfade
        if (this.currentAction) {
            this.currentAction.crossFadeTo(newAction, duration, true);
        }
        
        newAction.setEffectiveWeight(1);
        this.currentAction = newAction;
        
        return newAction;
    }
    
    /**
     * Idle - loop (мгновенно)
     */
    playIdle() {
        const action = this.actions['Idle'];
        if (!action) return;
        
        if (this.currentAction && this.currentAction !== action) {
            this.currentAction.stop();
        }
        
        action.reset();
        action.setLoop(THREE.LoopRepeat);
        action.setEffectiveTimeScale(1);
        action.setEffectiveWeight(1);
        action.play();
        
        this.currentAction = action;
    }
    
    /**
     * Idle - loop (плавный переход)
     */
    playIdleSmooth() {
        const action = this.fadeToAction('Idle', 0.15);
        if (!action) return;
        
        action.setLoop(THREE.LoopRepeat);
        action.setEffectiveTimeScale(1);
        action.reset();
        action.play();
    }
    
    /**
     * Reload - one shot, then back to Idle
     */
    playReload() {
        const action = this.actions['Reload'];
        if (!action) return;
        
        // Останавливаем текущую анимацию мгновенно
        if (this.currentAction && this.currentAction !== action) {
            this.currentAction.stop();
        }
        
        this.isScoped = false; // Выходим из прицела
        
        action.reset();
        action.setLoop(THREE.LoopOnce);
        action.setEffectiveTimeScale(1);
        action.setEffectiveWeight(1);
        action.clampWhenFinished = true;
        action.play();
        
        this.currentAction = action;
    }
    
    /**
     * ScopeIn - play forward, hold at end
     */
    playScopeIn() {
        this.isScoped = true;
        
        const action = this.actions['ScopeInOut.001'];
        if (!action) return;
        
        // Мгновенно останавливаем текущую
        if (this.currentAction && this.currentAction !== action) {
            this.currentAction.stop();
        }
        
        action.reset();
        action.setLoop(THREE.LoopOnce);
        action.setEffectiveTimeScale(1);
        action.setEffectiveWeight(1);
        action.clampWhenFinished = true;
        action.play();
        
        this.currentAction = action;
    }
    
    /**
     * ScopeOut - play backward from current position
     */
    playScopeOut() {
        this.isScoped = false;
        
        const action = this.actions['ScopeInOut.001'];
        if (!action) return;
        
        // Играем в обратном направлении с текущей позиции
        action.paused = false;
        action.setLoop(THREE.LoopOnce);
        action.setEffectiveTimeScale(-1);
        action.clampWhenFinished = true;
        action.play();
    }
    
    update(delta) {
        if (this.mixer) {
            this.mixer.update(delta);
        }
        
        // Follow camera
        if (this.model && this.camera) {
            const cameraPos = this.camera.position.clone();
            const cameraDir = new THREE.Vector3();
            this.camera.getWorldDirection(cameraDir);
            
            const up = new THREE.Vector3(0, 1, 0);
            const right = new THREE.Vector3().crossVectors(cameraDir, up).normalize();
            const cameraUp = new THREE.Vector3().crossVectors(right, cameraDir).normalize();
            
            const pos = cameraPos.clone();
            pos.add(right.multiplyScalar(this.offset.x));
            pos.add(cameraUp.multiplyScalar(this.offset.y));
            pos.add(cameraDir.multiplyScalar(-this.offset.z));
            
            this.model.position.copy(pos);
            this.model.rotation.copy(this.camera.rotation);
            this.model.rotation.y += this.rotationY;
        }
    }
    
    setVisible(visible) {
        if (this.model) {
            this.model.visible = visible;
        }
    }
}
