import { AppColors } from '@/constants/app-colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getConferenceLogo } from '@/lib/conferenceLogos';
import { Image, StyleSheet, View } from 'react-native';

type ConferenceLogoProps = {
    confId?: string | null;
    size?: number;
};

export default function ConferenceLogo({ confId, size = 28 }: ConferenceLogoProps) {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = AppColors[colorScheme];
    const logo = getConferenceLogo(confId);

    if (logo) {
        return (
            <Image
                source={logo}
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
                    backgroundColor: theme.card,
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