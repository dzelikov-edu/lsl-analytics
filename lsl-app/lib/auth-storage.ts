import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'lsl_auth_token';

export async function saveToken(token: string) {
    try {
        if (Platform.OS === 'web') {
            localStorage.setItem(TOKEN_KEY, token);
        } else {
            await SecureStore.setItemAsync(TOKEN_KEY, token);
        }
    } catch (e) {
        console.error('Error saving token', e);
    }
}

export async function getToken() {
    try {
        if (Platform.OS === 'web') {
            // Check if window exists to prevent server-side rendering crashes
            return typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
        } else {
            return await SecureStore.getItemAsync(TOKEN_KEY);
        }
    } catch (e) {
        console.error('Error getting token', e);
        return null;
    }
}

export async function deleteToken() {
    try {
        if (Platform.OS === 'web') {
            localStorage.removeItem(TOKEN_KEY);
        } else {
            await SecureStore.deleteItemAsync(TOKEN_KEY);
        }
    } catch (e) {
        console.error('Error deleting token', e);
    }
}