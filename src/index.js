import './styles/main.css';
import sdk from '@smoud/playable-sdk';
import { Game } from './game/Game';
import logoSrc from './assets/logo.jpg';

/**
 * Entry point with Playable SDK integration
 * @see https://github.com/smoudjs/playable-sdk
 */

let game = null;

// Setup loading screen
function setupLoadingScreen() {
    const logoImg = document.getElementById('loading-logo');
    console.log('[Loading] Logo element:', logoImg, 'Logo src:', logoSrc);
    if (logoImg && logoSrc) {
        logoImg.src = logoSrc;
    }
}

// Update loading progress
function updateLoadingProgress(progress) {
    const bar = document.getElementById('loading-bar');
    const text = document.getElementById('loading-text');
    
    if (bar) bar.style.width = `${progress}%`;
    if (text) text.textContent = `Loading... ${Math.round(progress)}%`;
}

// Hide loading screen
function hideLoadingScreen() {
    const screen = document.getElementById('loading-screen');
    if (screen) {
        screen.classList.add('hidden');
        setTimeout(() => {
            screen.style.display = 'none';
        }, 500);
    }
}

// Make progress updater globally available
window.updateLoadingProgress = updateLoadingProgress;
window.hideLoadingScreen = hideLoadingScreen;

// Initialize loading screen when DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupLoadingScreen);
} else {
    setupLoadingScreen();
}

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
