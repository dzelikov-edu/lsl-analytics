import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { getToken } from '../lib/auth-storage';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Alert } from 'react-native';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getHasSeenIntro } from '../lib/firstLaunch';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function bootApp() {
      try {
        const [hasSeenIntro, token] = await Promise.all([
          getHasSeenIntro(),
          getToken(),
        ]);

        // Register notifications in background
        if (token) {
          registerNotifications(token).catch(console.warn);
        }

        // FORCE state to ready
        setIsReady(true);

        setTimeout(() => {
          try {
            if (!hasSeenIntro) {
              router.replace('/intro');
            } else if (!token) {
              router.replace('/auth/login');
            }
            // if we have a token + intro seen, stay on (tabs)
          } catch (e) { }
        }, 300);
      } catch (e: any) {
        setIsReady(true);
        Alert.alert("Beta Boot Error", e.message);
      }
    }
    bootApp();
  }, []);

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="intro" options={{ headerShown: false }} />
          <Stack.Screen name="auth" options={{ headerShown: false }} />
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

async function registerNotifications(token: string) {
  if (!Device.isDevice) return;
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;

  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: "1123b7ce-5272-4e3c-a214-fca8911aa554",
  });

  await fetch('https://lsl-backend.onrender.com/api/devices', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      expoPushToken: tokenData.data,
      deviceId: Device.modelName || 'beta-device',
      platform: Device.osName?.toLowerCase() || 'ios',
    }),
  });
}