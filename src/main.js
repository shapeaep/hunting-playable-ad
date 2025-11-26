import './styles/main.css';
import sdk from '@smoud/playable-sdk';
import { Game } from './game/Game';

/**
 * Entry point with Playable SDK integration
 * @see https://github.com/smoudjs/playable-sdk
 */

let game = null;

// Initialize SDK
sdk.init((width, height) => {
    console.log(`[SDK] Initialized with size: ${width}x${height}`);
    
    const canvas = document.getElementById('game');
    if (canvas) {
        game = new Game(canvas);
    }
});

// Handle resize events
sdk.on('resize', (width, height) => {
    console.log(`[SDK] Resize: ${width}x${height}`);
    game?.resize();
});

// Handle pause/resume
sdk.on('pause', () => {
    console.log('[SDK] Paused');
    // Could pause game animations here
});

sdk.on('resume', () => {
    console.log('[SDK] Resumed');
    // Could resume game animations here
});

// Handle volume changes
sdk.on('volume', (level) => {
    console.log(`[SDK] Volume: ${level}`);
    // Could adjust game audio here
});

// When resources are loaded, start the playable
sdk.on('ready', () => {
    console.log('[SDK] Ready');
    
    // Start the game
    if (game) {
        game.start();
        sdk.start();
    }
});

// Handle finish event
sdk.on('finish', () => {
    console.log('[SDK] Finished');
});

// Export for use in Game.js
export { sdk };
