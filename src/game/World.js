import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { CONFIG } from '../config';
import terrainTextureSrc from '../assets/terrain.jpg';
import treeModelSrc from '../assets/tree.glb';
import grassTextureSrc from '../assets/grass.png';
import rockTextureSrc from '../assets/rock.jpg';

/**
 * Simple noise function for terrain generation
 */
class SimplexNoise {
    constructor(seed = Math.random()) {
        this.p = new Uint8Array(512);
        const perm = new Uint8Array(256);
        for (let i = 0; i < 256; i++) perm[i] = i;
        
        let s = seed * 2147483647;
        for (let i = 255; i > 0; i--) {
            s = (s * 16807) % 2147483647;
            const j = s % (i + 1);
            [perm[i], perm[j]] = [perm[j], perm[i]];
        }
        for (let i = 0; i < 512; i++) this.p[i] = perm[i & 255];
    }
    
    noise2D(x, y) {
        const F2 = 0.5 * (Math.sqrt(3) - 1);
        const G2 = (3 - Math.sqrt(3)) / 6;
        
        const s = (x + y) * F2;
        const i = Math.floor(x + s);
        const j = Math.floor(y + s);
        const t = (i + j) * G2;
        
        const X0 = i - t, Y0 = j - t;
        const x0 = x - X0, y0 = y - Y0;
        
        const i1 = x0 > y0 ? 1 : 0;
        const j1 = x0 > y0 ? 0 : 1;
        
        const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
        const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
        
        const ii = i & 255, jj = j & 255;
        
        const grad = (hash, x, y) => {
            const h = hash & 7;
            const u = h < 4 ? x : y;
            const v = h < 4 ? y : x;
            return ((h & 1) ? -u : u) + ((h & 2) ? -2 * v : 2 * v);
        };
        
        let n0 = 0, n1 = 0, n2 = 0;
        let t0 = 0.5 - x0 * x0 - y0 * y0;
        if (t0 >= 0) {
            t0 *= t0;
            n0 = t0 * t0 * grad(this.p[ii + this.p[jj]], x0, y0);
        }
        
        let t1 = 0.5 - x1 * x1 - y1 * y1;
        if (t1 >= 0) {
            t1 *= t1;
            n1 = t1 * t1 * grad(this.p[ii + i1 + this.p[jj + j1]], x1, y1);
        }
        
        let t2 = 0.5 - x2 * x2 - y2 * y2;
        if (t2 >= 0) {
            t2 *= t2;
            n2 = t2 * t2 * grad(this.p[ii + 1 + this.p[jj + 1]], x2, y2);
        }
        
        return 70 * (n0 + n1 + n2);
    }
}

/**
 * Seeded random number generator
 */
class SeededRandom {
    constructor(seed) {
        this.seed = seed;
    }
    
    next() {
        this.seed = (this.seed * 16807) % 2147483647;
        return (this.seed - 1) / 2147483646;
    }
}

/**
 * Creates and manages the game world
 */
export class World {
    constructor(scene) {
        this.scene = scene;
        const seed = CONFIG.worldSeed || 42;
        this.noise = new SimplexNoise(seed);
        this.random = new SeededRandom(seed);
        this.materials = this.createMaterials();
        
        // Loading tracking
        this.loadingProgress = 0;
        this.assetsToLoad = 2; // tree model + terrain texture
        this.assetsLoaded = 0;
        this.onLoadComplete = null;
        
        // Tree instances (for InstancedMesh optimization)
        this.treeInstances = [];
        this.treeInstancedMeshes = [];
        this.loadTreeModel();
        
        // Update initial progress
        this.updateProgress(20);
    }
    
    updateProgress(progress) {
        this.loadingProgress = progress;
        if (window.updateLoadingProgress) {
            window.updateLoadingProgress(progress);
        }
    }
    
    assetLoaded() {
        this.assetsLoaded++;
        const progress = 20 + (this.assetsLoaded / this.assetsToLoad) * 80;
        this.updateProgress(progress);
        
        if (this.assetsLoaded >= this.assetsToLoad) {
            // All loaded
            setTimeout(() => {
                if (window.hideLoadingScreen) {
                    window.hideLoadingScreen();
                }
                if (this.onLoadComplete) {
                    this.onLoadComplete();
                }
            }, 300);
        }
    }
    
