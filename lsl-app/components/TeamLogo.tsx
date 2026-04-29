import { AppColors } from '@/constants/app-colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getTeamBranding } from '@/lib/teamBranding';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image'; // Use the high-performance version
import { useTeamLogo } from '@/lib/teamLogos';


type TeamLogoProps = {
    teamId?: string | null;
    size?: number;
};

export default function TeamLogo({ teamId, size = 28 }: TeamLogoProps) {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = AppColors[colorScheme];
    const branding = getTeamBranding(teamId);

    // Switch to the hook
    const resolvedLogo = useTeamLogo(teamId);

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

    return (
        <View style={[styles.fallback, { width: size, height: size, backgroundColor: branding.primary, borderRadius: size / 2 }]} />
    );
}

const styles = StyleSheet.create({
    fallback: {
        borderWidth: 1,
    },
});