import { AppColors } from '@/constants/app-colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Stack } from 'expo-router';

export default function PlayerStackLayout() {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = AppColors[colorScheme];

    return (
        <Stack
            screenOptions={{
                headerStyle: {
                    backgroundColor: theme.background,
                },
                headerTintColor: theme.text,
                headerTitleStyle: {
                    fontWeight: '700',
                    color: theme.text,
                },
                headerShadowVisible: false,
                headerTitleAlign: 'center',
                headerBackButtonDisplayMode: 'minimal',
            }}>
            <Stack.Screen
                name="[playerId]"
                options={{
                    title: 'Player',
                }}
            />
        </Stack>
    );
}