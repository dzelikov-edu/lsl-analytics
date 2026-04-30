import { AppColors } from '@/constants/app-colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getTeamBranding } from '@/lib/teamBranding'; // Import your existing team branding logic
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useTeamLogo } from '@/lib/teamLogos'; // Import the new hook

// Path to your new transparent generic basketball icon
const GENERIC_BASKETBALL_ICON = require('@/assets/images/generic_basketball_transparent.png');

type TeamLogoProps = {
    teamId?: string | null;
    size?: number;
};

export default function TeamLogo({ teamId, size = 28 }: TeamLogoProps) {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = AppColors[colorScheme];

    // Get team branding for colors using your existing function
    const branding = getTeamBranding(teamId);

    // This hook now handles checking local storage. Returns {uri: localPath} or null.
    const resolvedLogo = useTeamLogo(teamId);

    if (resolvedLogo) {
        // If an imported logo is found, render it normally
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
                styles.fallbackContainer, // Use the new style
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2, // Make it a circle
                    backgroundColor: branding.primary, // Team's primary color
                    borderColor: branding.secondary, // Team's secondary color
                },
            ]}
        >
            {/* The transparent basketball icon */}
            <Image
                source={GENERIC_BASKETBALL_ICON}
                contentFit="contain"
                transition={0}
                style={{ width: size * 0.7, height: size * 0.7 }} // Slightly smaller to show background
            />
        </View>
    );
}

const styles = StyleSheet.create({
    fallbackContainer: { // Renamed from fallback to be specific
        borderWidth: 1.5, // A visible border
        alignItems: 'center',
        justifyContent: 'center',
    },
});
