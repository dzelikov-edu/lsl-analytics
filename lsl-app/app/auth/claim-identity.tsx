import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert, ActivityIndicator, Image } from 'react-native';
import { router } from 'expo-router';
import { API_BASE_URL } from '@/lib/api';
import { getToken } from '@/lib/auth-storage';
import { AppColors } from '@/constants/app-colors';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function ClaimIdentityScreen() {
    const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
    const theme = AppColors[colorScheme];
    const [username, setUsername] = useState('');
    const [loading, setLoading] = useState(false);

    const handleClaim = async () => {
        const sanitizedName = username.trim().toLowerCase();

        // Validation (Matches Backend Rules: 3-20, Alphanumeric/Periods)
        const usernameRegex = /^[a-zA-Z0-9_\.]+$/;
        if (sanitizedName.length < 3 || sanitizedName.length > 20) {
            Alert.alert("Invalid Length", "Your Legend ID must be 3-20 characters.");
            return;
        }
        if (!usernameRegex.test(sanitizedName)) {
            Alert.alert("Invalid Format", "Use only letters, numbers, underscores, and periods.");
            return;
        }

        setLoading(true);
        try {
            const token = await getToken();
            const res = await fetch(`${API_BASE_URL}/auth/username`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username: sanitizedName })
            });

            const data = await res.json();
            if (res.ok) {
                Alert.alert("Identity Claimed", "Welcome to the Universe, " + sanitizedName);
                router.replace('/(tabs)'); // The gate is now lifted
            } else {
                Alert.alert("Claim Failed", data.detail || "That ID might already be taken.");
            }
        } catch (e) {
            Alert.alert("Error", "Network error. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <Image
                source={require('@/assets/images/index_header_icon.png')}
                style={styles.logo}
                resizeMode="contain"
            />
            <Text style={[styles.title, { color: theme.text }]}>Set your Legends Universe ID</Text>
            <Text style={[styles.subtitle, { color: theme.mutedText }]}>
                Existing accounts are now required to set a unique username to continue in the simulation universe. Once you do this, you'll never see this screen again.
            </Text>

            <TextInput
                style={[styles.input, { borderColor: theme.border, color: theme.text }]}
                placeholder="Username"
                placeholderTextColor={theme.mutedText}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
            />

            <Pressable
                style={[styles.button, { backgroundColor: theme.card, opacity: loading ? 0.7 : 1 }]}
                onPress={handleClaim}
                disabled={loading}
            >
                {loading ? <ActivityIndicator color={theme.text} /> : <Text style={[styles.buttonText, { color: theme.text }]}>Verify Identity</Text>}
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: 30 },
    logo: { width: 150, height: 60, alignSelf: 'center', marginBottom: 12 },
    title: { fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 10 },
    subtitle: { fontSize: 14, textAlign: 'center', marginBottom: 30, lineHeight: 20 },
    input: { height: 50, borderWidth: 1, borderRadius: 10, paddingHorizontal: 15, marginBottom: 20, fontSize: 16 },
    button: { height: 50, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    buttonText: { fontSize: 16, fontWeight: '700' }
});
