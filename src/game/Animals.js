import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { CONFIG } from '../config';
import deerModelSrc from '../assets/deer.glb';
import bearModelSrc from '../assets/bear.glb';
import { createDracoLoader } from '../utils/dracoLoader';

/**
 * Animal factory and management
 */
export class AnimalManager {
    constructor(scene, world = null) {
        this.scene = scene;
        this.world = world;
        this.animals = [];
        this.materials = this.createMaterials();
        this.labelTextures = new Map(); // Cache for label textures
        
        // Deer model from GLB
        this.deerModel = null;
        this.deerAnimations = null;
        
        // Bear model from GLB
        this.bearModel = null;
        this.bearAnimations = null;
        
        this.mixers = []; // Animation mixers for all animated animals
        this.loadDeerModel();
        this.loadBearModel();
    }
    
    loadDeerModel() {
        const loader = new GLTFLoader();
        loader.setDRACOLoader(createDracoLoader());
        
        loader.load(deerModelSrc, (gltf) => {
            this.deerModel = gltf.scene;
            this.deerAnimations = gltf.animations;
            
            // Setup materials for the deer model
            this.deerModel.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            
            console.log('Deer model loaded with animations:', this.deerAnimations.map(a => a.name));
            
            // Replace all existing procedural deer with GLB models
            this.upgradeExistingDeer();
        }, undefined, (error) => {
            console.error('Error loading deer model:', error);
        });
    }
    
    loadBearModel() {
        const loader = new GLTFLoader();
        loader.setDRACOLoader(createDracoLoader());
        
        loader.load(bearModelSrc, (gltf) => {
            this.bearModel = gltf.scene;
            this.bearAnimations = gltf.animations;
            
            // Setup materials for the bear model
            this.bearModel.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            
            console.log('Bear model loaded with animations:', this.bearAnimations.map(a => a.name));
            
            // Replace all existing procedural bears with GLB bear models
            this.upgradeExistingBear();
        }, undefined, (error) => {
            console.error('Error loading bear model:', error);
        });
    }
    
