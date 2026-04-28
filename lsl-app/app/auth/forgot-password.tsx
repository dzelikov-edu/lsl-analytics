import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppColors } from '@/constants/app-colors';
import { API_BASE_URL } from '@/lib/api';

export default function ForgotPasswordScreen() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);

    const colorScheme = useColorScheme() ?? 'light';
    const theme = AppColors[colorScheme];

    const handleRequest = async () => {
        const emailTrimmed = email.trim();
        if (!emailTrimmed) {
            Alert.alert('Missing email', 'Please enter your email address.');
            return;
        }
        if (!emailTrimmed.includes('@') || !emailTrimmed.includes('.')) {
            Alert.alert('Invalid email', 'Please enter a valid email address.');
            return;
        }

        if (loading) return;
        setLoading(true);

        try {
            const resp = await fetch(`${API_BASE_URL}/auth/request-password-reset`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: emailTrimmed }),
            });

            const data = await resp.json();

            if (resp.ok) {
                if (data?.token) {
                    // Beta: we got a reset token directly
                    Alert.alert('Reset link created', 'A reset token was issued for this account.');
                    router.push({
                        pathname: '/auth/reset-password',
                        params: { token: data.token },
                    });
                } else {
                    Alert.alert(
                        'Check your email',
                        'If this email exists, a reset link has been created.'
                    );
                    router.back();
                }
            } else {
                Alert.alert('Error', data?.detail || 'Unable to create reset request. Please try again.');
            }
        } catch (e) {
            console.error(e);
            Alert.alert('Network error', 'Could not connect to the server. Please try again.');
        } finally {
            setLoading(false);
        }
    };


    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <Text style={[styles.title, { color: theme.text }]}>Reset Password</Text>
            <Text style={[styles.subtitle, { color: theme.mutedText }]}>
                Enter the email you used for Legends CBB. If it exists, we’ll create a reset link.
            </Text>

            <TextInput
                style={[styles.input, { borderColor: theme.border, color: theme.text }]}
                placeholder="Email"
                placeholderTextColor={theme.mutedText}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
            />

            <Pressable
                style={[styles.button, { backgroundColor: theme.card, opacity: loading ? 0.7 : 1 }]}
                onPress={handleRequest}
                disabled={loading}
            >
                {loading ? (
                    <ActivityIndicator color={theme.text} />
                ) : (
                    <Text style={{ color: theme.text, fontWeight: '600' }}>Send Reset Link</Text>
                )}
            </Pressable>

            <Pressable onPress={() => router.back()} style={{ marginTop: 20 }}>
                <Text style={{ color: theme.text, textAlign: 'center' }}>Back to Login</Text>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: 20 },
    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
    subtitle: { fontSize: 14, textAlign: 'center', marginBottom: 16 },
    input: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 15 },
    button: { padding: 15, borderRadius: 8, alignItems: 'center', minHeight: 50, justifyContent: 'center' },
});
