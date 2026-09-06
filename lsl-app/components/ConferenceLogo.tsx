import { AppColors } from '@/constants/app-colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getConferenceBranding } from '@/lib/conferenceBranding'; // Import your existing conference branding logic
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useConferenceLogo } from '@/lib/conferenceLogos'; // Import the new hook

// Path to your new transparent generic conference icon
const GENERIC_CONFERENCE_ICON = require('@/assets/images/generic_conference_icon.png');

type ConferenceLogoProps = {
    confId?: string | null;
    size?: number;
};

export default function ConferenceLogo({ confId, size = 28 }: ConferenceLogoProps) {
    const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
    const theme = AppColors[colorScheme];

    // Get conference branding for colors using your existing function
    const branding = getConferenceBranding(confId);

    // This hook now handles checking local storage. Returns {uri: localPath} or null.
    const resolvedLogo = useConferenceLogo(confId);

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

    // Fallback: Dynamically colored generic conference icon
    return (
        <View
            style={[
                styles.fallbackContainer, // Renamed from fallback to be specific
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2, // Make it a circle
                    backgroundColor: branding.primary, // Conference's primary color
                    borderColor: branding.secondary, // Conference's secondary color
                },
            ]}
        >
            {/* The transparent conference icon */}
            <Image
                source={GENERIC_CONFERENCE_ICON}
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
