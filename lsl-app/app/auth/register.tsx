import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppColors } from '@/constants/app-colors';
import Constants from 'expo-constants';
import { saveToken } from '../../lib/auth-storage';
import { API_BASE_URL } from '../../lib/api';

export default function RegisterScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [username, setUsername] = useState('');

    const colorScheme = useColorScheme() ?? 'light';
    const theme = AppColors[colorScheme];

    const handleRegister = async () => {
        if (loading) return;

        const emailTrimmed = email.trim();
        const passwordTrimmed = password.trim();
        const confirmTrimmed = confirmPassword.trim();
        const usernameTrimmed = username.trim().toLowerCase(); // Normalize to lowercase

        // 1. Basic Field Check
        if (!emailTrimmed || !passwordTrimmed || !confirmTrimmed || !usernameTrimmed) {
            Alert.alert('Missing info', 'Please fill in all fields.');
            return;
        }

        // 2. Identity Validation (Matches Backend)
        if (usernameTrimmed.length < 3 || usernameTrimmed.length > 20) {
            Alert.alert('Invalid Username', 'Username must be between 3 and 20 characters.');
            return;
        }

        // 3. Character Check (Alphanumeric/Underscore only)
        const usernameRegex = /^[a-zA-Z0-9_\.]+$/;
        if (!usernameRegex.test(usernameTrimmed)) {
            Alert.alert('Invalid Username', 'Usernames can only contain letters, numbers, underscores, and periods.');
            return;
        }

        if (!emailTrimmed.includes('@') || !emailTrimmed.includes('.')) {
            Alert.alert('Invalid email', 'Please enter a valid email address.');
            return;
        }

        if (passwordTrimmed.length < 8) {
            Alert.alert('Weak password', 'Password must be at least 8 characters long.');
            return;
        }

        if (passwordTrimmed !== confirmTrimmed) {
            Alert.alert('Password mismatch', 'Passwords do not match.');
            return;
        }

        setLoading(true);
        const backendUrl = API_BASE_URL;

        try {
            const response = await fetch(`${backendUrl}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // UPDATED PAYLOAD: Include the username
                body: JSON.stringify({
                    email: emailTrimmed,
                    password: passwordTrimmed,
                    username: usernameTrimmed
                }),
            });

            let data: any = {};
            try {
                data = await response.json();
            } catch {
                data = {};
            }

            if (response.ok && data?.access_token) {
                await saveToken(data.access_token);
                Alert.alert('Account created', 'Welcome to Legends CBB.');
                router.replace('/(tabs)');
            } else {
                // This will now catch the Backend "Lore-Gate" (Blacklist) errors
                const detail = data?.detail || 'Could not create account.';
                Alert.alert('Registration failed', detail);
            }
        } catch (error) {
            console.error(error);
            Alert.alert('Network error', 'Could not connect to the server.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}>
            <Text style={[styles.title, { color: theme.text }]}>Create Account</Text>

            <View style={{ marginBottom: 16 }}>
                <Text style={{ color: theme.mutedText, textAlign: 'center', fontSize: 14 }}>
                    Create a free profile to follow the Official Legends CBB Sim League.
                </Text>
                <Pressable onPress={() => router.push('/intro')} style={{ marginTop: 8 }}>
                    <Text style={{ color: '#007AFF', textAlign: 'center', fontSize: 13 }}>
                        What is Legends CBB?
                    </Text>
                </Pressable>
            </View>

            <TextInput
                style={[
                    styles.input,
                    { borderColor: theme.border, color: theme.text, height: 48 },
                ]}
                placeholder="Email"
                placeholderTextColor={theme.mutedText}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
            />

            <TextInput
                style={[
                    styles.input,
                    { borderColor: theme.border, color: theme.text, height: 48, marginBottom: 15 },
                ]}
                placeholder="Username"
                placeholderTextColor={theme.mutedText}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
            />

            <View style={{ marginBottom: 15 }}>
                <View
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        height: 48,
                    }}
                >
                    <TextInput
                        style={[
                            styles.input,
                            {
                                flex: 1,
                                borderColor: theme.border,
                                color: theme.text,
                                marginBottom: 0,
                                height: 48,
                                paddingVertical: 10,
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
                            height: 48,
                            justifyContent: 'center',
                        }}
                    >
                        <Text style={{ color: theme.mutedText, fontSize: 12 }}>
                            {showPassword ? 'Hide' : 'Show'}
                        </Text>
                    </Pressable>
                </View>
            </View>

            <View style={{ marginBottom: 15 }}>
                <View
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        height: 48,
                    }}
                >
                    <TextInput
                        style={[
                            styles.input,
                            {
                                flex: 1,
                                borderColor: theme.border,
                                color: theme.text,
                                marginBottom: 0,
                                height: 48,
                                paddingVertical: 10,
                            },
                        ]}
                        placeholder="Confirm Password"
                        placeholderTextColor={theme.mutedText}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry={!showConfirmPassword}
                    />

                    <Pressable
                        onPress={() => setShowConfirmPassword((v) => !v)}
                        style={{
                            marginLeft: 8,
                            paddingHorizontal: 6,
                            height: 48,
                            justifyContent: 'center',
                        }}
                    >
                        <Text style={{ color: theme.mutedText, fontSize: 12 }}>
                            {showConfirmPassword ? 'Hide' : 'Show'}
                        </Text>
                    </Pressable>
                </View>
            </View>

            <Pressable
                style={[styles.button, { backgroundColor: theme.card, opacity: loading ? 0.7 : 1 }]}
                onPress={handleRegister}
                disabled={loading}
            >
                {loading ? (
                    <ActivityIndicator color={theme.text} />
                ) : (
                    <Text style={{ color: theme.text, fontWeight: '600' }}>Sign Up</Text>
                )}
            </Pressable>

            <Pressable onPress={() => router.push('/auth/login')} style={{ marginTop: 20 }}>
                <Text style={{ color: theme.text, textAlign: 'center' }}>
                    Already have an account? <Text style={{ fontWeight: 'bold', color: '#007AFF' }}>Login</Text>
                </Text>
            </Pressable>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flexGrow: 1, justifyContent: 'center', padding: 20 },
    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
    input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 15 },
    button: { padding: 15, borderRadius: 8, alignItems: 'center', minHeight: 50, justifyContent: 'center' },
});
