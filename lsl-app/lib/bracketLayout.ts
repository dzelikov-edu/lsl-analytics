// lib/bracketLayout.ts

export const COLUMN_WIDTH = 300;
export const GAME_HEIGHT = 80;
export const CENTER_X = 1800; // Pushed center further right for more breathing room

export function getGameCoordinates(region: string, round: string, slot: number, regionOrder: string[]) {
    // 1. Identify Side
    const isLeft = (region === regionOrder[0] || region === regionOrder[3]);

    // 2. Identify Vertical Block (Top vs Bottom)
    const isBottom = (region === regionOrder[2] || region === regionOrder[3]);

    // 3. Fixed Round Steps
    const roundStep = {
        'Survival_16': 0,
        'Round_64': 1,
        'Round_32': 2,
        'Sweet_16': 3,
        'Elite_8': 4,
        'National Semifinals': 5,
        'Championship': 6
    }[round] ?? 0;

    // 4. Horizontal (X) Positioning
    let x = 0;
    if (region === "Final Four" || round === "National Semifinals" || round === "Championship") {
        x = CENTER_X - 110;
    } else if (isLeft) {
        x = roundStep * COLUMN_WIDTH + 100;
    } else {
        x = (CENTER_X * 2) - (roundStep * COLUMN_WIDTH) - 320;
    }

    // 5. Vertical (Y) Positioning (The "Tree" Math)
    // We use a fixed multiplier so the slots never move, even if empty.
    const baselineY = (slot - 1) * 150;

    // Adjust vertical center based on round to create the "Tree" look
    const roundYOffsets = {
        'Survival_16': 0,
        'Round_64': 0,
        'Round_32': 75,
        'Sweet_16': 225,
        'Elite_8': 525
    };
    const yAdjustment = roundYOffsets[round as keyof typeof roundYOffsets] || 0;

    let y = baselineY + yAdjustment;

    // Fixed Regional Offsets (The "Planet" fix)
    const verticalOffset = isBottom ? 1500 : 200;

    // Final Four Specific Y
    if (region === "Final Four") {
        if (round === "Championship") return { x, y: 850 };
        return { x, y: slot === 1 ? 600 : 1100 };
    }

    return { x, y: y + verticalOffset };
}
