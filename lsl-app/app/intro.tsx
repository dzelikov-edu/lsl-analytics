import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import * as Linking from 'expo-linking';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppColors } from '@/constants/app-colors';
import { router } from 'expo-router';
import { setHasSeenIntro } from '@/lib/firstLaunch';

export default function IntroScreen() {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = AppColors[colorScheme];

    const handleContinue = async () => {
        await setHasSeenIntro();
        router.replace('/auth/login');
    };

    return (
        <ScrollView contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}>
            <Text style={[styles.title, { color: theme.text }]}>Legends CBB</Text>

            <Text style={[styles.body, { color: theme.text, marginTop: 8 }]}>
                Welcome to a{' '}
                <Text style={{ fontWeight: '700' }}>completely simulated basketball universe</Text>.
                This is a fictional simulation engine designed for league management and analytics.
            </Text>

            <Text style={[styles.body, { color: theme.text, marginTop: 12 }]}>
                The league advances week‑by‑week with its own history and results. Inside, you’ll find:
            </Text>

            <View style={styles.bulletContainer}>
                <Text style={[styles.bullet, { color: theme.text }]}>
                    • <Text style={{ fontWeight: '600' }}>Dynamic Analytics:</Text> Power, Resume, and SOS tiers for 69 exclusively tracked programs.
                </Text>
                <Text style={[styles.bullet, { color: theme.text }]}>
                    • <Text style={{ fontWeight: '600' }}>Full Simulation:</Text> Detailed box scores and individual player stat averages.
                </Text>
                <Text style={[styles.bullet, { color: theme.text }]}>
                    • <Text style={{ fontWeight: '600' }}>Tournament Mode:</Text> Follow the evolving LCAA Tournament at‑large picture as the season progresses.
                </Text>
            </View>

            <Text style={[styles.body, { color: theme.mutedText, marginTop: 16 }]}>
                <Text style={{ fontStyle: 'italic' }}>Visual Note:</Text> This app uses a "Store-Safe" generic branding system by default. Members can apply custom visual packs via the Profile tab to personalize their simulation experience.
            </Text>

            <Text style={[styles.body, { color: theme.mutedText, marginTop: 16 }]}>
                Join the LSL Community:
            </Text>

            <View style={styles.socialContainer}>
                <Pressable onPress={() => Linking.openURL('https://instagram.com/legends.cbb')}>
                    <Text style={[styles.link, { color: '#007AFF' }]}>• Instagram</Text>
                </Pressable>
                <Pressable onPress={() => Linking.openURL('https://www.youtube.com/@legendscbb')}>
                    <Text style={[styles.link, { color: '#007AFF' }]}>• YouTube</Text>
                </Pressable>
                <Pressable onPress={() => Linking.openURL('https://discord.gg/4TwpUgqvA')}>
                    <Text style={[styles.link, { color: '#007AFF' }]}>• Discord Server</Text>
                </Pressable>
            </View>

            <Pressable
                onPress={handleContinue}
                style={({ pressed }) => [
                    styles.button,
                    { backgroundColor: theme.card, opacity: pressed ? 0.8 : 1 },
                ]}
            >
                <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16 }}>Enter Simulation</Text>
            </Pressable>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flexGrow: 1, justifyContent: 'center', padding: 24 },
    title: { fontSize: 32, fontWeight: '900', marginBottom: 12, textAlign: 'center' },
    body: { fontSize: 15, lineHeight: 22 },
    bulletContainer: { marginTop: 10 },
    bullet: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
    socialContainer: { marginTop: 8 },
    link: { fontSize: 15, lineHeight: 28, fontWeight: '600' },
    button: {
        marginTop: 32,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
});
