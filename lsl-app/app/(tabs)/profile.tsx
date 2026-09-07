import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, Alert, Switch, Image, useWindowDimensions, TextInput, Platform } from 'react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppColors } from '@/constants/app-colors';
import { router, useFocusEffect } from 'expo-router'; // Add useFocusEffect
import { deleteToken, getToken } from '@/lib/auth-storage';
import { useEffect, useState, useMemo, useCallback } from 'react'; // Add useCallback
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL } from '@/lib/api';
import TeamLogo from '@/components/TeamLogo';
import { EmptyState } from '@/components/EmptyState';
import { importLogoPack } from '@/lib/logoManager';
import { getTeamBranding } from '@/lib/teamBranding';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';


const CONFERENCES = ["AAC", "ACC", "B10", "B12", "BE", "MW", "P12", "SEC", "WCC"];

export default function ProfileScreen() {
    const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
    const theme = AppColors[colorScheme];
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const isTablet = width >= 768; // Standard breakpoint for iPad

    const [user, setUser] = useState<{ email?: string; username?: string; is_admin?: boolean } | null>(null);
    const [phase, setPhase] = useState<string | null>(null);
    const [favorites, setFavorites] = useState<string[]>([]);
    const [teamNames, setTeamNames] = useState<Record<string, string>>({}); // ID -> Name map
    const [allTeamIds, setAllTeamIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [syncProgress, setSyncProgress] = useState(0); // NEW
    const [syncTotal, setSyncTotal] = useState(0);     // NEW
    const [customTitle, setCustomTitle] = useState('');
    const [customBody, setCustomBody] = useState('');
    const [targetTeam, setTargetTeam] = useState(''); // Leave empty for ALL

    // This function fetches all the data
    const loadProfileData = useCallback(async () => {
        try {
            const token = await getToken();
            if (!token) return;

            // 1. Fetch User & Favorites in parallel
            const [userRes, favsRes, teamsRes, deviceSettingsRes, allTeamIdsRes, stateRes] = await Promise.all([
                fetch(`${API_BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`${API_BASE_URL}/api/favorites`, { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`${API_BASE_URL}/teams?week=0`, { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`${API_BASE_URL}/api/devices/settings`, { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`${API_BASE_URL}/teams/all-ids`, { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`${API_BASE_URL}/api/tournament/state?season=2036`),
            ]);

            if (userRes.ok) {
                const userData = await userRes.json();
                console.log("FETCHED_USER_DATA:", userData); // Add this temporarily to verify
                setUser({
                    email: userData.email,
                    username: userData.username, // Ensure this key matches your Backend return
                    is_admin: userData.is_admin
                });
            }

            if (favsRes.ok) {
                const favsData = await favsRes.json();
                setFavorites(favsData);
            }

            // Build a name map from the teams list using the Branding Gate
            if (teamsRes.ok) {
                const teamsData = await teamsRes.json();
                const mapping: Record<string, string> = {};
                (teamsData.teams || teamsData).forEach((t: any) => {
                    // This ensures even the Favorites list obeys your authored names
                    mapping[t.team_id] = getTeamBranding(t.team_id, t.team_name).displayName;
                });
                setTeamNames(mapping);
            }

            if (deviceSettingsRes.ok) {
                const settings = await deviceSettingsRes.json();
                if (typeof settings?.notifications_enabled === 'boolean') {
                    setNotificationsEnabled(settings.notifications_enabled);
                }
            }

            if (stateRes.ok) {
                const stateData = await stateRes.json();
                setPhase(stateData.phase); // STORE THE PHASE
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

    const handleUpdateUsername = async (newName: string | undefined) => {
        if (!newName) return;

        const sanitizedName = newName.trim().toLowerCase();

        // 1. Frontend Validation (Matches your rules)
        const usernameRegex = /^[a-zA-Z0-9_\.]+$/;
        if (sanitizedName.length < 3 || sanitizedName.length > 20) {
            if (Platform.OS === 'web') window.alert("Invalid Length\n\nUsername must be 3-20 characters.");
            else Alert.alert("Invalid Length", "Username must be 3-20 characters.");
            return;
        }
        if (!usernameRegex.test(sanitizedName)) {
            if (Platform.OS === 'web') window.alert("Invalid Characters\n\nUse only letters, numbers, underscores, and periods.");
            else Alert.alert("Invalid Characters", "Use only letters, numbers, underscores, and periods.");
            return;
        }

        setLoading(true);
        try {
            const token = await getToken();
            const res = await fetch(`${API_BASE_URL}/auth/username`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username: sanitizedName })
            });

            const data = await res.json();

            if (res.ok) {
                if (Platform.OS === 'web') window.alert("Success\n\nLegend ID updated successfully.");
                else Alert.alert("Success", "Legend ID updated successfully.");

                // Update local state so the UI flips immediately
                setUser(prev => prev ? { ...prev, username: sanitizedName } : null);
            } else {
                if (Platform.OS === 'web') window.alert(`Update Failed\n\n${data.detail || "Could not update username."}`);
                else Alert.alert("Update Failed", data.detail || "Could not update username.");
            }
        } catch (e) {
            console.error("Failed to update username:", e);
            if (Platform.OS === 'web') window.alert("Error\n\nNetwork error. Please try again.");
            else Alert.alert("Error", "Network error. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        const executeLogout = async () => {
            await deleteToken();
            router.replace('/auth/login');
        };

        if (Platform.OS === 'web') {
            if (window.confirm("Log Out\n\nAre you sure you want to log out of Legends CBB?")) {
                executeLogout();
            }
        } else {
            Alert.alert(
                "Log Out",
                "Are you sure you want to log out of Legends CBB?",
                [
                    { text: "Cancel", style: "cancel" },
                    {
                        text: "Log Out",
                        style: "destructive",
                        onPress: executeLogout
                    }
                ]
            );
        }
    };

    const handleImportLogos = async () => {
        const idsToSync = allTeamIds;
        if (allTeamIds.length === 0) {
            Alert.alert("Error", "Please wait for team data to load before syncing. Try pulling to refresh.");
            return;
        }

        const title = "Sync LSL Community Logos";
        const message = `This will download community branding for ${allTeamIds.length} teams and ${CONFERENCES.length} conferences. This might take a few minutes depending on your connection. Continue?`;

        const executeImport = async () => {
            setLoading(true);
            setSyncProgress(0); // Reset progress
            setSyncTotal(idsToSync.length + CONFERENCES.length); // Set total

            try {
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
            } catch (e) {
                setLoading(false);
                setSyncProgress(0);
                Alert.alert("Error", "A critical error occurred during the logo sync.");
                console.error("Logo import error:", e);
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm(`${title}\n\n${message}`)) {
                executeImport();
            }
        } else {
            Alert.alert(
                title,
                message,
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Sync Now", onPress: executeImport }
                ]
            );
        }
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

    const handleSyncDBSchema = async () => {
        const title = "Sync DB Schema";
        const message = "Are you sure you want to patch the database columns? This cannot be undone.";

        const executeMigration = async () => {
            try {
                const token = await getToken();
                // Call the specific column patch endpoint
                const res = await fetch(`${API_BASE_URL}/admin/db/patch-seedlist-columns`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.ok) {
                    Alert.alert("Success", "Columns added successfully.");
                } else {
                    Alert.alert("Error", "Migration failed.");
                }
            } catch (e) {
                Alert.alert("Error", "Network error.");
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm(`${title}\n\n${message}`)) {
                executeMigration();
            }
        } else {
            Alert.alert(
                title,
                message,
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Confirm", onPress: executeMigration }
                ]
            );
        }
    };

    const handleSetTournamentPhase = async (newPhase: string) => {
        const title = "Change Tournament Phase";
        const message = `Are you sure you want to switch the app to ${newPhase} mode?`;

        const executePhaseChange = async () => {
            setLoading(true);
            try {
                const token = await getToken();
                const res = await fetch(`${API_BASE_URL}/admin/tournament/set-phase?phase=${newPhase}&season=2036`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.ok) {
                    setPhase(newPhase); // Instantly update the label in your console
                    Alert.alert("Success", `Phase changed to ${newPhase}.`);
                } else {
                    Alert.alert("Error", "Failed to update phase.");
                }
            } catch (e) {
                Alert.alert("Error", "Network error.");
            } finally {
                setLoading(false);
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm(`${title}\n\n${message}`)) {
                executePhaseChange();
            }
        } else {
            Alert.alert(
                title,
                message,
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Confirm", onPress: executePhaseChange }
                ]
            );
        }
    };

    const handleRunBracketSim = async () => {
        const title = "Run Tournament Simulation";
        const message = "This will execute the LSL AI Engine to generate a new projected bracket based on power and trends. This will overwrite the current public projection. Continue?";

        const executeAction = async () => {
            setLoading(true);
            try {
                const token = await getToken();
                const res = await fetch(`${API_BASE_URL}/admin/tournament/run-sim?season=2036`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` }
                });
                setLoading(false);
                if (res.ok) {
                    Alert.alert("Success", "New AI Simulation Published!");
                } else {
                    Alert.alert("Error", "Simulation failed.");
                }
            } catch (e) {
                setLoading(false);
                Alert.alert("Error", "Could not connect to server.");
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm(`${title}\n\n${message}`)) {
                executeAction();
            }
        } else {
            Alert.alert(title, message, [
                { text: "Cancel", style: "cancel" },
                { text: "Run Sim", onPress: executeAction }
            ]);
        }
    };

    const handleBracketologySync = async () => {
        const title = "Sync Bracketology";
        const message = "This will pull the current rankings from the LCAA_Bracketology sheet to update the mock bracket. Continue?";

        const executeSync = async () => {
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
        };

        if (Platform.OS === 'web') {
            if (window.confirm(`${title}\n\n${message}`)) {
                executeSync();
            }
        } else {
            Alert.alert(
                title,
                message,
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Run Sync", onPress: executeSync }
                ]
            );
        }
    };

    const handleTournamentSync = async () => {
        const title = "LCAA Selection Sunday";
        const message = "This will read the Official Field from Google Sheets and generate the 2036 LCAA Bracket. Continue?";

        const executeTournamentSync = async () => {
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
        };

        if (Platform.OS === 'web') {
            if (window.confirm(`${title}\n\n${message}`)) {
                executeTournamentSync();
            }
        } else {
            Alert.alert(
                title,
                message,
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Run Sync", onPress: executeTournamentSync }
                ]
            );
        }
    };

    const handlePlayersSnapshotSync = async () => {
        const title = "Sync Players Snapshot";
        const message = "This will pull the latest player data from the PlayersSnapshot tab in your Master sheet and overwrite the in-app snapshot. Continue?";

        const executeSnapshotSync = async () => {
            setLoading(true);
            try {
                const token = await getToken();
                if (!token) {
                    setLoading(false);
                    Alert.alert("Error", "You must be logged in as an admin.");
                    return;
                }

                const res = await fetch(`${API_BASE_URL}/admin/players/sync`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` },
                });

                const text = await res.text();
                let data: any = {};
                try {
                    data = JSON.parse(text);
                } catch {
                    // ignore parse error; text may not be JSON on failure
                }

                setLoading(false);

                if (res.ok) {
                    const imported = data?.rows_imported ?? 'unknown';
                    Alert.alert("Success", `Synced ${imported} player rows from PlayersSnapshot.`);
                } else {
                    Alert.alert("Error", data?.detail || `Sync failed (HTTP ${res.status}).`);
                }
            } catch (e) {
                console.log("Players snapshot sync error", e);
                setLoading(false);
                Alert.alert("Error", "Could not connect to server.");
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm(`${title}\n\n${message}`)) {
                executeSnapshotSync();
            }
        } else {
            Alert.alert(
                title,
                message,
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Run Sync", onPress: executeSnapshotSync }
                ]
            );
        }
    };

    const handleManualPush = async () => {
        if (!customTitle || !customBody) {
            Alert.alert("Error", "Title and Body are required.");
            return;
        }

        // Split input by commas, trim spaces, remove empty strings
        const teamsList = targetTeam
            ? targetTeam.split(',').map(t => t.trim()).filter(t => t.length > 0)
            : [];

        const title = "Confirm Broadcast";
        const message = `Send this to ${teamsList.length > 0 ? teamsList.join(' & ') + ' fans' : 'EVERYONE'}?`;

        const executePush = async () => {
            try {
                const token = await getToken();
                const res = await fetch(`${API_BASE_URL}/admin/send-global-push`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        title: customTitle,
                        body: customBody,
                        teamIds: teamsList.length > 0 ? teamsList : null
                    })
                });
                if (res.ok) {
                    Alert.alert("Success", "Broadcast enqueued!");
                    setCustomTitle('');
                    setCustomBody('');
                    setTargetTeam('');
                } else {
                    const err = await res.json();
                    Alert.alert("Error", err.detail || "Failed to send.");
                }
            } catch (e) {
                Alert.alert("Error", "Connection failure.");
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm(`${title}\n\n${message}`)) {
                executePush();
            }
        } else {
            Alert.alert(
                title,
                message,
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Send Now", onPress: executePush }
                ]
            );
        }
    };

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.text} />
            }
        >
            {/* --- BRANDED PROFILE HEADER --- */}
            <View style={{
                alignItems: 'center',
                marginBottom: 10,
                marginTop: isTablet
                    ? -38
                    : insets.top > 0
                        ? insets.top - 42
                        : 30
            }}>
                <Image
                    source={require('@/assets/images/index_header_icon.png')}
                    style={{ width: 140, height: 60 }}
                    resizeMode="contain"
                />
                <Text style={{
                    fontSize: 12,
                    fontWeight: '800',
                    color: theme.mutedText,
                    letterSpacing: 2.5,
                    marginTop: 8,
                    textTransform: 'uppercase'
                }}>
                    Legends Universe Account
                </Text>

                {loading && !user ? (
                    <ActivityIndicator size="small" color={theme.text} style={{ marginTop: 15 }} />
                ) : user ? (
                    <View style={{
                        marginTop: 4,
                        alignItems: 'center'
                    }}>
                        {/* PRIMARY IDENTITY: USERNAME */}
                        <Text style={{
                            fontSize: 22,
                            fontWeight: '800',
                            color: theme.text,
                            letterSpacing: -0.5
                        }}>
                            {user.username ? `@${user.username}` : 'Set Username'}
                        </Text>

                        {/* SECONDARY IDENTITY: EMAIL + ADMIN TAG */}
                        <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            marginTop: 4,
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            backgroundColor: theme.card,
                            borderRadius: 6,
                            borderWidth: 1,
                            borderColor: theme.border
                        }}>
                            <Text style={{ fontSize: 12, fontWeight: '600', color: theme.mutedText }}>
                                {user.email}{user.is_admin ? ' • ADMIN' : ''}
                            </Text>
                        </View>
                    </View>
                ) : null}
            </View>

            <Text style={styles.sectionTitle}>My Favorite Teams</Text>

            {favorites.length > 0 ? (
                [...favorites]
                    .sort((a, b) => {
                        const nameA = teamNames[a] || getTeamBranding(a, null).displayName;
                        const nameB = teamNames[b] || getTeamBranding(b, null).displayName;
                        return nameA.localeCompare(nameB);
                    })
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
                            <Text style={styles.favText}>{teamNames[teamId] || getTeamBranding(teamId, null).displayName}</Text>
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

            {/* --- IDENTITY SETTINGS --- */}
            <Pressable
                style={styles.settingRow}
                onPress={() => {
                    if (Platform.OS === 'web') {
                        // 1. Web browser native prompt
                        const newName = window.prompt(
                            "Change Username\n\nEnter your new Legends ID (3-20 characters, alphanumeric and periods only).",
                            user?.username || ""
                        );
                        if (newName !== null) {
                            handleUpdateUsername(newName);
                        }
                    } else {
                        // 2. Hidden mobile prompt to bypass strict web bundlers
                        const safePrompt = (Alert as any).prompt;
                        if (safePrompt) {
                            safePrompt(
                                "Change Username",
                                "Enter your new Legends ID (3-20 characters, alphanumeric and periods only).",
                                [
                                    { text: "Cancel", style: "cancel" },
                                    {
                                        text: "Update",
                                        onPress: (newName?: string) => handleUpdateUsername(newName)
                                    }
                                ],
                                "plain-text",
                                user?.username || ""
                            );
                        } else {
                            // 3. Android fallback (since Android doesn't support Alert.prompt natively)
                            Alert.alert("Not Supported", "Text prompts are only supported on iOS right now.");
                        }
                    }
                }}
            >
                <View style={{ flex: 1 }}>
                    <Text style={styles.settingLabel}>Edit Legends ID</Text>
                    <Text style={{ color: theme.mutedText, fontSize: 13, marginTop: 2 }}>
                        Change your public identity within the simulation universe.
                    </Text>
                </View>
                <Text style={{ color: '#007AFF', fontWeight: '600' }}>Edit</Text>
            </Pressable>

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
                    <Text style={styles.settingLabel}>⚙️ Import LSL Community Pack</Text>
                    <Text style={{ color: theme.mutedText, fontSize: 13, marginTop: 2 }}>
                        Download community logos and assets from an external source.
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

                    {/* --- COMMISSIONER MEGAPHONE --- */}
                    <View style={{
                        marginTop: 10,
                        padding: 15,
                        backgroundColor: theme.card,
                        borderRadius: 12,
                        borderStyle: 'dashed',
                        borderWidth: 1,
                        borderColor: theme.border,
                        marginBottom: 20
                    }}>
                        <Text style={{ fontSize: 15, fontWeight: '800', color: theme.text, marginBottom: 5 }}>
                            📢 Commissioner Megaphone
                        </Text>

                        <TextInput
                            placeholder="Alert Title (e.g. BREAKING NEWS)"
                            value={customTitle}
                            onChangeText={setCustomTitle}
                            style={{ backgroundColor: theme.background, color: theme.text, padding: 12, borderRadius: 8, marginTop: 10, borderWidth: 1, borderColor: theme.border }}
                            placeholderTextColor={theme.mutedText}
                        />
                        <TextInput
                            placeholder="Alert Message..."
                            value={customBody}
                            onChangeText={setCustomBody}
                            multiline
                            style={{ backgroundColor: theme.background, color: theme.text, padding: 12, borderRadius: 8, marginTop: 10, height: 80, textAlignVertical: 'top', borderWidth: 1, borderColor: theme.border }}
                            placeholderTextColor={theme.mutedText}
                        />
                        <TextInput
                            placeholder="Target Real Team IDs or blank for ALL"
                            value={targetTeam}
                            onChangeText={setTargetTeam}
                            autoCapitalize="characters"
                            style={{ backgroundColor: theme.background, color: theme.text, padding: 12, borderRadius: 8, marginTop: 10, borderWidth: 1, borderColor: theme.border }}
                            placeholderTextColor={theme.mutedText}
                        />

                        <Pressable
                            onPress={handleManualPush}
                            style={({ pressed }) => ({
                                backgroundColor: '#FF9500',
                                padding: 14,
                                borderRadius: 10,
                                marginTop: 15,
                                alignItems: 'center',
                                opacity: pressed ? 0.8 : 1
                            })}
                        >
                            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>FIRE BROADCAST</Text>
                        </Pressable>
                    </View>

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

                    {/* --- RUN SIM (CYAN) --- */}
                    <Pressable
                        style={[styles.settingRow, { backgroundColor: '#5AC8FA', marginBottom: 10 }]}
                        onPress={handleRunBracketSim}
                    >
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.settingLabel, { color: '#fff' }]}>🤖 Run LCAA AI Simulation</Text>
                            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 }}>
                                Generate fresh projected outcomes for every game.
                            </Text>
                        </View>
                    </Pressable>

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

                    {/* --- PLAYERS SNAPSHOT SYNC (GREEN) --- */}
                    <Pressable
                        style={[styles.settingRow, { backgroundColor: '#34C759', marginBottom: 10 }]}
                        onPress={handlePlayersSnapshotSync}
                    >
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.settingLabel, { color: '#fff' }]}>👤 Sync Players Snapshot</Text>
                            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 }}>
                                Refresh all roster & player details from the PlayersSnapshot sheet.
                            </Text>
                        </View>
                    </Pressable>

                    {/* --- TOURNAMENT PHASE CONTROL --- */}
                    <View style={{ marginTop: 20, marginBottom: 10 }}>
                        <Text style={[styles.sectionTitle, { fontSize: 16, marginBottom: 12 }]}>
                            Global Tournament State: {phase?.replace('_', ' ')}
                        </Text>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            {/* 1. BRACKETOLOGY (Regular Season) */}
                            <Pressable
                                style={[styles.settingRow, { flex: 1, marginRight: 4, backgroundColor: '#8E8E93', marginBottom: 0, paddingVertical: 12 }]}
                                onPress={() => handleSetTournamentPhase('BRACKETOLOGY')}
                            >
                                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '900', textAlign: 'center' }}>REGULAR SEASON</Text>
                            </Pressable>

                            {/* 2. SELECTION SUNDAY (Predictions Open) - This was your original Orange button logic */}
                            <Pressable
                                style={[styles.settingRow, { flex: 1, marginHorizontal: 2, backgroundColor: '#FF9500', marginBottom: 0, paddingVertical: 12 }]}
                                onPress={() => handleSetTournamentPhase('SELECTION_SUNDAY')}
                            >
                                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '900', textAlign: 'center' }}>OPEN PICKS</Text>
                            </Pressable>

                            {/* 3. LIVE (Tournament Tip-off / Locked) */}
                            <Pressable
                                style={[styles.settingRow, { flex: 1, marginLeft: 4, backgroundColor: '#FF3B30', marginBottom: 0, paddingVertical: 12 }]}
                                onPress={() => handleSetTournamentPhase('LIVE')}
                            >
                                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '900', textAlign: 'center' }}>🔒 LOCK ALL</Text>
                            </Pressable>
                        </View>
                        <Text style={{ color: theme.mutedText, fontSize: 11, marginTop: 8, textAlign: 'center' }}>
                            {phase === 'BRACKETOLOGY' ? 'Current Mode: Projections Only' :
                                phase === 'SELECTION_SUNDAY' ? 'Current Mode: Users making picks' :
                                    'Current Mode: Games active, brackets frozen'}
                        </Text>
                    </View>
                    {/* ------------------------------------------- */}

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
                        style={[styles.logoutButton, { backgroundColor: '#8E8E93', marginTop: 10 }]}
                        onPress={handleSyncDBSchema}
                    >
                        <Text style={styles.buttonText}>🛠️ Sync DB Schema</Text>
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

            <View style={{ marginTop: 20, marginBottom: -10, padding: 15, backgroundColor: theme.card, borderRadius: 12, borderStyle: 'dashed', borderWidth: 1, borderColor: theme.border }}>
                <Text style={[styles.sectionTitle, { fontSize: 16, marginBottom: 8 }]}>Simulation Engine</Text>
                <Text style={{ color: theme.mutedText, fontSize: 13, lineHeight: 18 }}>
                    Legends CBB results are generated using the <Text style={{ fontWeight: '700' }}>Legacy Simulation Engine</Text>.
                    Special thanks to the <Text style={{ fontWeight: '700' }}>MML Development Team</Text> for their dedication to simulation realism and community-driven analytics.
                </Text>
            </View>

            {/* --- VERSION NUMBER --- */}
            <Text style={styles.versionText}>Legends CBB v1.0.0 (Beta)</Text>
        </ScrollView>
    );
}
