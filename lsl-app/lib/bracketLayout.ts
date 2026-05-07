// lib/bracketLayout.ts

export const COLUMN_WIDTH = 300; // Narrowed for tighter horizontal flow
export const GAME_HEIGHT = 80;
export const CENTER_X = 1818; // Recalculated horizontal center
export const CENTER_Y = 1000; // Pulled equator up to tighten spacing

export function getGameCoordinates(region: string, round: string, slot: number, regionOrder: string[]) {
    const isLeft = (region === regionOrder[0] || region === regionOrder[3]);
    const isBottom = (region === regionOrder[2] || region === regionOrder[3]);

    // 1. CENTER STAGE - TIGHTER BRIDGE
    if (region === "Forever Four" || round === "National Semifinals" || round === "Championship") {
        if (round === "Championship") return { x: CENTER_X - 110, y: CENTER_Y };
        // Pulled Semis significantly closer to Championship
        const semiX = (slot === 1) ? CENTER_X - 350 : CENTER_X + 130;
        return { x: semiX, y: CENTER_Y };
    }

    const roundYConfigs = {
        'Survival_16': { step: 0.8, gap: 105 },
        'Round_64': { step: 1.6, gap: 105 },
        'Round_32': { step: 2.4, gap: 210 },
        'Sweet_16': { step: 3.2, gap: 420 },
        'Elite_8': { step: 4, gap: 840 },
    };
    const config = roundYConfigs[round as keyof typeof roundYConfigs] || { step: 5, gap: 120 };
    let y = (slot - 1) * config.gap + (config.gap / 2) - (GAME_HEIGHT / 2);

    // 2. VERTICAL GRAVITY - PULLING REGIONS IN
    const verticalOffset = isBottom ? CENTER_Y + 100 : CENTER_Y - 850;

    // 3. HORIZONTAL SYMMETRY
    const horizontalPadding = isLeft ? 100 : CENTER_X + 300;
    let x = isLeft ? (config.step * COLUMN_WIDTH) : ((COLUMN_WIDTH * 4) - (config.step * COLUMN_WIDTH));

    return { x: x + horizontalPadding, y: y + verticalOffset };
}
