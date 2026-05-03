import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, Alert, Switch } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppColors } from '@/constants/app-colors';
import { router, useFocusEffect } from 'expo-router'; // Add useFocusEffect
import { deleteToken, getToken } from '@/lib/auth-storage';
import { useEffect, useState, useMemo, useCallback } from 'react'; // Add useCallback
import { API_BASE_URL } from '@/lib/api';
import TeamLogo from '@/components/TeamLogo';
import { EmptyState } from '@/components/EmptyState';
import { importLogoPack } from '@/lib/logoManager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';


const CONFERENCES = ["AAC", "ACC", "B10", "B12", "BE", "MW", "P12", "SEC", "WCC"];

export default function ProfileScreen() {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = AppColors[colorScheme];

    const [user, setUser] = useState<{ email?: string; is_admin?: boolean } | null>(null);
    const [favorites, setFavorites] = useState<string[]>([]);
    const [teamNames, setTeamNames] = useState<Record<string, string>>({}); // ID -> Name map
    const [allTeamIds, setAllTeamIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [syncProgress, setSyncProgress] = useState(0); // NEW
    const [syncTotal, setSyncTotal] = useState(0);     // NEW

    // This function fetches all the data
    const loadProfileData = useCallback(async () => {
        try {
            const token = await getToken();
            if (!token) return;

            // 1. Fetch User & Favorites in parallel
            const [userRes, favsRes, teamsRes, deviceSettingsRes, allTeamIdsRes] = await Promise.all([
                fetch(`${API_BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`${API_BASE_URL}/api/favorites`, { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`${API_BASE_URL}/teams?week=0`, { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`${API_BASE_URL}/api/devices/settings`, { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`${API_BASE_URL}/teams/all-ids`, { headers: { Authorization: `Bearer ${token}` } }), // NEW FETCH
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

            // NEW BLOCK: Handle the allTeamIds response
            if (allTeamIdsRes.ok) {
                const ids = await allTeamIdsRes.json();
                if (Array.isArray(ids)) {
                    setAllTeamIds(ids);
                    console.log("✅ Fetched allTeamIds:", ids.length, "IDs");
                } else {
                    console.log("⚠️ allTeamIdsRes was not an array:", ids);
                }
            } else {
                console.log("❌ Failed to fetch allTeamIds:", allTeamIdsRes.status);
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

    const handleImportLogos = async () => {
        // Use the newly fetched list of ALL team IDs
        // Check if allTeamIds is populated before starting the sync
        const idsToSync = allTeamIds; // Use the state variable holding ALL the IDs
        if (allTeamIds.length === 0) {
            Alert.alert("Error", "Please wait for team data to load before syncing. Try pulling to refresh.");
            return;
        }

        Alert.alert(
            "Sync Official Logos",
            `This will download official branding for ${allTeamIds.length} teams and ${CONFERENCES.length} conferences. This might take a few minutes depending on your connection. Continue?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Sync Now",
                    onPress: async () => {
                        setLoading(true);
                        setSyncProgress(0); // Reset progress
                        setSyncTotal(idsToSync.length + CONFERENCES.length); // Set total

                        const success = await importLogoPack(idsToSync, (current, total) => {
                            setSyncProgress(current); // Update progress
                            setSyncTotal(total);     // Update total (if it changes)
                        });

                        setLoading(false);
                        setSyncProgress(0); // Clear progress on finish

                        if (success) {
                            Alert.alert("Success", "Logos synced! Please restart the app to see the new logos.");
                        } else {
                            Alert.alert("Error", "Sync failed. Please check your connection or try again.");
                        }
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

    // Add this inside ProfileScreen in app/(tabs)/profile.tsx
    const clearImportedLogos = async () => {
        // Cast to any to access the legacy methods bypass TypeScript errors
        const fs = (FileSystem as any);
        const docDir = fs.documentDirectory;
        const TEAM_LOGO_DIR = `${docDir}team-logos/`;
        const CONF_LOGO_DIR = `${docDir}conference-logos/`;

        try {
            // Use the casted object to call deleteAsync
            await fs.deleteAsync(TEAM_LOGO_DIR, { idempotent: true });
            await fs.deleteAsync(CONF_LOGO_DIR, { idempotent: true });

            // Also clear the AsyncStorage flag
            await AsyncStorage.removeItem('has_custom_logos');

            Alert.alert("Success", "Imported logos cleared. Restart the app to see generics.");
        } catch (e) {
            console.log("Delete Error:", e);
            Alert.alert("Error", "Could not clear logos.");
        }
    };

    const handleBracketologySync = async () => {
        Alert.alert(
            "Sync Bracketology",
            "This will pull the current rankings from the LCAA_Bracketology sheet to update the mock bracket. Continue?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Run Sync",
                    onPress: async () => {
                        setLoading(true);
                        try {
                            const token = await getToken();
                            const res = await fetch(`${API_BASE_URL}/admin/tournament/sync-bracketology?season=2036`, {
                                method: 'POST',
                                headers: { Authorization: `Bearer ${token}` }
                            });
                            const data = await res.json();
                            setLoading(false);
                            if (res.ok) {
                                Alert.alert("Success", `Synced ${data.teams_synced} teams to the Seed List.`);
                            } else {
                                Alert.alert("Error", data.detail || "Sync failed.");
                            }
                        } catch (e) {
                            setLoading(false);
                            Alert.alert("Error", "Could not connect to server.");
                        }
                    }
                }
            ]
        );
    };

    const handleTournamentSync = async () => {
        Alert.alert(
            "LCAA Selection Sunday",
            "This will read the Official Field from Google Sheets and generate the 2036 LCAA Bracket. Continue?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Run Sync",
                    onPress: async () => {
                        setLoading(true);
                        try {
                            const token = await getToken();
                            const res = await fetch(`${API_BASE_URL}/admin/tournament/sync?season=2036`, {
                                method: 'POST',
                                headers: { Authorization: `Bearer ${token}` }
                            });

                            const data = await res.json();
                            setLoading(false);

                            if (res.ok) {
                                // Format the AI Consultant's report
                                const warningCount = data.consultant_report?.rematch_count || 0;
                                const alerts = data.consultant_report?.rematch_alerts || [];

                                let alertMsg = `Successfully synced ${data.teams_synced} teams.`;
                                if (warningCount > 0) {
                                    alertMsg += `\n\n⚠️ AI CONSULTANT: Found ${warningCount} rematch conflicts:\n`;
                                    alerts.forEach((a: any) => alertMsg += `\n• ${a.message}`);
                                } else {
                                    alertMsg += `\n\n✅ AI CONSULTANT: No pod rematches detected.`;
                                }

                                Alert.alert("Sync Complete", alertMsg);
                            } else {
                                Alert.alert("Sync Failed", data.detail || "Check server logs.");
                            }
                        } catch (e) {
                            setLoading(false);
                            Alert.alert("Error", "Could not connect to server.");
                        }
                    }
                }
            ]
        );
    };

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

            <Pressable
                style={styles.settingRow}
                onPress={handleImportLogos}
                disabled={allTeamIds.length === 0} // DISABLE HERE
            >
                <View style={{ flex: 1 }}>
                    <Text style={styles.settingLabel}>⚙️ Import Realism Pack</Text>
                    <Text style={{ color: theme.mutedText, fontSize: 13, marginTop: 2 }}>
                        Download official logos and assets from an external source.
                    </Text>
                </View>
            </Pressable>

            {loading && syncTotal > 0 && ( // Display only when syncing and loading
                <View style={[styles.settingRow, { justifyContent: 'center', marginBottom: 20 }]}>
                    <ActivityIndicator size="small" color={theme.text} style={{ marginRight: 10 }} />
                    <Text style={styles.settingLabel}>
                        Syncing Logos: {syncProgress}/{syncTotal}
                    </Text>
                </View>
            )}

            {/* --- COMMISSIONER CONSOLE: ADMIN ONLY --- */}
            {user?.is_admin && (
                <View style={{ marginTop: 20, borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 20 }}>
                    <Text style={[styles.sectionTitle, { fontSize: 18 }]}>Commissioner Console</Text>

                    {/* --- ADD THIS GREEN BUTTON --- */}
                    <Pressable
                        style={[styles.settingRow, { backgroundColor: '#34C759', marginBottom: 10 }]}
                        onPress={() => router.push('/tournament/map')}
                    >
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.settingLabel, { color: '#fff' }]}>🗺️ View Tournament Map</Text>
                            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 }}>
                                Open the infinite canvas bracket view.
                            </Text>
                        </View>
                    </Pressable>
                    {/* ----------------------------- */}

                    {/* --- BRACKETOLOGY SYNC (PURPLE) --- */}
                    <Pressable
                        style={[styles.settingRow, { backgroundColor: '#5856D6', marginBottom: 10 }]}
                        onPress={handleBracketologySync}
                    >
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.settingLabel, { color: '#fff' }]}>📊 Sync LCAA Bracketology</Text>
                            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 }}>
                                Update the projected rankings from Google Sheets.
                            </Text>
                        </View>
                    </Pressable>

                    {/* --- OFFICIAL TOURNAMENT SYNC (BLUE) --- */}
                    <Pressable
                        style={[styles.settingRow, { backgroundColor: '#007AFF' }]}
                        onPress={handleTournamentSync}
                    >
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.settingLabel, { color: '#fff' }]}>🏆 Sync 2036 LCAA Tournament</Text>
                            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 }}>
                                Generate the bracket from the Official Field Google Sheet.
                            </Text>
                        </View>
                    </Pressable>

                    <Pressable
                        style={[styles.logoutButton, { backgroundColor: theme.mutedText, marginTop: 10 }]}
                        onPress={clearImportedLogos}
                    >
                        <Text style={styles.buttonText}>⚠️ Reset to Generic Logos</Text>
                    </Pressable>
                </View>
            )}

            <Pressable style={styles.logoutButton} onPress={handleLogout}>
                <Text style={styles.buttonText}>Log Out</Text>
            </Pressable>

            {/* --- VERSION NUMBER --- */}
            <Text style={styles.versionText}>Legends CBB v1.0.0 (Beta)</Text>
        </ScrollView>
    );
}
