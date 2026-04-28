import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, Alert, Switch } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppColors } from '@/constants/app-colors';
import { router, useFocusEffect } from 'expo-router'; // Add useFocusEffect
import { deleteToken, getToken } from '@/lib/auth-storage';
import { useEffect, useState, useMemo, useCallback } from 'react'; // Add useCallback
import { API_BASE_URL } from '@/lib/api';
import TeamLogo from '@/components/TeamLogo';
import { EmptyState } from '@/components/EmptyState';

export default function ProfileScreen() {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = AppColors[colorScheme];

    const [user, setUser] = useState<{ email?: string; is_admin?: boolean } | null>(null);
    const [favorites, setFavorites] = useState<string[]>([]);
    const [teamNames, setTeamNames] = useState<Record<string, string>>({}); // ID -> Name map
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);

    // This function fetches all the data
    const loadProfileData = useCallback(async () => {
        try {
            const token = await getToken();
            if (!token) return;

            // 1. Fetch User & Favorites in parallel
            const [userRes, favsRes, teamsRes, deviceSettingsRes] = await Promise.all([
                fetch(`${API_BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`${API_BASE_URL}/api/favorites`, { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`${API_BASE_URL}/teams?week=0`, { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`${API_BASE_URL}/api/devices/settings`, { headers: { Authorization: `Bearer ${token}` } }),
            ]);

            if (userRes.ok) {
                const userData = await userRes.json();
                setUser({ email: userData.email, is_admin: userData.is_admin });
            }

            if (favsRes.ok) {
                const favsData = await favsRes.json();
                setFavorites(favsData);
            }

            // Build a name map from the teams list
            if (teamsRes.ok) {
                const teamsData = await teamsRes.json();
                const mapping: Record<string, string> = {};
                // Adjust this loop based on your /teams response structure
                // Usually it's an array of team objects
                (teamsData.teams || teamsData).forEach((t: any) => {
                    mapping[t.team_id] = t.team_name;
                });
                setTeamNames(mapping);
            }

            if (deviceSettingsRes.ok) {
                const settings = await deviceSettingsRes.json();
                if (typeof settings?.notifications_enabled === 'boolean') {
                    setNotificationsEnabled(settings.notifications_enabled);
                }
            }
        } catch (e) {
            console.log('Error loading profile data', e);
        } finally {
            setLoading(false);
        }
    }, []);

    // useFocusEffect runs every time you navigate TO this tab
    useFocusEffect(
        useCallback(() => {
            loadProfileData();
        }, [loadProfileData])
    );

    const toggleNotifications = async (newValue: boolean) => {
        // 1. Update the UI immediately so it feels snappy
        setNotificationsEnabled(newValue);

        try {
            const token = await getToken();
            if (!token) return;

            // 2. Ping the new PATCH endpoint we just built
            const res = await fetch(`${API_BASE_URL}/api/devices/settings?enabled=${newValue}`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!res.ok) {
                console.log('Failed to sync notification settings:', res.status);
                // Optional: revert the switch if the server fails
                // setNotificationsEnabled(!newValue);
            }
        } catch (e) {
            console.log('Error syncing notifications:', e);
        }
    };

    const handleLogout = () => {
        Alert.alert(
            "Log Out",
            "Are you sure you want to log out of Legends CBB?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Log Out",
                    style: "destructive",
                    onPress: async () => {
                        await deleteToken();
                        router.replace('/auth/login');
                    }
                }
            ]
        );
    };

    const styles = useMemo(() => StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.background },
        content: { padding: 20, paddingTop: 60 },
        title: { fontSize: 32, fontWeight: '800', marginBottom: 8, color: theme.text },
        subtitle: { fontSize: 16, color: theme.mutedText, marginBottom: 30 },
        sectionTitle: { fontSize: 20, fontWeight: '700', marginBottom: 15, color: theme.text },
        favCard: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.card,
            padding: 12,
            borderRadius: 12,
            marginBottom: 10,
            borderWidth: 1,
            borderColor: theme.border,
        },
        settingRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: theme.card,
            padding: 16,
            borderRadius: 12,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: theme.border,
        },
        settingLabel: {
            fontSize: 16,
            fontWeight: '600',
            color: theme.text,
        },
        versionText: {
            textAlign: 'center',
            color: theme.mutedText,
            fontSize: 12,
            marginTop: 30,
            marginBottom: 10,
        },
        favText: { fontSize: 17, fontWeight: '600', color: theme.text, marginLeft: 12 },
        logoutButton: { backgroundColor: theme.danger, paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 20 },
        buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
        emptyText: { color: theme.mutedText, fontStyle: 'italic', marginBottom: 20 }
    }), [theme]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadProfileData(); // This re-fetches user, favorites, and team names
        setRefreshing(false);
    }, [loadProfileData]);

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.text} />
            }
        >

            <Text style={styles.title}>Profile</Text>

            {loading && !user ? (
                <ActivityIndicator size="small" color={theme.text} style={{ marginBottom: 20 }} />
            ) : user ? (
                <Text style={styles.subtitle}>
                    {user.email}{user.is_admin ? ' • Admin' : ''}
                </Text>
            ) : null}

            <Text style={styles.sectionTitle}>My Favorite Teams</Text>

            {favorites.length > 0 ? (
                [...favorites]
                    .sort((a, b) => (teamNames[a] || a).localeCompare(teamNames[b] || b))
                    .map((teamId) => (
                        <Pressable
                            key={teamId}
                            style={styles.favCard}
                            onPress={() => router.push({
                                pathname: '/team/[teamId]',
                                params: { teamId: teamId }
                            })}
                        >
                            <TeamLogo teamId={teamId} size={30} />
                            <Text style={styles.favText}>{teamNames[teamId] || teamId}</Text>
                        </Pressable>
                    ))
            ) : (
                <EmptyState
                    title="No Favorites Yet"
                    description="Follow your favorite programs to see their latest results and upcoming schedules here."
                    buttonText="Find Teams to Follow"
                    theme={theme}
                />
            )}

            {/* --- NOTIFICATION TOGGLE (Sim-League Style) --- */}
            <View style={styles.settingRow}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={styles.settingLabel}>New Result Alerts</Text>
                    <Text style={{ color: theme.mutedText, fontSize: 13, marginTop: 2 }}>
                        Get notified when new sim results and rankings are posted.
                    </Text>
                </View>
                <Switch
                    value={notificationsEnabled}
                    onValueChange={toggleNotifications}
                    trackColor={{ false: theme.border, true: '#34C759' }}
                />
            </View>


            <Pressable style={styles.logoutButton} onPress={handleLogout}>
                <Text style={styles.buttonText}>Log Out</Text>
            </Pressable>

            {/* --- VERSION NUMBER --- */}
            <Text style={styles.versionText}>Legends CBB v1.0.0 (Beta)</Text>
        </ScrollView>
    );
}
