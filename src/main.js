import './styles/main.css';
import { Game } from './game/Game';

/**
 * Entry point - initialize and start the game
 */
const canvas = document.getElementById('game');

if (canvas) {
    const game = new Game(canvas);
    game.start();
} else {
    console.error('Canvas element not found');
}

