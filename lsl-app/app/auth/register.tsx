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

    const colorScheme = useColorScheme() ?? 'light';
    const theme = AppColors[colorScheme];

    const handleRegister = async () => {
        if (!email || !password || !confirmPassword) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        if (password !== confirmPassword) {
            Alert.alert('Error', 'Passwords do not match');
            return;
        }

        setLoading(true);
        // Replace the Constants logic with our forced API URL
        const backendUrl = API_BASE_URL;

        try {
            const response = await fetch(`${backendUrl}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (response.ok) {
                await saveToken(data.access_token);
                Alert.alert('Success', 'Account created successfully!');
                router.replace('/(tabs)');
            } else {
                Alert.alert('Registration Failed', data.detail || 'Could not create account');
            }
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Could not connect to the server');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}>
            <Text style={[styles.title, { color: theme.text }]}>Create Account</Text>

            <TextInput
                style={[styles.input, { borderColor: theme.border, color: theme.text }]}
                placeholder="Email"
                placeholderTextColor={theme.mutedText}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
            />

            <TextInput
                style={[styles.input, { borderColor: theme.border, color: theme.text }]}
                placeholder="Password"
                placeholderTextColor={theme.mutedText}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
            />

            <TextInput
                style={[styles.input, { borderColor: theme.border, color: theme.text }]}
                placeholder="Confirm Password"
                placeholderTextColor={theme.mutedText}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
            />

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
    input: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 15 },
    button: { padding: 15, borderRadius: 8, alignItems: 'center', minHeight: 50, justifyContent: 'center' },
});
