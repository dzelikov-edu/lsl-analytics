import { AppColors } from '@/constants/app-colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getTeamBranding } from '@/lib/teamBranding';
import { StyleSheet, View, Platform } from 'react-native'; // <-- Added Platform here
import { Image } from 'expo-image';
import { useTeamLogo } from '@/lib/teamLogos';

const GENERIC_BASKETBALL_ICON = require('@/assets/images/generic_basketball_transparent.png');

// Define your direct GitHub raw content URL here:
// Replace username, repo-name, and branch (main/master) with your actual details
const GITHUB_RAW_BASE_URL = 'https://raw.githubusercontent.com/dzelikov-edu/lsl-realism-mods/main';

type TeamLogoProps = {
    teamId?: string | null;
    size?: number;
};

export default function TeamLogo({ teamId, size = 28 }: TeamLogoProps) {
    const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
    const theme = AppColors[colorScheme];

    const branding = getTeamBranding(teamId);
    const resolvedLogo = useTeamLogo(teamId);

    // --- NEW WEB LOGIC ---
    // If running on the web, bypass local storage and fetch directly from GitHub
    if (Platform.OS === 'web' && teamId) {
        return (
            <Image
                source={{ uri: `${GITHUB_RAW_BASE_URL}/team-logos/${teamId}.png` }}
                contentFit="contain"
                transition={0}
                style={{ width: size, height: size }}
            />
        );
    }
    // ---------------------

    // Original Mobile Logic: If a local downloaded logo is found, render it
    if (resolvedLogo) {
        return (
            <Image
                source={resolvedLogo}
                contentFit="contain"
                transition={0}
                style={{ width: size, height: size }}
            />
        );
    }

    // Fallback: Dynamically colored generic basketball icon
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
                source={GENERIC_BASKETBALL_ICON}
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