    /**
     * Pre-generate tree positions for instanced rendering
     */
    generateTreePositions() {
        this.treeInstances = [];
        for (let i = 0; i < CONFIG.treeCount; i++) {
            const angle = this.rand() * Math.PI * 2;
            const minRadius = this.rand() < 0.3 ? 25 : 50;
            const radius = minRadius + this.rand() * 80;
            const x = Math.cos(angle) * radius + (this.rand() - 0.5) * 8;
            const z = Math.sin(angle) * radius + (this.rand() - 0.5) * 8;
            const scale = 0.125 + this.rand() * 0.15;
            const rotationY = this.rand() * Math.PI * 2;
            const y = this.getTerrainHeight(x, z);
            
            this.treeInstances.push({ x, y, z, scale, rotationY });
        }
    }
    
    loadTreeModel() {
        const loader = new GLTFLoader();
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('node_modules/three/examples/jsm/libs/draco/');
        loader.setDRACOLoader(dracoLoader);
        
        loader.load(treeModelSrc, (gltf) => {
            // Extract meshes from the tree model
            const meshes = [];
            gltf.scene.traverse((child) => {
                if (child.isMesh) {
                    meshes.push({
                        geometry: child.geometry,
                        material: child.material,
                        position: child.position.clone(),
                        rotation: child.rotation.clone(),
                        scale: child.scale.clone()
                    });
                }
            });
            
            // Create InstancedMesh for each mesh in the tree
            const treeCount = this.treeInstances.length;
            const dummy = new THREE.Object3D();
            
            meshes.forEach((meshData) => {
                const instancedMesh = new THREE.InstancedMesh(
                    meshData.geometry,
                    meshData.material,
                    treeCount
                );
                instancedMesh.castShadow = true;
                instancedMesh.receiveShadow = true;
                instancedMesh.frustumCulled = true; // Enable frustum culling
                
                // Set up each instance
                this.treeInstances.forEach((tree, i) => {
                    // Apply tree transform
                    dummy.position.set(tree.x, tree.y, tree.z);
                    dummy.rotation.set(0, tree.rotationY, 0);
                    dummy.scale.setScalar(tree.scale);
                    
                    // Apply mesh-local transform
                    dummy.position.x += meshData.position.x * tree.scale;
                    dummy.position.y += meshData.position.y * tree.scale;
                    dummy.position.z += meshData.position.z * tree.scale;
                    
                    dummy.updateMatrix();
                    instancedMesh.setMatrixAt(i, dummy.matrix);
                });
                
                instancedMesh.instanceMatrix.needsUpdate = true;
                this.scene.add(instancedMesh);
                this.treeInstancedMeshes.push(instancedMesh);
            });
            
            console.log(`Tree model loaded: ${treeCount} instances using ${meshes.length} InstancedMesh(es)`);
            this.assetLoaded();
        });
    }
    
    // Use seeded random instead of Math.random
    rand() {
        return this.random.next();
    }
    
    /**
     * Get terrain height at world position (x, z)
     */
    getTerrainHeight(x, z) {
        const distortion = CONFIG.terrainDistortion || 1.2;
        const scale1 = 0.008;  // Very gentle rolling
        const scale2 = 0.025;  // Subtle variation
        
        const dist = Math.sqrt(x * x + z * z);
        const centerFlatten = Math.max(0, 1 - dist / 25);
        
        // Terrain height based on config distortion
        let height = 0;
        height += this.noise.noise2D(x * scale1, z * scale1) * distortion;
        height += this.noise.noise2D(x * scale2, z * scale2) * (distortion * 0.33);
        
        // Flatten center
        height *= (1 - centerFlatten * centerFlatten);
        
        return height;
    }
    
