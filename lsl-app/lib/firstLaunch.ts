// lib/firstLaunch.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const INTRO_KEY = 'hasSeenIntro-v1';

export async function getHasSeenIntro(): Promise<boolean> {
    try {
        const v = await AsyncStorage.getItem(INTRO_KEY);
        return v === 'true';
    } catch {
        return false;
    }
}

export async function setHasSeenIntro(): Promise<void> {
    try {
        await AsyncStorage.setItem(INTRO_KEY, 'true');
    } catch {
        // no-op
    }
}
