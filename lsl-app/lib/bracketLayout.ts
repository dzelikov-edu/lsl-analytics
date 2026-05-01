// lib/bracketLayout.ts

export const COLUMN_WIDTH = 300;
export const GAME_HEIGHT = 80; // Shorter cards for better density
export const CENTER_X = 1600;

export function getGameCoordinates(region: string, round: string, slot: number, regionOrder: string[]) {
    const side = (region === regionOrder[0] || region === regionOrder[3]) ? 'LEFT' : 'RIGHT';

    // THE VERTICAL CENTERING LOGIC
    // Round 64 is the baseline. 
    // Round 32 is centered between 2 R64s. 
    // Round 16 is centered between 2 R32s, etc.
    const getSpacing = (roundName: string) => {
        switch (roundName) {
            case 'Survival_16': return 120;
            case 'Round_64': return 120;
            case 'Round_32': return 240;
            case 'Sweet_16': return 480;
            case 'Elite_8': return 960;
            default: return 120;
        }
    };

    const spacing = getSpacing(round);
    let x = 0;
    // Calculate Y so that higher rounds sit in the middle of their children
    let y = (slot - 1) * spacing + (spacing / 4);

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
        x = (CENTER_X * 2) - ((roundStep + 1) * COLUMN_WIDTH) - 220;
    }

    if (region === "Final Four" || round === "National Semifinals" || round === "Championship") {
        x = CENTER_X - 110;
        y = (round === "Championship") ? 1000 : (slot === 1 ? 500 : 1500);
        return { x, y };
    }

    const regionOffset = (region === regionOrder[3] || region === regionOrder[2]) ? 2200 : 0;

    return { x: x + 150, y: y + regionOffset + 200 };
}
