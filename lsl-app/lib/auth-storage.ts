import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'lsl_auth_token';

export async function saveToken(token: string) {
    try {
        await SecureStore.setItemAsync(TOKEN_KEY, token);
    } catch (e) {
        console.error('Error saving token', e);
    }
}

export async function getToken() {
    try {
        return await SecureStore.getItemAsync(TOKEN_KEY);
    } catch (e) {
        console.error('Error getting token', e);
        return null;
    }
}

export async function deleteToken() {
    try {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch (e) {
        console.error('Error deleting token', e);
    }
}
