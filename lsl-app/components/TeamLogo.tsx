import { AppColors } from '@/constants/app-colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getTeamBranding } from '@/lib/teamBranding';
import { Image, StyleSheet, View } from 'react-native';

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
                style={{ width: size, height: size, resizeMode: 'contain' }}
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