    createMaterials() {
        const { colors } = CONFIG;
        return {
            ground: new THREE.MeshLambertMaterial({ color: colors.ground.main }),
            groundDark: new THREE.MeshLambertMaterial({ color: colors.ground.dark }),
            groundLight: new THREE.MeshLambertMaterial({ color: colors.ground.light }),
            grass: new THREE.MeshLambertMaterial({ color: colors.ground.grass }),
            grassDark: new THREE.MeshLambertMaterial({ color: colors.ground.grassDark }),
            grassLight: new THREE.MeshLambertMaterial({ color: colors.ground.grassLight }),
            trunk: new THREE.MeshLambertMaterial({ color: colors.tree.trunk }),
            leaves: colors.tree.leaves.map(c => new THREE.MeshLambertMaterial({ color: c })),
            flowerRed: new THREE.MeshLambertMaterial({ color: colors.flowers.red }),
            flowerYellow: new THREE.MeshLambertMaterial({ color: colors.flowers.yellow }),
            flowerWhite: new THREE.MeshLambertMaterial({ color: colors.flowers.white }),
            flowerPurple: new THREE.MeshLambertMaterial({ color: colors.flowers.purple }),
            flowerPink: new THREE.MeshLambertMaterial({ color: colors.flowers.pink }),
            flowerOrange: new THREE.MeshLambertMaterial({ color: colors.flowers.orange }),
            flowerStem: new THREE.MeshLambertMaterial({ color: 0x2d5a27 }),
            // Mountains
            mountainBase: new THREE.MeshLambertMaterial({ color: colors.mountain.base }),
            mountainMid: new THREE.MeshLambertMaterial({ color: colors.mountain.mid }),
            mountainSnow: new THREE.MeshLambertMaterial({ color: colors.mountain.snow }),
            mountainRock: new THREE.MeshLambertMaterial({ color: 0x6a7a8a }),
            
            // Rock materials with variation
            rock1: new THREE.MeshStandardMaterial({ 
                color: 0x7a7a78, 
                roughness: 0.9, 
                metalness: 0.1 
            }),
            rock2: new THREE.MeshStandardMaterial({ 
                color: 0x6a6a68, 
                roughness: 0.85, 
                metalness: 0.05 
            }),
            rock3: new THREE.MeshStandardMaterial({ 
                color: 0x8a8a85, 
                roughness: 0.95, 
                metalness: 0.0 
            })
        };
    }
    
    create() {
        this.createSky();
        this.createClouds();
        this.createMountains();
        this.createGround();
        this.createRocks();
        this.createGrassVariety();
        this.createFlowers();
        this.createForest();
    }
    
    createMountains() {
        const cfg = CONFIG.mountains;
        if (!cfg?.enabled) return;
        
        const count = cfg.count || 8;
        const baseDistance = cfg.distance || 180;
        
        for (let i = 0; i < count; i++) {
            // Distribute evenly in front of camera
            const angle = (i / count) * Math.PI * 1.2 - Math.PI * 0.6;
            const distance = baseDistance + this.rand() * 30;
            
            const mountain = this.createMountain(cfg);
            mountain.position.set(
                Math.sin(angle) * distance,
                -10,
                -Math.cos(angle) * distance
            );
            
            this.scene.add(mountain);
        }
    }
    
