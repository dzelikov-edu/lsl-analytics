import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Alert, Image, Platform } from 'react-native';
import { router } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppColors } from '@/constants/app-colors';
import Constants from 'expo-constants';
import { saveToken } from '../../lib/auth-storage';
import { API_BASE_URL } from '../../lib/api';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
    const theme = AppColors[colorScheme];

    const handleLogin = async () => {
        if (loading) return;

        // 'email' variable now represents the Identity (Email or Username)
        const identifierTrimmed = email.trim();
        const passwordTrimmed = password.trim();

        if (!identifierTrimmed || !passwordTrimmed) {
            if (Platform.OS === 'web') window.alert("Missing info\n\nPlease enter both your identity and password.");
            else Alert.alert('Missing info', 'Please enter both your identity and password.');
            return;
        }

        // SURGICAL REMOVAL: The email .includes('@') check is gone 
        // to allow usernames to pass through.

        setLoading(true);
        const backendUrl = API_BASE_URL;

        try {
            const response = await fetch(`${backendUrl}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // We still send the key as 'email' because that's what the 
                // backend LoginRequest schema expects.
                body: JSON.stringify({ email: identifierTrimmed, password: passwordTrimmed }),
            });

            let data: any = {};
            try {
                data = await response.json();
            } catch {
                data = {};
            }

            if (response.ok && data?.access_token) {
                await saveToken(data.access_token);
                if (Platform.OS === 'web') window.alert("Welcome back\n\nYou are now logged in.");
                else Alert.alert('Welcome back', 'You are now logged in.');
                router.replace('/(tabs)');
            } else {
                // Updated error message to be more generic for usernames
                const detail = data?.detail || 'Identity or password is incorrect.';
                if (Platform.OS === 'web') window.alert(`Login failed\n\n${detail}`);
                else Alert.alert('Login failed', detail);
            }
        } catch (error) {
            console.error(error);
            if (Platform.OS === 'web') window.alert("Network error\n\nCould not connect to the server.");
            else Alert.alert('Network error', 'Could not connect to the server.');
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

            <Text style={[styles.title, { color: theme.text }]}>Legends CBB Login</Text>

            <View style={{ marginBottom: 16 }}>
                <Text style={{ color: theme.mutedText, textAlign: 'center', fontSize: 14 }}>
                    Log in to your Legends CBB league profile to sync favorites and alerts.
                </Text>
                <Pressable onPress={() => router.push('/intro')} style={{ marginTop: 8 }}>
                    <Text style={{ color: '#007AFF', textAlign: 'center', fontSize: 13 }}>
                        What is Legends CBB?
                    </Text>
                </Pressable>
            </View>

            <TextInput
                style={[styles.input, { borderColor: theme.border, color: theme.text, height: 48 }]}
                placeholder="Email or Username"
                placeholderTextColor={theme.mutedText}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="default"
            />

            <View style={{ marginBottom: 15 }}>
                <View
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        height: 48, // match input height
                    }}
                >
                    <TextInput
                        style={[
                            styles.input,
                            {
                                flex: 1,
                                borderColor: theme.border,
                                color: theme.text,
                                marginBottom: 0, // avoid extra spacing inside row
                                height: 48,
                            },
                        ]}
                        placeholder="Password"
                        placeholderTextColor={theme.mutedText}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                    />

                    <Pressable
                        onPress={() => setShowPassword((v) => !v)}
                        style={{
                            marginLeft: 8,
                            paddingHorizontal: 6,
                            height: 48,              // same as input
                            justifyContent: 'center', // vertical center
                        }}
                    >
                        <Text style={{ color: theme.mutedText, fontSize: 12 }}>
                            {showPassword ? 'Hide' : 'Show'}
                        </Text>
                    </Pressable>
                </View>
            </View>

            <Pressable
                style={[styles.button, { backgroundColor: theme.card, opacity: loading ? 0.7 : 1 }]}
                onPress={handleLogin}
                disabled={loading}
            >
                {loading ? (
                    <ActivityIndicator color={theme.text} />
                ) : (
                    <Text style={{ color: theme.text, fontWeight: '600' }}>Login</Text>
                )}
            </Pressable>

            <Pressable
                onPress={() => router.push('/auth/forgot-password')}
                style={{ marginTop: 14 }}
            >
                <Text style={{ color: '#007AFF', textAlign: 'center', fontSize: 13 }}>
                    Forgot your password?
                </Text>
            </Pressable>

            <Pressable onPress={() => router.push('/auth/register')} style={{ marginTop: 20 }}>
                <Text style={{ color: theme.text, textAlign: 'center' }}>
                    Don't have an account? <Text style={{ fontWeight: 'bold', color: '#007AFF' }}>Sign Up</Text>
                </Text>
            </Pressable>
        </View>
    );
}

export const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: 20 },
    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
    input: { borderWidth: 1, borderRadius: 8, padding: 12, paddingVertical: 10, marginBottom: 15 },
    button: { padding: 15, borderRadius: 8, alignItems: 'center', minHeight: 50, justifyContent: 'center' },
    logo: { width: 150, height: 60, alignSelf: 'center', marginBottom: 10, marginTop: 20 },
    headerTitle: { fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
    headerSubtitle: { fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
});
