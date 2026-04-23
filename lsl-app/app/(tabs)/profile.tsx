import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppColors } from '@/constants/app-colors';
import { router } from 'expo-router';
import { deleteToken } from '@/lib/auth-storage';

export default function ProfileScreen() {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = AppColors[colorScheme];

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
            <Text style={styles.subtitle}>
                Manage your account and sign out of Legends CBB.
            </Text>

            <Pressable style={styles.button} onPress={handleLogout}>
                <Text style={styles.buttonText}>Log Out</Text>
            </Pressable>
        </View>
    );
}
