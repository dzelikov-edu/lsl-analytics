import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppColors } from '@/constants/app-colors';
import { saveToken } from '@/lib/auth-storage';
import { API_BASE_URL } from '@/lib/api';

export default function ResetPasswordScreen() {
    const params = useLocalSearchParams<{ token?: string }>();
    const [token, setToken] = useState(params.token ?? '');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [loading, setLoading] = useState(false);

    const colorScheme = useColorScheme() ?? 'light';
    const theme = AppColors[colorScheme];

    const handleReset = async () => {
        const tokenTrimmed = token.trim();
        const pwTrimmed = password.trim();
        const confirmTrimmed = confirm.trim();

        if (!tokenTrimmed || !pwTrimmed || !confirmTrimmed) {
            Alert.alert('Missing info', 'Please fill in all fields.');
            return;
        }

        if (pwTrimmed.length < 8) {
            Alert.alert('Weak password', 'Password must be at least 8 characters long.');
            return;
        }

        if (pwTrimmed !== confirmTrimmed) {
            Alert.alert('Password mismatch', 'Passwords do not match.');
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
                Alert.alert('Password updated', 'You are now logged in with your new password.');
                router.replace('/(tabs)');
            } else {
                Alert.alert('Reset failed', data?.detail || 'Unable to reset password. Please check your token.');
            }
        } catch (e) {
            console.error(e);
            Alert.alert('Network error', 'Could not connect to the server. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}>
            <Text style={[styles.title, { color: theme.text }]}>Set a New Password</Text>
            <Text style={[styles.subtitle, { color: theme.mutedText }]}>
                Paste the reset token you received, then choose a new password.
            </Text>

            <TextInput
                style={[styles.input, { borderColor: theme.border, color: theme.text }]}
                placeholder="Reset token"
                placeholderTextColor={theme.mutedText}
                value={token}
                onChangeText={setToken}
                autoCapitalize="none"
            />

            <TextInput
                style={[styles.input, { borderColor: theme.border, color: theme.text }]}
                placeholder="New password"
                placeholderTextColor={theme.mutedText}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
            />

            <TextInput
                style={[styles.input, { borderColor: theme.border, color: theme.text }]}
                placeholder="Confirm new password"
                placeholderTextColor={theme.mutedText}
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry
            />

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
    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
    subtitle: { fontSize: 14, textAlign: 'center', marginBottom: 16 },
    input: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 15 },
    button: { padding: 15, borderRadius: 8, alignItems: 'center', minHeight: 50, justifyContent: 'center' },
});
