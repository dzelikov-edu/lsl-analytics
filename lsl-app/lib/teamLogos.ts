import * as FileSystem from 'expo-file-system/legacy';
import { useState, useEffect } from 'react';

// We do NOT bundle official logos in the assets folder to ensure App Store compliance.
// This object is now empty to prevent any hardcoded references.
export const TEAM_LOGOS: Record<string, any> = {};

export function useTeamLogo(teamId?: string | null) {
    const [logoSource, setLogoSource] = useState<any>(null);

    useEffect(() => {
        async function resolveLogo() {
            if (!teamId) {
                setLogoSource(null);
                return;
            }
            const normalized = String(teamId).trim().toUpperCase();

            // Checks for user-imported logos in the phone's document directory
            const localUri = `${FileSystem.documentDirectory}team-logos/${normalized}.png`;

            try {
                const fileInfo = await FileSystem.getInfoAsync(localUri);
                if (fileInfo.exists) {
                    setLogoSource({ uri: localUri });
                } else {
                    // Falls back to null, triggering the generic basketball in TeamLogo.tsx
                    setLogoSource(null);
                }
            } catch {
                setLogoSource(null);
            }
        }
        resolveLogo();
    }, [teamId]);

    return logoSource;
}

// Compatibility function: always returns null because no logos are bundled.
export function getTeamLogo(teamId?: string | null) {
    return null;
}
