import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppColors } from '@/constants/app-colors';
import { router } from 'expo-router';
import { deleteToken, getToken } from '@/lib/auth-storage';  // add getToken
import { useEffect, useState } from 'react';
import { API_BASE_URL } from '@/lib/api';


export default function ProfileScreen() {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = AppColors[colorScheme];

    const [user, setUser] = useState<{ email?: string; is_admin?: boolean } | null>(null);
    const [loadingUser, setLoadingUser] = useState(false);

    useEffect(() => {
        const loadUser = async () => {
            setLoadingUser(true);
            try {
                const token = await getToken();
                if (!token) return;

                const res = await fetch(`${API_BASE_URL}/auth/me`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });

                if (!res.ok) return;
                const data = await res.json();
                setUser({ email: data.email, is_admin: data.is_admin });
            } catch (e) {
                console.log('Error loading user', e);
            } finally {
                setLoadingUser(false);
            }
        };

        loadUser();
    }, []);


    const styles = StyleSheet.create({
        container: {
            flex: 1,
            padding: 20,
            backgroundColor: theme.background,
        },
        title: {
            fontSize: 28,
            fontWeight: '800',
            marginBottom: 8,
            color: theme.text,
        },
        subtitle: {
            fontSize: 15,
            color: theme.mutedText,
            marginBottom: 24,
        },
        button: {
            backgroundColor: theme.danger,
            paddingVertical: 14,
            borderRadius: 10,
            alignItems: 'center',
        },
        buttonText: {
            color: '#fff',
            fontWeight: '700',
            fontSize: 16,
        },
    });

    const handleLogout = async () => {
        await deleteToken();
        router.replace('/auth/login');
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Profile</Text>

            {loadingUser ? (
                <Text style={styles.subtitle}>Loading account...</Text>
            ) : user ? (
                <Text style={styles.subtitle}>
                    Signed in as {user.email}
                    {user.is_admin ? ' • Admin' : ''}
                </Text>
            ) : (
                <Text style={styles.subtitle}>Signed in</Text>
            )}

            <Pressable style={styles.button} onPress={handleLogout}>
                <Text style={styles.buttonText}>Log Out</Text>
            </Pressable>
        </View>
    );
}
