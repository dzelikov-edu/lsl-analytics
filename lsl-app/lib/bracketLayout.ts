// lib/bracketLayout.ts

export const COLUMN_WIDTH = 300;
export const GAME_HEIGHT = 120;
export const VERTICAL_SPACING = 40;

/**
 * Calculates the X and Y coordinates for a game based on its round and slot.
 * This allows us to place 'Survival 16' games on the outer edges.
 */
export function getGameCoordinates(region: string, round: string, slot: number) {
    let x = 0;
    let y = slot * (GAME_HEIGHT + VERTICAL_SPACING);

    // X-Axis based on Round
    switch (round) {
        case 'Survival_16': x = 0; break;
        case 'Round_64': x = COLUMN_WIDTH; break;
        case 'Round_32': x = COLUMN_WIDTH * 2; break;
        case 'Sweet_16': x = COLUMN_WIDTH * 3; break;
        case 'Elite_8': x = COLUMN_WIDTH * 4; break;
        case 'National Semifinals': x = COLUMN_WIDTH * 5; break;
        case 'Championship': x = COLUMN_WIDTH * 6; break;
    }

    // Y-Axis adjustment based on Region to stack them vertically
    const regionOffset = {
        'East': 0,
        'Midwest': 2000,
        'South': 4000,
        'West': 6000,
        'Final Four': 3000
    }[region] || 0;

    return { x, y: y + regionOffset };
}