    createMountain(cfg) {
        const mountain = new THREE.Group();
        
        const height = cfg.minHeight + this.rand() * (cfg.maxHeight - cfg.minHeight);
        const baseRadius = cfg.minRadius + this.rand() * (cfg.maxRadius - cfg.minRadius);
        
        // Main peak - elegant triangular shape
        const mainGeo = new THREE.ConeGeometry(baseRadius, height, 6);
        const mainPeak = new THREE.Mesh(mainGeo, this.materials.mountainBase);
        mainPeak.position.y = height / 2;
        mountain.add(mainPeak);
        
        // Snow cap - clean white top
        const snowHeight = height * 0.2;
        const snowRadius = baseRadius * 0.22;
        const snowGeo = new THREE.ConeGeometry(snowRadius, snowHeight, 6);
        const snow = new THREE.Mesh(snowGeo, this.materials.mountainSnow);
        snow.position.y = height - snowHeight / 2 + 1;
        mountain.add(snow);
        
        // Add 1-2 smaller peaks nearby for depth
        const peakCount = 1 + Math.floor(this.rand() * 2);
        for (let p = 0; p < peakCount; p++) {
            const peakHeight = height * (0.4 + this.rand() * 0.35);
            const peakRadius = baseRadius * (0.3 + this.rand() * 0.25);
            const peakGeo = new THREE.ConeGeometry(peakRadius, peakHeight, 5);
            const peak = new THREE.Mesh(peakGeo, this.materials.mountainMid);
            
            const peakAngle = this.rand() * Math.PI * 2;
            const peakDist = baseRadius * (0.5 + this.rand() * 0.3);
            peak.position.set(
                Math.cos(peakAngle) * peakDist,
                peakHeight / 2,
                Math.sin(peakAngle) * peakDist
            );
            mountain.add(peak);
            
            // Snow on secondary peak
            if (peakHeight > height * 0.5) {
                const miniSnowGeo = new THREE.ConeGeometry(peakRadius * 0.18, peakHeight * 0.15, 5);
                const miniSnow = new THREE.Mesh(miniSnowGeo, this.materials.mountainSnow);
                miniSnow.position.set(
                    Math.cos(peakAngle) * peakDist,
                    peakHeight - peakHeight * 0.06,
                    Math.sin(peakAngle) * peakDist
                );
                mountain.add(miniSnow);
            }
        }
        
        return mountain;
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
    
    createClouds() {
        const cloudMaterial = new THREE.MeshLambertMaterial({ 
            color: 0xffffff,
            transparent: true,
            opacity: 0.85
        });
        
        // Cloud count from config
        const cloudCount = CONFIG.cloudCount || 25;
        for (let c = 0; c < cloudCount; c++) {
            const cloud = new THREE.Group();
            
            const cloudScale = 0.6 + this.rand() * 1.0;
            const puffCount = 3 + Math.floor(this.rand() * 4);
            
            for (let p = 0; p < puffCount; p++) {
                const puffSize = (1.2 + this.rand() * 1.8) * cloudScale;
                const puffGeo = new THREE.SphereGeometry(puffSize, 7, 5);
                const puff = new THREE.Mesh(puffGeo, cloudMaterial);
                
                puff.position.set(
                    (this.rand() - 0.5) * 5 * cloudScale,
                    (this.rand() - 0.5) * 1.2 * cloudScale,
                    (this.rand() - 0.5) * 3 * cloudScale
                );
                puff.scale.y = 0.5;
                cloud.add(puff);
            }
            
            const angle = this.rand() * Math.PI * 2;
            const distance = 80 + this.rand() * 180;
            const height = 40 + this.rand() * 50;
            
            cloud.position.set(
                Math.cos(angle) * distance,
                height,
                Math.sin(angle) * distance
            );
            cloud.rotation.y = this.rand() * Math.PI;
            
            this.scene.add(cloud);
        }
    }
    
    createGround() {
        const size = CONFIG.groundSize;
        const segments = 100;
        
        const groundGeo = new THREE.PlaneGeometry(size, size, segments, segments);
        const positions = groundGeo.attributes.position;
        
        // Apply terrain height displacement
        for (let i = 0; i < positions.count; i++) {
            const localX = positions.getX(i);
            const localY = positions.getY(i);
            
            // World coordinates after rotation
            const worldX = localX;
            const worldZ = -localY;
            
            const height = this.getTerrainHeight(worldX, worldZ);
            positions.setZ(i, height);
        }
        
        groundGeo.computeVertexNormals();
        
        // Load terrain texture
        const textureLoader = new THREE.TextureLoader();
        const terrainTexture = textureLoader.load(terrainTextureSrc, () => {
            console.log('Terrain texture loaded');
            this.assetLoaded();
        });
        terrainTexture.wrapS = THREE.RepeatWrapping;
        terrainTexture.wrapT = THREE.RepeatWrapping;
        terrainTexture.repeat.set(25, 25);
        terrainTexture.colorSpace = THREE.SRGBColorSpace;
        
        const groundMat = new THREE.MeshLambertMaterial({ 
            map: terrainTexture,
            side: THREE.DoubleSide
        });
        
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);
    }
    
