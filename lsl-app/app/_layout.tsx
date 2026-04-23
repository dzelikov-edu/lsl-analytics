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
  if (!Device.isDevice) {
    console.log('Push notifications only work on physical devices');
    return;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission not granted');
    return;
  }

  // We will fix this line in the next step - make sure Constants is imported
  const tokenData = await Notifications.getExpoPushTokenAsync({
    // @ts-ignore: Property 'eas' does not exist on type 'ExpoConfig'. It's there at runtime.
    projectId: Constants.expoConfig?.eas?.projectId, // Reads from app.json dynamically
  });
  const expoPushToken = tokenData.data;
  console.log('Expo push token:', expoPushToken);

  try {
    const backendUrl = Constants.expoConfig?.extra?.backendUrl || 'http://localhost:8000';
    const token = await getToken(); // 1. Get the real token from storage

    if (!token) {
      console.log('No auth token found, skipping device registration');
      return;
    }

    await fetch(`${backendUrl}/api/devices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`, // 2. Attach the real token
      },
      body: JSON.stringify({
        expoPushToken,
        deviceId: 'dev-ipad-1',
        platform: 'ios',
      }),
    });
    console.log('Device registered successfully');
  } catch (e) {
    console.log('Failed to register device on backend:', e);
  }
}


export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    const checkAuth = async () => {
      const token = await getToken();
      if (!token) {
        router.replace('/auth/login');
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