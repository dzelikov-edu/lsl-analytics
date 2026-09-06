import { Tabs, router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

// --- ADDED IMPORTS FOR THE GATE ---
import { getToken } from '@/lib/auth-storage';
import { API_BASE_URL } from '@/lib/api';

export default function TabLayout() {
  const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const theme = Colors[colorScheme];
  const [isVerifying, setIsVerifying] = useState(true);

  // --- IDENTITY GATEKEEPER LOGIC ---
  useEffect(() => {
    async function checkIdentity() {
      try {
        const token = await getToken();
        if (!token) {
          // No token means they aren't logged in, login screen will handle them
          setIsVerifying(false);
          return;
        }

        const res = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (res.ok) {
          const userData = await res.json();
          // THE GATE: If username is missing (null or empty), redirect
          if (!userData.username) {
            router.replace('/auth/claim-identity');
          }
        }
      } catch (error) {
        console.log("Gatekeeper Error:", error);
      } finally {
        setIsVerifying(false);
      }
    }

    checkIdentity();
  }, []);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.tint,
        tabBarInactiveTintColor: theme.tabIconDefault, // <-- Add this line
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: theme.background,
          borderTopColor: theme.background,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="teams"
        options={{
          title: 'Teams',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.3.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Analytics',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="chart.bar.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="conferences"
        options={{
          title: 'Conferences',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="building.columns.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="bracket"
        options={{
          title: 'LCAA',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="trophy.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="rankings"
        options={{
          title: 'Rankings',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="list.number" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="person.crop.circle" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}