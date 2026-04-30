import * as FileSystem from 'expo-file-system/legacy';
import { useState, useEffect } from 'react';

// We have removed the hardcoded 'require' statements to ensure the app 
// is compliant with App Store IP guidelines.
export const CONFERENCE_LOGOS: Record<string, any> = {};

/**
 * Custom hook to get the Conference logo source.
 * It checks local storage (Mod Pack) first. 
 * If no custom logo exists, it returns null, triggering the dynamic fallback 
 * in ConferenceLogo.tsx.
 */
export function useConferenceLogo(confId?: string | null) {
    const [logoSource, setLogoSource] = useState<any>(null);

    useEffect(() => {
        async function resolveLogo() {
            if (!confId) {
                setLogoSource(null);
                return;
            }

            const normalized = String(confId).trim().toUpperCase();

            // Path where 'Imported' (Realism Pack) conference logos live
            const localUri = `${FileSystem.documentDirectory}conference-logos/${normalized}.png`;

            try {
                const fileInfo = await FileSystem.getInfoAsync(localUri);
                if (fileInfo.exists) {
                    // Use the user-imported high-fidelity logo
                    setLogoSource({ uri: localUri });
                } else {
                    // Return null to show the dynamic generic trophy
                    setLogoSource(null);
                }
            } catch (e) {
                setLogoSource(null);
            }
        }

        resolveLogo();
    }, [confId]);

    return logoSource;
}

/**
 * Compatibility function. 
 * Since we no longer bundle logos, this always returns null.
 */
export function getConferenceLogo(confId?: string | null) {
    return null;
}