    /**
     * Scatter an object at world position with correct terrain height
     */
    placeOnTerrain(object, x, z, yOffset = 0) {
        const y = this.getTerrainHeight(x, z);
        object.position.set(x, y + yOffset, z);
    }
    
    createRocks() {
        const rockCount = CONFIG.rockCount || 150;
        
        // Load rock texture with tiling
        const textureLoader = new THREE.TextureLoader();
        const rockTexture = textureLoader.load(rockTextureSrc);
        rockTexture.wrapS = THREE.RepeatWrapping;
        rockTexture.wrapT = THREE.RepeatWrapping;
        rockTexture.repeat.set(1.5, 1.5);  // Tile texture 2x2
        rockTexture.colorSpace = THREE.SRGBColorSpace;
        
        // Create textured rock materials with slight color variations
        const rockMaterials = [
            new THREE.MeshStandardMaterial({ 
                map: rockTexture,
                roughness: 0.9, 
                metalness: 0.1 
            }),
            new THREE.MeshStandardMaterial({ 
                map: rockTexture,
                color: 0xdddddd,  // Slightly lighter
                roughness: 0.85, 
                metalness: 0.05 
            }),
            new THREE.MeshStandardMaterial({ 
                map: rockTexture,
                color: 0xaaaaaa,  // Slightly darker
                roughness: 0.95, 
                metalness: 0.0 
            })
        ];
        
        // Create smooth rock geometry with subtle deformation
        const createRockGeometry = (seed) => {
            // Use sphere with more segments for smooth appearance
            const geo = new THREE.SphereGeometry(1, 12, 10);
            const positions = geo.attributes.position;
            
            // Subtle noise-based deformation for natural rock shape
            for (let i = 0; i < positions.count; i++) {
                const x = positions.getX(i);
                const y = positions.getY(i);
                const z = positions.getZ(i);
                
                // Normalize to get direction
                const len = Math.sqrt(x * x + y * y + z * z);
                const nx = x / len, ny = y / len, nz = z / len;
                
                // Smooth noise based on position
                const noise1 = Math.sin(nx * 3 + seed) * Math.cos(nz * 3 + seed) * 0.15;
                const noise2 = Math.sin(ny * 5 + seed * 2) * 0.1;
                const displacement = 1 + noise1 + noise2;
                
                // Flatten bottom slightly
                const flattenY = y < -0.3 ? 0.7 : 1;
                
                positions.setXYZ(i, 
                    x * displacement, 
                    y * displacement * flattenY * 0.75, 
                    z * displacement
                );
            }
            
            geo.computeVertexNormals();
            return geo;
        };
        
        // Create several rock variations
        const rockGeometries = [];
        for (let i = 0; i < 6; i++) {
            rockGeometries.push(createRockGeometry(i * 1.5));
        }
        
        // Place rocks
        for (let i = 0; i < rockCount; i++) {
            const angle = this.rand() * Math.PI * 2;
            const radius = 10 + this.rand() * 100;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            
            // Pick random geometry and material
            const geo = rockGeometries[Math.floor(this.rand() * rockGeometries.length)];
            const mat = rockMaterials[Math.floor(this.rand() * rockMaterials.length)];
            
            const rock = new THREE.Mesh(geo, mat);
            
            // Random scale - mostly medium rocks, some bigger
            const baseScale = this.rand() < 0.15 ? 1.1 + this.rand() * 1.1 : 0.5 + this.rand() * 0.8;
            rock.scale.set(
                baseScale * (0.9 + this.rand() * 0.2),
                baseScale * (0.6 + this.rand() * 0.4),
                baseScale * (0.9 + this.rand() * 0.2)
            );
            
            // Place on terrain, slightly buried
            this.placeOnTerrain(rock, x, z, -baseScale * 0.25);
            
            // Subtle random rotation
            rock.rotation.set(
                this.rand() * Math.PI * 0.15,
                this.rand() * Math.PI * 2,
                this.rand() * Math.PI * 0.15
            );
            
            rock.castShadow = true;
            rock.receiveShadow = true;
            
            this.scene.add(rock);
        }
    }
    
