import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppColors } from '@/constants/app-colors';
import Constants from 'expo-constants';
import { saveToken } from '../../lib/auth-storage';
import { API_BASE_URL } from '../../lib/api';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const colorScheme = useColorScheme() ?? 'light';
    const theme = AppColors[colorScheme];

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        setLoading(true);
        // Replace the Constants logic with our forced API URL
        const backendUrl = API_BASE_URL;

        try {
            const response = await fetch(`${backendUrl}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (response.ok) {
                await saveToken(data.access_token);
                Alert.alert('Success', 'Logged in successfully!');
                // replace ensures the user can't just press "back" to go back to the login screen
                router.replace('/(tabs)');
            } else {
                Alert.alert('Login Failed', data.detail || 'Invalid credentials');
            }
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Could not connect to the server');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <Text style={[styles.title, { color: theme.text }]}>Legends CBB Login</Text>

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

            <Pressable onPress={() => router.push('/auth/register')} style={{ marginTop: 20 }}>
                <Text style={{ color: theme.text, textAlign: 'center' }}>
                    Don't have an account? <Text style={{ fontWeight: 'bold', color: '#007AFF' }}>Sign Up</Text>
                </Text>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: 20 },
    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
    input: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 15 },
    button: { padding: 15, borderRadius: 8, alignItems: 'center', minHeight: 50, justifyContent: 'center' },
});
