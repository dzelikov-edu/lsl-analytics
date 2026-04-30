// lib/bracketLayout.ts

export const COLUMN_WIDTH = 260;
export const GAME_HEIGHT = 100;
export const VERTICAL_SPACING = 30;
export const CENTER_X = 1500;

export function getGameCoordinates(region: string, round: string, slot: number, regionOrder: string[]) {
    const side = (region === regionOrder[0] || region === regionOrder[3]) ? 'LEFT' : 'RIGHT';

    let x = 0;
    let y = (slot - 1) * (GAME_HEIGHT + VERTICAL_SPACING);

    // Round Steps: Survival is now -1 to sit outside R64 (step 0)
    const roundStep = {
        'Survival_16': -1,
        'Round_64': 0,
        'Round_32': 1,
        'Sweet_16': 2,
        'Elite_8': 3,
    }[round] ?? 4;

    if (side === 'LEFT') {
        x = (roundStep + 1) * COLUMN_WIDTH;
    } else {
        // Right side flows inward
        x = (CENTER_X * 2) - ((roundStep + 1) * COLUMN_WIDTH) - 220;
    }

    if (region === "Final Four" || round === "National Semifinals" || round === "Championship") {
        x = CENTER_X - 110;
        y = (round === "Championship") ? 800 : (slot === 1 ? 400 : 1200);
        return { x, y };
    }

    const regionOffset = {
        [regionOrder[0]]: 0,
        [regionOrder[1]]: 0,
        [regionOrder[3]]: 1200,
        [regionOrder[2]]: 1200,
    }[region] || 0;

    return { x: x + 150, y: y + regionOffset + 250 };
}
