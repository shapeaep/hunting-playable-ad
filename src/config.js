/**
 * Game configuration - all tunable parameters in one place
 */
export const CONFIG = {
    // Game settings
    animalCount: 6,
    showCtaAfterKills: 2,
    ctaUrl: 'https://play.google.com/store',
    
    // Camera
    towerHeight: 12,
    baseFov: 45,
    zoomedFov: 15,
    zoomSpeed: 0.08,
    sensitivity: 0.004,
    pitchLimit: { min: -0.6, max: 0.15 },
    cameraSmoothness: 0.06,  // Lower = more delay/smoothing (was 0.12)
    joystickSpeed: 2.0,      // Joystick rotation speed
    
    // Auto-aim (screen-space based)
    autoAim: {
        enabled: true,
        strength: 0.0004,     // Pull strength
        screenRadius: 250,    // Pixel radius from center to detect targets
        deadzone: 35          // Pixels - stop correcting when this close
    },
    
    // World generation
    groundSize: 300,
    treeCount: 120,
    grassCount: 500,
    groundPatchCount: 50,
    
    // Animals
    animalSpeed: { min: 1.5, max: 4 },
    spawnRadius: { min: 25, max: 70 },
    animalTypes: {
        deer: { chance: 0.65, points: 150, boundingRadius: 1.2 },
        boar: { chance: 0.35, points: 100, boundingRadius: 0.9 }
    },
    
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
            grass: 0x5a9a5e
        },
        
        tree: {
            trunk: 0x5d4037,
            leaves: [0x2d5a27, 0x3d7a37, 0x4d8a47, 0x3a6a30]
        },
        
        animals: {
            deer: { main: 0x9c6b4a, light: 0xc49a6c, antler: 0x8b7355 },
            boar: { main: 0x5c4033, dark: 0x3d2a22, snout: 0x7a5a4a }
        },
        
        bullet: 0xffcc00
    },
    
    // Rendering
    shadowMapSize: 2048,
    maxPixelRatio: 2,
    
    // UI
    shootCooldown: 500,
    respawnDelay: 2000
};

