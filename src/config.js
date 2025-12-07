/**
 * Game configuration - all tunable parameters in one place
 */
export const CONFIG = {
    // Game settings
    animalCount: 1,  // Start with one animal at a time
    showCtaAfterKills: 3,  // Show CTA after 3 kills
    ctaUrl: 'https://play.google.com/store',
    autoRedirectDelay: 2000,  // Auto redirect after CTA shows (ms), 0 = disabled
    
    // Random seed (change for different world generation)
    worldSeed: 55452,
    
    // Camera settings
    towerHeight: 12,          // Camera height on tower
    cameraFollow: {
        smoothness: 0.08,     // LookAt smoothness (lower = smoother)
    },
    
    // FOV and aiming
    baseFov: 50,              // Normal FOV (watching)
    zoomedFov: 20,            // Zoomed FOV (aiming)
    zoomSpeed: 0.15,
    aimSensitivity: 0.002,    // How fast crosshair moves when aiming
    crosshairLimit: 0.35,     // Max crosshair offset from center
    
    // Camera shake on shoot
    cameraShake: {
        intensity: 0.02,       // Shake strength
        duration: 250,         // Shake duration in ms
        frequency: 30          // Shake frequency
    },
    
    // World generation
    groundSize: 300,
    treeCount: 175,
    grassCount: 15000,
    grassTallCount: 700,
    flowerCount: 700,
    rockCount: 250,
    groundPatchCount: 11,
    cloudCount: 155,
    terrainDistortion: 3,    // Height variation strength (0 = flat, 2 = hilly)
    
    // Mountains
    mountains: {
        enabled: true,
        count: 8,
        distance: 180,
        minHeight: 35,
        maxHeight: 65,
        minRadius: 35,
        maxRadius: 65
    },
    
    // Animals
    animalSpeed: { min: 1.5, max: 4 },
    spawnRadius: { min: 25, max: 70 },
    animalTypes: {
        deer: { chance: 0.45, points: 200, boundingRadius: 1, speedMultiplier: 1.0 },      // Level 3 - most expensive
        bear: { chance: 0.30, points: 150, boundingRadius: 1, speedMultiplier: 0.7 },      // Level 2 - medium (slower)
        rabbit: { chance: 0.25, points: 100, boundingRadius: 1, speedMultiplier: 1.5 }     // Level 1 - cheapest (faster)
    },
    
    // Spawn points - loaded from spawn-points.json at runtime
    // Use debug editor (press E in game) to place points
    spawnPoints: [],
    
    // Bullet time
    bulletTimeSpeed: 0.08,
    bulletTimeDuration: 2500,
    bulletSpeed: 80,
    
    // Colors
    colors: {
        sky: 0x87ceeb,
        skyBottom: 0xc9e4f2,
        fog: 0xa8c8d8,
        fogDensity: 0.008,
        
        ground: {
            main: 0x4a7c4e,
            dark: 0x3d6b41,
            light: 0x5d8f5a,
            grass: 0x5a9a5e,
            grassDark: 0x3d7a3d,
            grassLight: 0x7ab87a
        },
        
        flowers: {
            red: 0xe74c3c,
            yellow: 0xf1c40f,
            white: 0xffffff,
            purple: 0x9b59b6,
            pink: 0xff69b4,
            orange: 0xff8c00
        },
        
        mountain: {
            base: 0x5a6a7a,
            mid: 0x7a8a9a,
            snow: 0xe8eef5
        },
        
        tree: {
            trunk: 0x5d4037,
            leaves: [0x2d5a27, 0x3d7a37, 0x4d8a47, 0x3a6a30]
        },
        
        animals: {
            deer: { main: 0x9c6b4a, light: 0xc49a6c, antler: 0x8b7355 },
            bear: { main: 0x5c4033, dark: 0x3d2a22, snout: 0x7a5a4a },
            rabbit: { main: 0xd4c4b0, light: 0xf5f0e8, ear: 0xffcccc }
        },
        
        bullet: 0xffcc00
    },
    
    // Rendering
    shadowMapSize: 2048,
    maxPixelRatio: 2,
    
    // UI
    shootCooldown: 500,
    respawnDelay: 2000,
    
    // Spawn timing
    firstSpawnDelay: 500,      // Delay before first animal spawns (ms)
    nextSpawnDelay: 800,       // Delay before next animal spawns after kill (ms)
    
    // Audio
    audio: {
        enabled: true,
        ambientVolume: 0.3,
        sfxVolume: 0.7
    }
};

