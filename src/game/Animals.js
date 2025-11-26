import * as THREE from 'three';
import { CONFIG } from '@/config';

/**
 * Animal factory and management
 */
export class AnimalManager {
    constructor(scene) {
        this.scene = scene;
        this.animals = [];
        this.materials = this.createMaterials();
    }
    
    createMaterials() {
        const { colors } = CONFIG;
        return {
            deer: new THREE.MeshLambertMaterial({ color: colors.animals.deer.main }),
            deerLight: new THREE.MeshLambertMaterial({ color: colors.animals.deer.light }),
            antler: new THREE.MeshLambertMaterial({ color: colors.animals.deer.antler }),
            boar: new THREE.MeshLambertMaterial({ color: colors.animals.boar.main }),
            boarDark: new THREE.MeshLambertMaterial({ color: colors.animals.boar.dark }),
            snout: new THREE.MeshLambertMaterial({ color: colors.animals.boar.snout }),
            white: new THREE.MeshLambertMaterial({ color: 0xffffff }),
            tusk: new THREE.MeshLambertMaterial({ color: 0xfffff0 })
        };
    }
    
    createDeer() {
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
    
    createBoar() {
        const boar = new THREE.Group();
        const m = this.materials;
        
        // Body
        boar.add(this.mesh(new THREE.BoxGeometry(1.4, 0.7, 0.8), m.boar, [0, 0.65, 0], true));
        
        // Back hump
        const hump = this.mesh(new THREE.SphereGeometry(0.35, 8, 6), m.boarDark, [-0.2, 1.0, 0]);
        hump.scale.set(1.2, 0.8, 1);
        boar.add(hump);
        
        // Head
        boar.add(this.mesh(new THREE.BoxGeometry(0.5, 0.45, 0.55), m.boar, [0.8, 0.6, 0]));
        
        // Snout
        const snout = this.mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.3, 8), m.snout, [1.1, 0.5, 0]);
        snout.rotation.z = Math.PI / 2;
        boar.add(snout);
        
        // Tusks
        const tuskGeo = new THREE.ConeGeometry(0.03, 0.15, 4);
        [-0.15, 0.15].forEach(z => {
            const tusk = this.mesh(tuskGeo, m.tusk, [1.05, 0.35, z]);
            tusk.rotation.x = z > 0 ? -0.3 : 0.3;
            boar.add(tusk);
        });
        
        // Ears
        const earGeo = new THREE.BoxGeometry(0.08, 0.15, 0.12);
        [-0.2, 0.2].forEach(z => boar.add(this.mesh(earGeo, m.boarDark, [0.7, 0.9, z])));
        
        // Legs
        this.addLegs(boar, m.boar, [
            [-0.4, 0.25, -0.25], [-0.4, 0.25, 0.25],
            [0.4, 0.25, -0.25], [0.4, 0.25, 0.25]
        ], 0.5);
        
        // Tail
        const tail = this.mesh(new THREE.CylinderGeometry(0.02, 0.04, 0.2, 4), m.boar, [-0.8, 0.7, 0]);
        tail.rotation.z = 0.5;
        boar.add(tail);
        
        return boar;
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
    
    spawn() {
        const isDeer = Math.random() < CONFIG.animalTypes.deer.chance;
        const animal = isDeer ? this.createDeer() : this.createBoar();
        const type = isDeer ? 'deer' : 'boar';
        const typeConfig = CONFIG.animalTypes[type];
        
        const angle = Math.random() * Math.PI * 2;
        const { min, max } = CONFIG.spawnRadius;
        const radius = min + Math.random() * (max - min);
        
        animal.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
        
        animal.userData = {
            type,
            points: typeConfig.points,
            boundingRadius: typeConfig.boundingRadius,
            speed: CONFIG.animalSpeed.min + Math.random() * (CONFIG.animalSpeed.max - CONFIG.animalSpeed.min),
            direction: new THREE.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2).normalize(),
            changeTimer: 3 + Math.random() * 4,
            walkCycle: Math.random() * Math.PI * 2,
            alive: true
        };
        
        animal.rotation.y = Math.atan2(animal.userData.direction.x, animal.userData.direction.z);
        
        this.scene.add(animal);
        this.animals.push(animal);
        return animal;
    }
    
    update(delta, timeScale) {
        const realDelta = delta * timeScale;
        
        this.animals.forEach(animal => {
            if (!animal.userData.alive) return;
            
            const data = animal.userData;
            
            // Walk animation
            data.walkCycle += realDelta * data.speed * 4;
            animal.children.forEach(child => {
                if (child.userData.isLeg) {
                    const offset = child.userData.legIndex < 2 ? 0 : Math.PI;
                    const side = child.userData.legIndex % 2 === 0 ? 1 : -1;
                    child.rotation.x = Math.sin(data.walkCycle + offset) * 0.4 * side;
                }
            });
            
            // Movement
            animal.position.addScaledVector(data.direction, data.speed * realDelta);
            animal.rotation.y = THREE.MathUtils.lerp(
                animal.rotation.y,
                Math.atan2(data.direction.x, data.direction.z),
                0.1
            );
            
            // Direction change
            data.changeTimer -= realDelta;
            if (data.changeTimer <= 0) {
                data.direction.set((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2).normalize();
                data.changeTimer = 2 + Math.random() * 5;
                data.speed = CONFIG.animalSpeed.min + Math.random() * (CONFIG.animalSpeed.max - CONFIG.animalSpeed.min);
            }
            
            // Boundary check
            const dist = Math.hypot(animal.position.x, animal.position.z);
            if (dist > CONFIG.spawnRadius.max + 15 || dist < 12) {
                data.direction.set(
                    dist < 12 ? animal.position.x : -animal.position.x,
                    0,
                    dist < 12 ? animal.position.z : -animal.position.z
                ).normalize();
                data.changeTimer = dist < 12 ? 2 : 3;
            }
        });
    }
    
    getAlive() {
        return this.animals.filter(a => a.userData.alive);
    }
    
    remove(animal) {
        this.scene.remove(animal);
        this.animals = this.animals.filter(a => a !== animal);
    }
    
    animateDeath(animal, onComplete) {
        let t = 0;
        const startY = animal.position.y;
        const startRotZ = animal.rotation.z;
        
        const animate = () => {
            t += 0.03;
            animal.rotation.z = startRotZ + t * (Math.PI / 2);
            animal.position.y = startY - t * 0.3;
            
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

