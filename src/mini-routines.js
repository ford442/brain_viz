// mini-routines.js — barrel re-export for backward compatibility
import { MINI_ROUTINES_PART1 } from './mini-routines/part1.js';
import { MINI_ROUTINES_PART2 } from './mini-routines/part2.js';

export const MINI_ROUTINES = {
    ...MINI_ROUTINES_PART1,
    ...MINI_ROUTINES_PART2,
    'k': [ // Binaural Generation
        { time: 0.0, type: 'text', message: 'Entering Alpha State', duration: 2.0 },
        { time: 0.0, type: 'binaural', targetWave: 'alpha' },
        { time: 3.0, type: 'text', message: 'Descending to Theta', duration: 2.0 },
        { time: 3.0, type: 'binaural', targetWave: 'theta' }
    ],
    'f': [ // Focus State
        { time: 0.0, type: 'text', message: 'Sharpening Focus', duration: 2.0 },
        { time: 0.0, type: 'focus', value: 0.85 }
    ]
};
