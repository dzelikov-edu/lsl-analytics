import { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Alert, ScrollView, Image, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Head from 'expo-router/head';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppColors } from '@/constants/app-colors';
import { saveToken } from '@/lib/auth-storage';
import { API_BASE_URL } from '@/lib/api';

export default function ResetPasswordScreen() {
    const params = useLocalSearchParams<{ token?: string }>();
    const [token, setToken] = useState(params.token ?? '');
    const [password, setPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
    const theme = AppColors[colorScheme];

    useEffect(() => {
        if (typeof params.token === 'string') {
            setToken(params.token);
        }
    }, [params.token]);

    const handleReset = async () => {
        const tokenTrimmed = token.trim();
        const pwTrimmed = password.trim();
        const confirmTrimmed = confirm.trim();

        if (!tokenTrimmed || !pwTrimmed || !confirmTrimmed) {
            if (Platform.OS === 'web') window.alert("Missing info\n\nPlease fill in all fields.");
            else Alert.alert('Missing info', 'Please fill in all fields.');
            return;
        }

        if (pwTrimmed.length < 8) {
            if (Platform.OS === 'web') window.alert("Weak password\n\nPassword must be at least 8 characters long.");
            else Alert.alert('Weak password', 'Password must be at least 8 characters long.');
            return;
        }

        if (pwTrimmed !== confirmTrimmed) {
            if (Platform.OS === 'web') window.alert("Password mismatch\n\nPasswords do not match.");
            else Alert.alert('Password mismatch', 'Passwords do not match.');
            return;
        }

        if (loading) return;
        setLoading(true);

        try {
            const resp = await fetch(`${API_BASE_URL}/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: tokenTrimmed, new_password: pwTrimmed }),
            });

            const data = await resp.json();

            if (resp.ok && data?.access_token) {
                await saveToken(data.access_token);
                if (Platform.OS === 'web') window.alert("Password updated\n\nYou are now logged in with your new password.");
                else Alert.alert('Password updated', 'You are now logged in with your new password.');
                router.replace('/(tabs)');
            } else {
                const msg = data?.detail || 'Unable to reset password. Please check your token.';
                if (Platform.OS === 'web') window.alert(`Reset failed\n\n${msg}`);
                else Alert.alert('Reset failed', msg);
            }
        } catch (e) {
            console.error(e);
            if (Platform.OS === 'web') window.alert("Network error\n\nCould not connect to the server. Please try again.");
            else Alert.alert('Network error', 'Could not connect to the server. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}>
            <Image
                source={require('@/assets/images/index_header_icon.png')}
                style={styles.logo}
                resizeMode="contain"
            />
            <Text style={[styles.title, { color: theme.text }]}>Set a New Password</Text>
            <Text style={[styles.subtitle, { color: theme.mutedText }]}>
                Paste the reset token you received, then choose a new password.
            </Text>

            <TextInput
                style={[
                    styles.input,
                    { borderColor: theme.border, color: theme.text, height: 48 },
                ]}
                placeholder="Reset Code"
                placeholderTextColor={theme.mutedText}
                value={token}
                onChangeText={setToken}
                autoCapitalize="none"
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
                        placeholder="New password"
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
                        placeholder="Confirm new password"
                        placeholderTextColor={theme.mutedText}
                        value={confirm}
                        onChangeText={setConfirm}
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
                onPress={handleReset}
                disabled={loading}
            >
                {loading ? (
                    <ActivityIndicator color={theme.text} />
                ) : (
                    <Text style={{ color: theme.text, fontWeight: '600' }}>Update Password</Text>
                )}
            </Pressable>

            <Pressable onPress={() => router.push('/auth/login')} style={{ marginTop: 20 }}>
                <Text style={{ color: theme.text, textAlign: 'center' }}>Back to Login</Text>
            </Pressable>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flexGrow: 1, justifyContent: 'center', padding: 20 },
    logo: { width: 150, height: 60, alignSelf: 'center', marginBottom: 12 },
    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
    subtitle: { fontSize: 14, textAlign: 'center', marginBottom: 16 },
    input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 15 },
    button: { padding: 15, borderRadius: 8, alignItems: 'center', minHeight: 50, justifyContent: 'center' },
});