    createGrassVariety() {
        // Load grass texture
        const textureLoader = new THREE.TextureLoader();
        const grassTexture = textureLoader.load(grassTextureSrc);
        grassTexture.colorSpace = THREE.SRGBColorSpace;
        
        // Create grass material - alphaTest only (no transparency sorting issues)
        const grassMaterial = new THREE.MeshBasicMaterial({
            map: grassTexture,
            alphaTest: 0.5,
            side: THREE.DoubleSide
        });
        
        // Plane geometry for grass sprite (pivot at bottom)
        const grassGeo = new THREE.PlaneGeometry(1, 1);
        grassGeo.translate(0, 0.45, 0);
        
        // Total grass count - use InstancedMesh for performance
        const totalGrass = CONFIG.grassCount + CONFIG.grassTallCount;
        
        // Two instanced meshes for cross-billboard effect
        const instancedGrass1 = new THREE.InstancedMesh(grassGeo, grassMaterial, totalGrass);
        const instancedGrass2 = new THREE.InstancedMesh(grassGeo, grassMaterial, totalGrass);
        
        const dummy = new THREE.Object3D();
        
        for (let i = 0; i < totalGrass; i++) {
            const angle = this.rand() * Math.PI * 2;
            const radius = 8 + this.rand() * 110;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            const y = this.getTerrainHeight(x, z);
            
            // Random scale and rotation
            const scale = 0.8 + this.rand() * 1.5;
            const rotY = this.rand() * Math.PI;
            
            // First plane
            dummy.position.set(x, y, z);
            dummy.rotation.set(0, rotY, 0);
            dummy.scale.set(scale, scale, scale);
            dummy.updateMatrix();
            instancedGrass1.setMatrixAt(i, dummy.matrix);
            
            // Second plane at 90°
            dummy.rotation.y = rotY + Math.PI / 2;
            dummy.updateMatrix();
            instancedGrass2.setMatrixAt(i, dummy.matrix);
        }
        
        instancedGrass1.instanceMatrix.needsUpdate = true;
        instancedGrass2.instanceMatrix.needsUpdate = true;
        
        // Render grass before trees to avoid z-fighting
        instancedGrass1.renderOrder = 0;
        instancedGrass2.renderOrder = 0;
        
        this.scene.add(instancedGrass1);
        this.scene.add(instancedGrass2);
    }
    
    createFlowers() {
        const flowerMaterials = [
            this.materials.flowerRed,
            this.materials.flowerYellow,
            this.materials.flowerWhite,
            this.materials.flowerPurple,
            this.materials.flowerPink,
            this.materials.flowerOrange
        ];
        
        for (let i = 0; i < CONFIG.flowerCount; i++) {
            const angle = this.rand() * Math.PI * 2;
            const radius = 10 + this.rand() * 85;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            const flowerMat = flowerMaterials[Math.floor(this.rand() * flowerMaterials.length)];
            
            const flower = new THREE.Group();
            
            const stemHeight = 0.15 + this.rand() * 0.2;
            const stemGeo = new THREE.CylinderGeometry(0.015, 0.02, stemHeight, 4);
            const stem = new THREE.Mesh(stemGeo, this.materials.flowerStem);
            stem.position.y = stemHeight / 2;
            flower.add(stem);
            
            const headGeo = new THREE.SphereGeometry(0.05 + this.rand() * 0.03, 6, 6);
            const head = new THREE.Mesh(headGeo, flowerMat);
            head.position.y = stemHeight + 0.04;
            flower.add(head);
            
            this.placeOnTerrain(flower, x, z, 0);
            flower.scale.setScalar(0.8 + this.rand() * 0.5);
            this.scene.add(flower);
        }
    }
    
    createForest() {
        // Generate tree positions (InstancedMesh will be created when model loads)
        this.generateTreePositions();
    }
}
