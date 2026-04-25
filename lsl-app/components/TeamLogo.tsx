import { AppColors } from '@/constants/app-colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getTeamBranding } from '@/lib/teamBranding';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image'; // Use the high-performance version


type TeamLogoProps = {
    teamId?: string | null;
    size?: number;
};

export default function TeamLogo({ teamId, size = 28 }: TeamLogoProps) {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = AppColors[colorScheme];
    const branding = getTeamBranding(teamId);

    if (branding.logo) {
        return (
            <Image
                source={branding.logo}
                contentFit="contain"
                // Remove the transition so it's instant, or set it to 0
                transition={0}
                style={{ width: size, height: size }}
            />

        );
    }

    return (
        <View
            style={[
                styles.fallback,
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    borderColor: theme.border,
                    backgroundColor: branding.primary,
                },
            ]}
        />
    );
}

const styles = StyleSheet.create({
    fallback: {
        borderWidth: 1,
    },
});