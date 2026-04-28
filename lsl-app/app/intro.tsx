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
            <Text style={[styles.title, { color: theme.text }]}>Welcome to Legends CBB</Text>

            <Text style={[styles.body, { color: theme.text, marginTop: 8 }]}>
                Legends CBB is a{' '}
                <Text style={{ fontWeight: '700' }}>simulated college basketball universe</Text>, not a live NCAA stats app.
            </Text>

            <Text style={[styles.body, { color: theme.text, marginTop: 12 }]}>
                Each season advances week‑by‑week. After each simulated week, the league gets updated and you’ll see:
            </Text>

            <Text style={[styles.bullet, { color: theme.text }]}>
                • Full schedules, final scores, and individual player stat averages
            </Text>
            <Text style={[styles.bullet, { color: theme.text }]}>
                • Power, Resume, and SOS tiers for 69 exclusively tracked programs
            </Text>
            <Text style={[styles.bullet, { color: theme.text }]}>
                • Tie‑aware conference standings and an evolving LCAA Tournament at‑large picture
            </Text>

            <Text style={[styles.body, { color: theme.mutedText, marginTop: 16 }]}>
                Think of this as a custom CBB league where you can scout, follow teams, and study the LCAA Tournament landscape as it takes shape week‑by‑week.
            </Text>

            <Text style={[styles.body, { color: theme.mutedText, marginTop: 16 }]}>
                Want to go deeper? Join the community:
            </Text>

            <Pressable
                onPress={() => Linking.openURL('https://instagram.com/legends.cbb')}
            >
                <Text style={[styles.bullet, { color: '#007AFF' }]}>
                    • Instagram: <Text style={{ fontWeight: '700' }}>@legends.cbb</Text>
                </Text>
            </Pressable>
            <Pressable
                onPress={() => Linking.openURL('https://www.youtube.com/@legendscbb')}
            >
                <Text style={[styles.bullet, { color: '#007AFF' }]}>
                    • YouTube: <Text style={{ fontWeight: '700' }}>Legends CBB</Text>
                </Text>
            </Pressable>
            <Pressable
                onPress={() => Linking.openURL('https://www.twitch.tv/legendscbb')}
            >
                <Text style={[styles.bullet, { color: '#007AFF' }]}>
                    • Twitch: <Text style={{ fontWeight: '700' }}>LegendsCBB</Text>
                </Text>
            </Pressable>
            <Pressable
                onPress={() => Linking.openURL('https://discord.gg/4TwpUgqvA')}
            >
                <Text style={[styles.bullet, { color: '#007AFF' }]}>
                    • Discord: <Text style={{ fontWeight: '700' }}>LSL League Server</Text>
                </Text>
            </Pressable>

            <Pressable
                onPress={handleContinue}
                style={({ pressed }) => [
                    styles.button,
                    { backgroundColor: theme.card, opacity: pressed ? 0.8 : 1 },
                ]}
            >
                <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16 }}>Get Started</Text>
            </Pressable>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flexGrow: 1, justifyContent: 'center', padding: 20 },
    title: { fontSize: 28, fontWeight: '800', marginBottom: 18, textAlign: 'center' },
    body: { fontSize: 15, lineHeight: 22 },
    bullet: { fontSize: 15, lineHeight: 22, marginTop: 6 },
    button: {
        marginTop: 28,
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center',
    },
});
