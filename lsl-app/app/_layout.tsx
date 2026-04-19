import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Asset } from 'expo-asset';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { CONFERENCE_LOGOS } from '@/lib/conferenceLogos';
import { TEAM_LOGOS } from '@/lib/teamLogos';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

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