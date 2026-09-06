import { View, Text, StyleSheet, Pressable, ScrollView, Image } from 'react-native';
import * as Linking from 'expo-linking';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppColors } from '@/constants/app-colors';
import { router } from 'expo-router';
import { setHasSeenIntro } from '@/lib/firstLaunch';

export default function IntroScreen() {
    const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
    const theme = AppColors[colorScheme];

    const handleContinue = async () => {
        await setHasSeenIntro();
        router.replace('/auth/login');
    };

    return (
        <ScrollView contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}>
            <Image
                source={require('@/assets/images/index_header_icon.png')}
                style={styles.logo}
                resizeMode="contain"
            />

            <Text style={[styles.title, { color: theme.text }]}>LEGENDS CBB</Text>

            <Text style={[styles.body, { color: theme.text, marginTop: 0 }]}>
                Welcome to a{' '}
                <Text style={{ fontWeight: '700' }}>completely simulated basketball universe</Text>.
                This is the ultimate league management app which allows you to follow your favorite LSL teams, players, and the all new LSL analytics.
            </Text>

            <Text style={[styles.body, { color: theme.text, marginTop: 12 }]}>
                The league advances week‑by‑week with its own game history and results. Inside, you’ll find:
            </Text>

            <View style={styles.bulletContainer}>
                <Text style={[styles.bullet, { color: theme.text }]}>
                    • <Text style={{ fontWeight: '600' }}>Dynamic Analytics:</Text> Power, Resume, and SOS tiers for 69 exclusively tracked programs.
                </Text>
                <Text style={[styles.bullet, { color: theme.text }]}>
                    • <Text style={{ fontWeight: '600' }}>Full Simulation Tracking:</Text> Access to past and future games, and individual player stat averages.
                </Text>
                <Text style={[styles.bullet, { color: theme.text }]}>
                    • <Text style={{ fontWeight: '600' }}>Tournament Mode:</Text> Follow the evolving LCAA Tournament at‑large picture as the season progresses, with timely bracketology updates, and an eventual flip of the switch to LCAA Tournament Mode.
                </Text>
            </View>

            <Text style={[styles.body, { color: theme.mutedText, marginTop: 16 }]}>
                <Text style={{ fontStyle: 'italic' }}>Visual Note:</Text> This app utilizes a custom simulation branding system by default. Users may further personalize their simulation universe by applying external community branding packs via the Profile tab.
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
    logo: { width: 150, height: 60, alignSelf: 'center', marginBottom: 10, marginTop: 20 },
    headerTitle: { fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
    headerSubtitle: { fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
});
