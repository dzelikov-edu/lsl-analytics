import { AppColors } from '@/constants/app-colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getConferenceBranding } from '@/lib/conferenceBranding';
import { StyleSheet, View, Platform } from 'react-native'; // <-- Added Platform here
import { Image } from 'expo-image';
import { useConferenceLogo } from '@/lib/conferenceLogos';

// Path to your new transparent generic conference icon
const GENERIC_CONFERENCE_ICON = require('@/assets/images/generic_conference_icon.png');

// GitHub raw content URL for web bypass
const GITHUB_RAW_BASE_URL = 'https://raw.githubusercontent.com/dzelikov-edu/lsl-realism-mods/main';

type ConferenceLogoProps = {
    confId?: string | null;
    size?: number;
};

export default function ConferenceLogo({ confId, size = 28 }: ConferenceLogoProps) {
    const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
    const theme = AppColors[colorScheme];

    // Get conference branding for colors using your existing function
    const branding = getConferenceBranding(confId);

    // This hook handles checking local storage for mobile. Returns {uri: localPath} or null.
    const resolvedLogo = useConferenceLogo(confId);

    // --- NEW WEB LOGIC (Copied from TeamLogo) ---
    // If running on the web, bypass local storage and fetch directly from GitHub
    if (Platform.OS === 'web' && confId) {
        const normalizedId = String(confId).trim().toUpperCase();
        return (
            <Image
                source={{ uri: `${GITHUB_RAW_BASE_URL}/conference-logos/${normalizedId}.png` }}
                contentFit="contain"
                transition={0}
                style={{ width: size, height: size }}
            />
        );
    }
    // ---------------------

    if (resolvedLogo) {
        // If an imported logo is found on mobile, render it normally
        return (
            <Image
                source={resolvedLogo}
                contentFit="contain"
                transition={0}
                style={{ width: size, height: size }}
            />
        );
    }

    // Fallback: Dynamically colored generic conference icon
    return (
        <View
            style={[
                styles.fallbackContainer,
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: branding.primary,
                    borderColor: branding.secondary,
                },
            ]}
        >
            <Image
                source={GENERIC_CONFERENCE_ICON}
                contentFit="contain"
                transition={0}
                style={{ width: size * 0.7, height: size * 0.7 }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    fallbackContainer: {
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
});