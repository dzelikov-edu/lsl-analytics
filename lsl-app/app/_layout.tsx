import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Asset } from 'expo-asset';
import Constants from 'expo-constants';
import { getToken } from '../lib/auth-storage';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { CONFERENCE_LOGOS } from '@/lib/conferenceLogos';
import { TEAM_LOGOS } from '@/lib/teamLogos';

export const unstable_settings = {
  anchor: '(tabs)',
};

async function registerForPushNotificationsAsync() {
  if (!Device.isDevice) return;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return;

    // --- SURGERY: Hardcode the Project ID for the Beta ---
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: "1123b7ce-5272-4e3c-a214-fca8911aa554",
    });
    const expoPushToken = tokenData.data;

    // --- SURGERY: Hardcode the Backend URL ---
    const backendUrl = 'https://lsl-backend.onrender.com';
    const token = await getToken();

    if (!token) return;

    await fetch(`${backendUrl}/api/devices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        expoPushToken,
        deviceId: Device.modelName || 'beta-device',
        platform: Device.osName?.toLowerCase() || 'ios',
      }),
    });
  } catch (e) {
    console.warn('Push registration failed silently:', e);
    // We don't throw an error here, so the app doesn't crash
  }
}


export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    const checkAuth = async () => {
      const token = await getToken();
      if (!token) {
        // Delay by 100ms to ensure the navigation tree is mounted
        setTimeout(() => {
          router.replace('/auth/login');
        }, 100);
      }
    };
    checkAuth();
  }, []);


  useEffect(() => {
    const preloadAssets = async () => {
      try {
        const allLogoModules = [
          ...Object.values(TEAM_LOGOS),
          ...Object.values(CONFERENCE_LOGOS),
        ].filter(Boolean);

        await Asset.loadAsync(allLogoModules);
      } catch (error) {
        console.warn('Logo preload failed:', error);
      }
    };

    preloadAssets();
  }, []);

  useEffect(() => {
    registerForPushNotificationsAsync();
  }, []);


  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="team" options={{ headerShown: false }} />
          <Stack.Screen name="conference" options={{ headerShown: false }} />
          <Stack.Screen name="player" options={{ headerShown: false }} />
          <Stack.Screen name="game" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}