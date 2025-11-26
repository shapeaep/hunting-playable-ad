import * as THREE from 'three';
import { CONFIG } from '@/config';

/**
 * Creates and manages the game world (terrain, trees, sky)
 */
export class World {
    constructor(scene) {
        this.scene = scene;
        this.materials = this.createMaterials();
    }
    
    createMaterials() {
        const { colors } = CONFIG;
        return {
            ground: new THREE.MeshLambertMaterial({ color: colors.ground.main }),
            groundDark: new THREE.MeshLambertMaterial({ color: colors.ground.dark }),
            grass: new THREE.MeshLambertMaterial({ color: colors.ground.grass }),
            trunk: new THREE.MeshLambertMaterial({ color: colors.tree.trunk }),
            leaves: colors.tree.leaves.map(c => new THREE.MeshLambertMaterial({ color: c }))
        };
    }
    
    create() {
        this.createSky();
        this.createGround();
        this.createForest();
    }
    
    createSky() {
        const { colors } = CONFIG;
        
        const skyGeo = new THREE.SphereGeometry(400, 32, 32);
        const skyMat = new THREE.ShaderMaterial({
            uniforms: {
                topColor: { value: new THREE.Color(colors.sky) },
                bottomColor: { value: new THREE.Color(colors.skyBottom) }
            },
            vertexShader: `
                varying vec3 vWorldPosition;
                void main() {
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPosition.xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 topColor;
                uniform vec3 bottomColor;
                varying vec3 vWorldPosition;
                void main() {
                    float h = normalize(vWorldPosition).y;
                    gl_FragColor = vec4(mix(bottomColor, topColor, max(h, 0.0)), 1.0);
                }
            `,
            side: THREE.BackSide
        });
        
        this.scene.add(new THREE.Mesh(skyGeo, skyMat));
        this.scene.fog = new THREE.FogExp2(colors.fog, colors.fogDensity);
    }
    
    createGround() {
        // Main ground circle
        const groundGeo = new THREE.CircleGeometry(CONFIG.groundSize / 2, 64);
        const ground = new THREE.Mesh(groundGeo, this.materials.ground);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);
        
        // Dark patches for variation
        for (let i = 0; i < CONFIG.groundPatchCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = 10 + Math.random() * 100;
            const patchGeo = new THREE.CircleGeometry(3 + Math.random() * 8, 8);
            const patch = new THREE.Mesh(patchGeo, this.materials.groundDark);
            patch.rotation.x = -Math.PI / 2;
            patch.position.set(
                Math.cos(angle) * radius,
                0.01,
                Math.sin(angle) * radius
            );
            this.scene.add(patch);
        }
        
        // Grass tufts
        const grassGeo = new THREE.ConeGeometry(0.15, 0.5, 4);
        for (let i = 0; i < CONFIG.grassCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = 5 + Math.random() * 120;
            const grass = new THREE.Mesh(grassGeo, this.materials.grass);
            grass.position.set(
                Math.cos(angle) * radius,
                0.25,
                Math.sin(angle) * radius
            );
            grass.rotation.y = Math.random() * Math.PI;
            grass.scale.setScalar(0.5 + Math.random());
            this.scene.add(grass);
        }
    }
    
    createTree(x, z) {
        const tree = new THREE.Group();
        const scale = 0.7 + Math.random() * 0.6;
        const trunkHeight = 4 + Math.random() * 3;
        
        // Trunk
        const trunkGeo = new THREE.CylinderGeometry(0.2 * scale, 0.4 * scale, trunkHeight, 6);
        const trunk = new THREE.Mesh(trunkGeo, this.materials.trunk);
        trunk.position.y = trunkHeight / 2;
        trunk.castShadow = true;
        tree.add(trunk);
        
        // Foliage layers
        const layers = 3 + Math.floor(Math.random() * 2);
        for (let i = 0; i < layers; i++) {
            const layerY = trunkHeight - 1 + i * 1.8;
            const layerScale = 1 - i * 0.2;
            const foliageGeo = new THREE.ConeGeometry(2.5 * scale * layerScale, 3 * scale, 8);
            const foliage = new THREE.Mesh(
                foliageGeo,
                this.materials.leaves[Math.floor(Math.random() * this.materials.leaves.length)]
            );
            foliage.position.y = layerY;
            foliage.castShadow = true;
            foliage.receiveShadow = true;
            tree.add(foliage);
        }
        
        tree.position.set(x, 0, z);
        this.scene.add(tree);
    }
    
    createForest() {
        for (let i = 0; i < CONFIG.treeCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const minRadius = Math.random() < 0.3 ? 30 : 60;
            const radius = minRadius + Math.random() * 70;
            this.createTree(
                Math.cos(angle) * radius + (Math.random() - 0.5) * 10,
                Math.sin(angle) * radius + (Math.random() - 0.5) * 10
            );
        }
    }
}

