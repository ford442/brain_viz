// Extracted from main.js — Paint Energy click-drag brush wiring.
import { PaintController } from './paint-controller.js';

export function setupPaintIntegration(renderer, canvas, player) {
    const paintController = new PaintController(renderer, canvas, player);
    player.paintController = paintController;
    return paintController;
}
