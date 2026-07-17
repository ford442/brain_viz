// mini-routines.js — barrel re-export for backward compatibility
import { MINI_ROUTINES_PART1 } from './mini-routines/part1.js';
import { MINI_ROUTINES_PART2 } from './mini-routines/part2.js';

export const MINI_ROUTINES = { ...MINI_ROUTINES_PART1, ...MINI_ROUTINES_PART2 };