    /**
     * Replace existing procedural deer with loaded GLB models
     */
    upgradeExistingDeer() {
        this.animals.forEach(animal => {
            if (animal.userData.type === 'deer' && !animal.userData.mixer) {
                // Save current state
                const position = animal.position.clone();
                const rotationY = animal.rotation.y;
                const userData = { ...animal.userData };
                
                // Remove old children (procedural geometry)
                while (animal.children.length > 0) {
                    const child = animal.children[0];
                    animal.remove(child);
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(m => m.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                }
                
                // Add GLB model (use SkeletonUtils.clone for animated models)
                const model = SkeletonUtils.clone(this.deerModel);
                model.scale.set(1.85, 1.85, 1.85);
                model.rotation.y = Math.PI / 2;
                animal.add(model);
                
                // Setup animation mixer
                const mixer = new THREE.AnimationMixer(model);
                animal.userData.mixer = mixer;
                
                // Find and play the Walk animation
                const walkAnim = this.deerAnimations.find(a => a.name.toLowerCase().includes('walk'));
                if (walkAnim) {
                    const action = mixer.clipAction(walkAnim);
                    action.play();
                    animal.userData.walkAction = action;
                }
                
                this.mixers.push(mixer);
                
                // Restore position and rotation
                animal.position.copy(position);
                animal.rotation.y = rotationY;
                
                console.log('Upgraded deer to GLB model');
            }
        });
    }
    
    /**
     * Replace existing procedural bears with loaded GLB bear models
     */
    upgradeExistingBear() {
        this.animals.forEach(animal => {
            if (animal.userData.type === 'bear' && !animal.userData.mixer) {
                // Save current state
                const position = animal.position.clone();
                const rotationY = animal.rotation.y;
                const userData = { ...animal.userData };
                
                // Remove old children (procedural geometry)
                while (animal.children.length > 0) {
                    const child = animal.children[0];
                    animal.remove(child);
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(m => m.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                }
                
                // Add GLB model (use SkeletonUtils.clone for animated models)
                const model = SkeletonUtils.clone(this.bearModel);
                model.scale.set(2, 2, 2);
                model.rotation.y = Math.PI / 2;
                animal.add(model);
                
                // Setup animation mixer
                const mixer = new THREE.AnimationMixer(model);
                animal.userData.mixer = mixer;
                
                // Find and play the Walk animation
                const walkAnim = this.bearAnimations.find(a => a.name.toLowerCase().includes('walk'));
                if (walkAnim) {
                    const action = mixer.clipAction(walkAnim);
                    action.play();
                    animal.userData.walkAction = action;
                }
                
                this.mixers.push(mixer);
                
                // Restore position and rotation
                animal.position.copy(position);
                animal.rotation.y = rotationY;
                
                console.log('Upgraded bear to GLB model');
            }
        });
    }
    
    /**
     * Create 3D label for animal with name and price
     */
    createLabel(type, points) {
        const names = { deer: 'DEER', bear: 'BEAR', rabbit: 'HARE' };
        const name = names[type] || type.toUpperCase();
        
        // Level and color scheme per animal type
        // Deer: Level 3, Gold | Bear: Level 2, Purple | Rabbit: Level 1, Gray
        const levelConfig = {
            deer: { level: 3, circleColor: '#ffd700', nameGradient: ['#ffd700', '#c5a000'], priceGradient: ['#b8860b', '#8b6914'], textColor: '#5a4a00', circleTextColor: '#5a4a00' },
            bear: { level: 2, circleColor: '#9b59b6', nameGradient: ['#9b59b6', '#7d3c98'], priceGradient: ['#6c3483', '#512e5f'], textColor: '#ffffff', circleTextColor: '#ffffff' },
            rabbit: { level: 1, circleColor: '#e0e0e0', nameGradient: ['#f5f5f5', '#d0d0d0'], priceGradient: ['#4a4a4a', '#2a2a2a'], textColor: '#333333', circleTextColor: '#333333' }
        };
        const config = levelConfig[type] || levelConfig.rabbit;
        
        // Create canvas for label texture
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        
        // Clear
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // === Level circle (left side) ===
        const circleX = 90;
        const circleY = 128;
        const circleRadius = 55;
        
        // Circle shadow
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.4)';
        ctx.shadowBlur = 15;
        ctx.shadowOffsetY = 8;
        
        // Circle with color based on type
        ctx.beginPath();
        ctx.arc(circleX, circleY, circleRadius, 0, Math.PI * 2);
        ctx.fillStyle = config.circleColor;
        ctx.fill();
        ctx.restore();
        
        // "LEVEL" text
        ctx.fillStyle = config.circleTextColor;
        ctx.font = 'bold 18px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('LEVEL', circleX, circleY - 18);
        
        // Level number
        ctx.fillStyle = config.circleTextColor;
        ctx.font = 'bold 42px Arial, sans-serif';
        ctx.fillText(config.level.toString(), circleX, circleY + 15);
        
        // === Name plate (top right) ===
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 5;
        
        // Skewed rectangle for name
        ctx.beginPath();
        const nameX = 160;
        const nameY = 70;
        const nameW = 280;
        const nameH = 55;
        const skew = 15;
        ctx.moveTo(nameX + skew, nameY);
        ctx.lineTo(nameX + nameW, nameY);
        ctx.lineTo(nameX + nameW - skew, nameY + nameH);
        ctx.lineTo(nameX, nameY + nameH);
        ctx.closePath();
        
        // Gradient for name plate (color based on type)
        const nameGrad = ctx.createLinearGradient(nameX, nameY, nameX, nameY + nameH);
        nameGrad.addColorStop(0, config.nameGradient[0]);
        nameGrad.addColorStop(1, config.nameGradient[1]);
        ctx.fillStyle = nameGrad;
        ctx.fill();
        ctx.restore();
        
        // Name text
        ctx.fillStyle = config.textColor;
        ctx.font = 'bold 32px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(name, nameX + nameW / 2, nameY + nameH / 2 + 4);
        
        // === Price plate (bottom right) ===
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 5;
        
        // Skewed rectangle for price
        ctx.beginPath();
        const priceX = 175;
        const priceY = 135;
        const priceW = 265;
        const priceH = 55;
        ctx.moveTo(priceX + skew, priceY);
        ctx.lineTo(priceX + priceW, priceY);
        ctx.lineTo(priceX + priceW - skew, priceY + priceH);
        ctx.lineTo(priceX, priceY + priceH);
        ctx.closePath();
        
        // Gradient for price plate (color based on type)
        const priceGrad = ctx.createLinearGradient(priceX, priceY, priceX, priceY + priceH);
        priceGrad.addColorStop(0, config.priceGradient[0]);
        priceGrad.addColorStop(1, config.priceGradient[1]);
        ctx.fillStyle = priceGrad;
        ctx.fill();
        ctx.restore();
        
        // Price text
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 34px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('$' + points, priceX + priceW / 2, priceY + priceH / 2 + 4);
        
        // Create texture from canvas
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        
        // Create sprite material (unlit - no lighting/fog affects it)
        const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false,
            depthWrite: false,
            fog: false,           // Disable fog
            toneMapped: false     // Disable tone mapping
        });
        
        // Create sprite
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(4, 2, 1); // Adjust size
        sprite.visible = false; // Hidden by default
        sprite.renderOrder = 999; // Render on top
        
        return sprite;
    }
    
    /**
     * Show label for specific animal
     */
    showLabel(animal) {
        if (animal.userData.label) {
            animal.userData.label.visible = true;
        }
    }
    
    /**
     * Hide label for specific animal
     */
    hideLabel(animal) {
        if (animal.userData.label) {
            animal.userData.label.visible = false;
        }
    }
    
    /**
     * Hide all labels
     */
    hideAllLabels() {
        this.animals.forEach(animal => {
            if (animal.userData.label) {
                animal.userData.label.visible = false;
            }
        });
    }
    
    /**
     * Update labels to follow animals
     */
    updateLabels() {
        this.animals.forEach(animal => {
            if (!animal.userData.alive || !animal.userData.label) return;
            
            const label = animal.userData.label;
            // Position label above animal's head
            const heightOffset = animal.userData.type === 'rabbit' ? 1.5 : 
                                 animal.userData.type === 'bear' ? 3 : 2.8;
            label.position.copy(animal.position);
            label.position.y += heightOffset;
        });
    }
    
    /**
     * Get terrain height at position, fallback to 0 if no world
     */
    getHeight(x, z) {
        return this.world ? this.world.getTerrainHeight(x, z) : 0;
    }
    
    /**
     * Check if position is within camera's visible area
     */
    isInCameraArea(x, z) {
        const yawLimit = CONFIG.yawLimit || { min: -1.4, max: 1.4 };
        // Calculate angle from camera (which looks along -Z initially)
        const angle = Math.atan2(x, -z);
        return angle >= yawLimit.min && angle <= yawLimit.max;
    }
    
    /**
     * Get random angle within camera's yaw limits
     */
    getSpawnAngle() {
        const yawLimit = CONFIG.yawLimit || { min: -1.4, max: 1.4 };
        // Random angle within yaw limits
        // Camera yaw directly maps to world angle for spawning
        return yawLimit.min + Math.random() * (yawLimit.max - yawLimit.min);
    }
    
    createMaterials() {
        const { colors } = CONFIG;
        return {
            deer: new THREE.MeshLambertMaterial({ color: colors.animals.deer.main }),
            deerLight: new THREE.MeshLambertMaterial({ color: colors.animals.deer.light }),
            antler: new THREE.MeshLambertMaterial({ color: colors.animals.deer.antler }),
            bear: new THREE.MeshLambertMaterial({ color: colors.animals.bear.main }),
            bearDark: new THREE.MeshLambertMaterial({ color: colors.animals.bear.dark }),
            snout: new THREE.MeshLambertMaterial({ color: colors.animals.bear.snout }),
            rabbit: new THREE.MeshLambertMaterial({ color: colors.animals.rabbit.main }),
            rabbitLight: new THREE.MeshLambertMaterial({ color: colors.animals.rabbit.light }),
            rabbitEar: new THREE.MeshLambertMaterial({ color: colors.animals.rabbit.ear }),
            white: new THREE.MeshLambertMaterial({ color: 0xffffff }),
            tusk: new THREE.MeshLambertMaterial({ color: 0xfffff0 }),
            black: new THREE.MeshLambertMaterial({ color: 0x222222 }),
            pink: new THREE.MeshLambertMaterial({ color: 0xffaaaa })
        };
    }
    
    createDeer() {
        // If deer model is loaded, use it with animation
        if (this.deerModel) {
            const deer = new THREE.Group();
            // Use SkeletonUtils.clone for animated models with skeletons
            const model = SkeletonUtils.clone(this.deerModel);
            
            // Scale the model appropriately
            model.scale.set(1.85, 1.85, 1.85);
            
            // Rotate to face +X direction (model may face different direction)
            model.rotation.y = Math.PI / 2;
            
            deer.add(model);
            
            // Setup animation mixer for this deer
            const mixer = new THREE.AnimationMixer(model);
            deer.userData.mixer = mixer;
            
            // Find and play the Walk animation
            const walkAnim = this.deerAnimations.find(a => a.name.toLowerCase().includes('walk'));
            if (walkAnim) {
                const action = mixer.clipAction(walkAnim);
                action.play();
                deer.userData.walkAction = action;
            }
            
            this.mixers.push(mixer);
            
            return deer;
        }
        
        // Fallback to procedural deer if model not loaded yet
        const deer = new THREE.Group();
        const m = this.materials;
        
        // Body
        deer.add(this.mesh(new THREE.BoxGeometry(1.8, 0.9, 0.7), m.deer, [0, 1.1, 0], true));
        
        // Neck
        const neck = this.mesh(new THREE.BoxGeometry(0.3, 0.8, 0.3), m.deer, [0.8, 1.6, 0]);
        neck.rotation.z = -0.3;
        deer.add(neck);
        
        // Head & snout
        deer.add(this.mesh(new THREE.BoxGeometry(0.6, 0.45, 0.4), m.deerLight, [1.1, 2.0, 0]));
        deer.add(this.mesh(new THREE.BoxGeometry(0.35, 0.25, 0.25), m.deerLight, [1.45, 1.9, 0]));
        
        // Ears
        const earGeo = new THREE.ConeGeometry(0.1, 0.25, 4);
        [-0.15, 0.15].forEach(z => {
            const ear = this.mesh(earGeo, m.deer, [1.0, 2.35, z]);
            ear.rotation.x = z > 0 ? 0.3 : -0.3;
            deer.add(ear);
        });
        
        // Antlers
        [-0.12, 0.12].forEach(z => {
            const antlerGroup = new THREE.Group();
            const beam = this.mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.7, 4), m.antler);
            beam.rotation.z = z > 0 ? 0.4 : -0.4;
            beam.rotation.x = 0.2;
            antlerGroup.add(beam);
            
            const tine = this.mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.3, 4), m.antler, [z > 0 ? 0.1 : -0.1, 0.2, 0]);
            tine.rotation.z = z > 0 ? -0.5 : 0.5;
            antlerGroup.add(tine);
            
            antlerGroup.position.set(1.05, 2.3, z);
            deer.add(antlerGroup);
        });
        
        // Legs
        this.addLegs(deer, m.deer, [
            [-0.55, 0.45, -0.2], [-0.55, 0.45, 0.2],
            [0.55, 0.45, -0.2], [0.55, 0.45, 0.2]
        ], 0.9);
        
        // Tail
        deer.add(this.mesh(new THREE.SphereGeometry(0.12, 6, 6), m.white, [-1.0, 1.2, 0]));
        
        return deer;
    }
    
    createBear() {
        // If bear model is loaded, use it with animation
        if (this.bearModel) {
            const bear = new THREE.Group();
            // Use SkeletonUtils.clone for animated models with skeletons
            const model = SkeletonUtils.clone(this.bearModel);
            
            // Scale the model appropriately
            model.scale.set(2, 2, 2);
            
            // Rotate to face +X direction (model may face different direction)
            model.rotation.y = Math.PI / 2;
            
            bear.add(model);
            
            // Setup animation mixer for this bear
            const mixer = new THREE.AnimationMixer(model);
            bear.userData.mixer = mixer;
            
            // Find and play the Walk animation
            const walkAnim = this.bearAnimations.find(a => a.name.toLowerCase().includes('walk'));
            if (walkAnim) {
                const action = mixer.clipAction(walkAnim);
                action.play();
                bear.userData.walkAction = action;
            }
            
            this.mixers.push(mixer);
            
            return bear;
        }
        
        // Fallback to procedural bear if bear model not loaded yet
        const bear = new THREE.Group();
        const m = this.materials;
        
        // Body
        bear.add(this.mesh(new THREE.BoxGeometry(1.4, 0.7, 0.8), m.bear, [0, 0.65, 0], true));
        
        // Back hump
        const hump = this.mesh(new THREE.SphereGeometry(0.35, 8, 6), m.bearDark, [-0.2, 1.0, 0]);
        hump.scale.set(1.2, 0.8, 1);
        bear.add(hump);
        
        // Head
        bear.add(this.mesh(new THREE.BoxGeometry(0.5, 0.45, 0.55), m.bear, [0.8, 0.6, 0]));
        
        // Snout
        const snout = this.mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.3, 8), m.snout, [1.1, 0.5, 0]);
        snout.rotation.z = Math.PI / 2;
        bear.add(snout);
        
        // Tusks
        const tuskGeo = new THREE.ConeGeometry(0.03, 0.15, 4);
        [-0.15, 0.15].forEach(z => {
            const tusk = this.mesh(tuskGeo, m.tusk, [1.05, 0.35, z]);
            tusk.rotation.x = z > 0 ? -0.3 : 0.3;
            bear.add(tusk);
        });
        
        // Ears
        const earGeo = new THREE.BoxGeometry(0.08, 0.15, 0.12);
        [-0.2, 0.2].forEach(z => bear.add(this.mesh(earGeo, m.bearDark, [0.7, 0.9, z])));
        
        // Legs
        this.addLegs(bear, m.bear, [
            [-0.4, 0.25, -0.25], [-0.4, 0.25, 0.25],
            [0.4, 0.25, -0.25], [0.4, 0.25, 0.25]
        ], 0.5);
        
        // Tail
        const tail = this.mesh(new THREE.CylinderGeometry(0.02, 0.04, 0.2, 4), m.bear, [-0.8, 0.7, 0]);
        tail.rotation.z = 0.5;
        bear.add(tail);
        
        return bear;
    }
    
    createRabbit() {
        const rabbit = new THREE.Group();
        const m = this.materials;
        
        // Body (oval)
        const body = this.mesh(new THREE.SphereGeometry(0.35, 8, 8), m.rabbit, [0, 0.4, 0], true);
        body.scale.set(1.3, 0.9, 1);
        rabbit.add(body);
        
        // Head
        rabbit.add(this.mesh(new THREE.SphereGeometry(0.22, 8, 8), m.rabbitLight, [0.4, 0.55, 0]));
        
        // Snout
        rabbit.add(this.mesh(new THREE.SphereGeometry(0.08, 6, 6), m.rabbitLight, [0.6, 0.5, 0]));
        
        // Nose
        rabbit.add(this.mesh(new THREE.SphereGeometry(0.03, 4, 4), m.pink, [0.68, 0.52, 0]));
        
        // Eyes
        [-0.08, 0.08].forEach(z => {
            rabbit.add(this.mesh(new THREE.SphereGeometry(0.04, 6, 6), m.black, [0.52, 0.62, z]));
        });
        
        // Long ears
        const earGeo = new THREE.CapsuleGeometry(0.05, 0.35, 4, 8);
        [-0.08, 0.08].forEach(z => {
            const ear = this.mesh(earGeo, m.rabbitEar, [0.25, 0.95, z]);
            ear.rotation.z = z > 0 ? 0.2 : -0.2;
            ear.rotation.x = z > 0 ? 0.15 : -0.15;
            rabbit.add(ear);
        });
        
        // Front legs
        const frontLegGeo = new THREE.CylinderGeometry(0.04, 0.035, 0.25, 4);
        [-0.12, 0.12].forEach(z => {
            const leg = this.mesh(frontLegGeo, m.rabbit, [0.25, 0.12, z]);
            leg.userData = { isLeg: true, legIndex: z > 0 ? 1 : 0 };
            rabbit.add(leg);
        });
        
        // Back legs (bigger, bent)
        const backLegGeo = new THREE.CapsuleGeometry(0.06, 0.2, 4, 8);
        [-0.15, 0.15].forEach((z, i) => {
            const leg = this.mesh(backLegGeo, m.rabbit, [-0.25, 0.18, z]);
            leg.rotation.z = 0.4;
            leg.userData = { isLeg: true, legIndex: i + 2 };
            rabbit.add(leg);
        });
        
        // Fluffy tail
        rabbit.add(this.mesh(new THREE.SphereGeometry(0.1, 6, 6), m.white, [-0.45, 0.4, 0]));
        
        return rabbit;
    }
    
    mesh(geometry, material, position = [0, 0, 0], castShadow = false) {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(...position);
        if (castShadow) mesh.castShadow = true;
        return mesh;
    }
    
    addLegs(group, material, positions, height) {
        const legGeo = new THREE.CylinderGeometry(0.06, 0.05, height, 4);
        positions.forEach((pos, i) => {
            const leg = this.mesh(legGeo, material, pos);
            leg.userData = { isLeg: true, legIndex: i };
            group.add(leg);
        });
    }
    
    spawn(spawnPointIndex = null) {
        const types = CONFIG.animalTypes;
        let type, animal, x, z;
        
        // Check if using fixed spawn points
        if (CONFIG.spawnPoints && CONFIG.spawnPoints.length > 0) {
            // Use specific spawn point or pick next available
            let pointIndex = spawnPointIndex;
            if (pointIndex === null) {
                // Find an unused spawn point or cycle through
                pointIndex = this.animals.length % CONFIG.spawnPoints.length;
            }
            
            const spawnPoint = CONFIG.spawnPoints[pointIndex];
            type = spawnPoint.type;
            x = spawnPoint.x;
            z = spawnPoint.z;
        } else {
            // Random spawn based on chances
            const rand = Math.random();
            
            if (rand < types.deer.chance) {
                type = 'deer';
            } else if (rand < types.deer.chance + types.bear.chance) {
                type = 'bear';
            } else {
                type = 'rabbit';
            }
            
            // Spawn within camera's visible area
            const angle = this.getSpawnAngle();
            const { min, max } = CONFIG.spawnRadius;
            const radius = min + Math.random() * (max - min);
            
            // Camera looks at -Z, so use sin/cos directly with yaw angle
            x = Math.sin(angle) * radius;
            z = -Math.cos(angle) * radius;
        }
        
        // Create animal based on type
        if (type === 'deer') {
            animal = this.createDeer();
        } else if (type === 'bear') {
            animal = this.createBear();
        } else {
            animal = this.createRabbit();
        }
        
        const typeConfig = types[type];
        
        const y = this.getHeight(x, z);
        animal.position.set(x, y, z);
        
        // Random direction (any direction, not limited to camera area)
        const dirAngle = Math.random() * Math.PI * 2;
        const dirX = Math.sin(dirAngle);
        const dirZ = Math.cos(dirAngle);
        
        // Preserve mixer and walkAction if they exist (for GLB deer)
        const existingMixer = animal.userData?.mixer;
        const existingWalkAction = animal.userData?.walkAction;
        
        const speedMultiplier = typeConfig.speedMultiplier || 1.0;
        const baseSpeed = CONFIG.animalSpeed.min + Math.random() * (CONFIG.animalSpeed.max - CONFIG.animalSpeed.min);
        
        animal.userData = {
            type,
            points: typeConfig.points,
            boundingRadius: typeConfig.boundingRadius,
            speedMultiplier,
            speed: baseSpeed * speedMultiplier,
            direction: new THREE.Vector3(dirX, 0, dirZ).normalize(),
            changeTimer: 3 + Math.random() * 4,
            walkCycle: Math.random() * Math.PI * 2,
            alive: true,
            mixer: existingMixer,
            walkAction: existingWalkAction
        };
        
        // Create 3D label for this animal
        const label = this.createLabel(type, typeConfig.points);
        animal.userData.label = label;
        this.scene.add(label);
        
        // Animal model faces +X at rotation.y=0
        // For direction (dx, dz), angle from +X is atan2(dz, dx), but we need negative for correct orientation
        animal.rotation.y = -Math.atan2(animal.userData.direction.z, animal.userData.direction.x);
        
        this.scene.add(animal);
        this.animals.push(animal);
        return animal;
    }
    
    update(delta, timeScale) {
        const realDelta = delta * timeScale;
        const yawLimit = CONFIG.yawLimit || { min: -1.4, max: 1.4 };
        
        // Update all animation mixers
        this.mixers.forEach(mixer => {
            mixer.update(realDelta);
        });
        
        this.animals.forEach(animal => {
            if (!animal.userData.alive) return;
            
            const data = animal.userData;
            
            // Walk animation for animals without GLB animation (deer and bear use GLB animation)
            if ((data.type !== 'deer' && data.type !== 'bear') || !data.mixer) {
                const animSpeed = data.type === 'rabbit' ? 8 : 4;
                data.walkCycle += realDelta * data.speed * animSpeed;
                animal.children.forEach(child => {
                    if (child.userData.isLeg) {
                        const offset = child.userData.legIndex < 2 ? 0 : Math.PI;
                        const side = child.userData.legIndex % 2 === 0 ? 1 : -1;
                        const amplitude = data.type === 'rabbit' ? 0.6 : 0.4;
                        // Rotate around Z for forward/backward leg swing (animal faces +X)
                        child.rotation.z = Math.sin(data.walkCycle + offset) * amplitude * side;
                    }
                });
            }
            
            // Adjust animation speed based on movement speed for deer
            if (data.mixer && data.walkAction) {
                data.walkAction.timeScale = data.speed * 0.5;
            }
            
            // Movement
            animal.position.addScaledVector(data.direction, data.speed * realDelta);
            
            // Update Y position to follow terrain
            animal.position.y = this.getHeight(animal.position.x, animal.position.z);
            
            // Animal model faces +X at rotation.y=0 (frame-rate independent)
            const targetRotation = -Math.atan2(data.direction.z, data.direction.x);
            const rotSmoothing = 1 - Math.pow(0.9, realDelta * 60);
            animal.rotation.y = THREE.MathUtils.lerp(
                animal.rotation.y,
                targetRotation,
                rotSmoothing
            );
            
            // Direction change - pick random direction for natural wandering
            data.changeTimer -= realDelta;
            if (data.changeTimer <= 0) {
                // New random direction (full 360°)
                const newAngle = Math.random() * Math.PI * 2;
                data.direction.set(Math.sin(newAngle), 0, Math.cos(newAngle)).normalize();
                data.changeTimer = data.type === 'rabbit' ? 2 + Math.random() * 3 : 3 + Math.random() * 5;
                const baseSpeed = CONFIG.animalSpeed.min + Math.random() * (CONFIG.animalSpeed.max - CONFIG.animalSpeed.min);
                data.speed = baseSpeed * (data.speedMultiplier || 1.0);
            }
            
            // Boundary check - keep animals in playable area
            const dist = Math.hypot(animal.position.x, animal.position.z);
            const currentAngle = Math.atan2(animal.position.x, -animal.position.z);
            
            // Soft boundary - gradually steer back when approaching edges
            const margin = 0.2; // radians of margin before hard turn
            let needsSteer = false;
            let steerAngle = 0;
            
            // Check if near yaw limit edges
            if (currentAngle < yawLimit.min + margin) {
                // Near left edge - steer right
                steerAngle = yawLimit.min + 0.5;
                needsSteer = true;
            } else if (currentAngle > yawLimit.max - margin) {
                // Near right edge - steer left
                steerAngle = yawLimit.max - 0.5;
                needsSteer = true;
            }
            
            // Check if outside camera yaw range completely
            if (currentAngle < yawLimit.min || currentAngle > yawLimit.max) {
                // Turn back toward center
                steerAngle = (yawLimit.min + yawLimit.max) / 2;
                needsSteer = true;
            }
            
            if (needsSteer) {
                data.direction.set(Math.sin(steerAngle), 0, -Math.cos(steerAngle)).normalize();
                data.changeTimer = 1 + Math.random() * 2;
            }
            
            // Check radius bounds
            if (dist > CONFIG.spawnRadius.max + 5) {
                // Too far - turn toward center
                data.direction.set(-animal.position.x, 0, -animal.position.z).normalize();
                data.changeTimer = 1 + Math.random() * 2;
            } else if (dist < 20) {
                // Too close to tower - turn away
                data.direction.set(animal.position.x, 0, animal.position.z).normalize();
                data.changeTimer = 1 + Math.random() * 2;
            }
        });
    }
    
    getAlive() {
        return this.animals.filter(a => a.userData.alive);
    }
    
    remove(animal) {
        // Remove label if exists
        if (animal.userData.label) {
            this.scene.remove(animal.userData.label);
            if (animal.userData.label.material.map) {
                animal.userData.label.material.map.dispose();
            }
            animal.userData.label.material.dispose();
        }
        
        // Remove animation mixer if exists
        if (animal.userData.mixer) {
            animal.userData.mixer.stopAllAction();
            this.mixers = this.mixers.filter(m => m !== animal.userData.mixer);
        }
        
        this.scene.remove(animal);
        this.animals = this.animals.filter(a => a !== animal);
    }
    
    animateDeath(animal, onComplete) {
        // Hide label immediately on death
        this.hideLabel(animal);
        
        // For deer with GLB model, use Death animation
        if (animal.userData.type === 'deer' && animal.userData.mixer && this.deerAnimations) {
            const deathAnim = this.deerAnimations.find(a => a.name.toLowerCase().includes('death'));
            
            if (deathAnim) {
                const mixer = animal.userData.mixer;
                
                // Stop all current actions on this mixer
                mixer.stopAllAction();
                
                // Clone the animation clip for this specific deer to avoid conflicts
                const clonedDeathAnim = deathAnim.clone();
                
                // Play death animation
                const deathAction = mixer.clipAction(clonedDeathAnim);
                deathAction.setLoop(THREE.LoopOnce);
                deathAction.clampWhenFinished = true;
                deathAction.play();
                
                // Store the action for cleanup
                animal.userData.deathAction = deathAction;
                
                // Wait for animation to finish, then remove
                const animDuration = deathAnim.duration * 1000;
                setTimeout(() => {
                    setTimeout(() => {
                        this.remove(animal);
                        onComplete?.();
                    }, CONFIG.respawnDelay);
                }, animDuration);
                
                return;
            }
        }
        
        // For bear with GLB model, use Death animation
        if (animal.userData.type === 'bear' && animal.userData.mixer && this.bearAnimations) {
            const deathAnim = this.bearAnimations.find(a => a.name.toLowerCase().includes('death'));
            
            if (deathAnim) {
                const mixer = animal.userData.mixer;
                
                // Stop all current actions on this mixer
                mixer.stopAllAction();
                
                // Clone the animation clip for this specific bear to avoid conflicts
                const clonedDeathAnim = deathAnim.clone();
                
                // Play death animation
                const deathAction = mixer.clipAction(clonedDeathAnim);
                deathAction.setLoop(THREE.LoopOnce);
                deathAction.clampWhenFinished = true;
                deathAction.play();
                
                // Store the action for cleanup
                animal.userData.deathAction = deathAction;
                
                // Wait for animation to finish, then remove
                const animDuration = deathAnim.duration * 1000;
                setTimeout(() => {
                    setTimeout(() => {
                        this.remove(animal);
                        onComplete?.();
                    }, CONFIG.respawnDelay);
                }, animDuration);
                
                return;
            }
        }
        
        // Fallback: procedural death animation for other animals
        let t = 0;
        let lastTime = performance.now();
        const startY = animal.position.y;
        const startRotZ = animal.rotation.z;
        const duration = 500; // Animation duration in ms
        
        const animate = () => {
            const now = performance.now();
            const deltaMs = now - lastTime;
            lastTime = now;
            
            // Frame-rate independent progress
            t += deltaMs / duration;
            
            animal.rotation.z = startRotZ + Math.min(t, 1) * (Math.PI / 2);
            animal.position.y = startY - Math.min(t, 1) * 0.3;
            
            if (t < 1) {
                requestAnimationFrame(animate);
            } else {
                setTimeout(() => {
                    this.remove(animal);
                    onComplete?.();
                }, CONFIG.respawnDelay);
            }
        };
        animate();
    }
}
