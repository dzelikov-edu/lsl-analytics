import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ActivityIndicator, Pressable, ScrollView, StyleSheet, Alert, Image, useWindowDimensions, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL } from '@/lib/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppColors } from '@/constants/app-colors';
import TournamentMap from '../tournament/map';
import { getToken } from '@/lib/auth-storage';
import { useFocusEffect } from 'expo-router';
import Head from 'expo-router/head';
import TeamLogo from '@/components/TeamLogo';

export default function BracketTab() {
    const colorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
    const theme = AppColors[colorScheme];
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const isTablet = width >= 768;

    const [phase, setPhase] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [brackets, setBrackets] = useState<any[]>([]);
    const [selectedBracketId, setSelectedBracketId] = useState<string | null>(null);
    const [teamNames, setTeamNames] = useState<Record<string, string>>({});
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [activeGroupName, setActiveGroupName] = useState<string | null>(null);

    // Sim State
    const [personalSim, setPersonalSim] = useState<any[] | null>(null);
    const [simLoading, setSimLoading] = useState(false);

    const [scoreSummary, setScoreSummary] = useState<{ score: number; pts_rem: number } | null>(null);

    useEffect(() => {
        const loadScoreSummary = async () => {
            if (!selectedBracketId) {
                setScoreSummary(null);
                return;
            }
            try {
                const token = await getToken();
                if (!token) return;
                const res = await fetch(
                    `${API_BASE_URL}/api/tournament/brackets/${selectedBracketId}/score-summary?season=2036`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                if (!res.ok) {
                    console.log("Failed to load score summary", res.status);
                    setScoreSummary(null);
                    return;
                }
                const data = await res.json();
                setScoreSummary({
                    score: data.score ?? 0,
                    pts_rem: data.pts_rem ?? 0,
                });
            } catch (e) {
                console.log("Error loading score summary", e);
                setScoreSummary(null);
            }
        };
        loadScoreSummary();
    }, [selectedBracketId]);

    const [viewMode, setViewMode] = useState<'BRACKETS' | 'GROUPS'>('BRACKETS');
    const [myGroups, setMyGroups] = useState<any[]>([]);

    const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
    const [leaderboard, setLeaderboard] = useState<any[]>([]);

    const loadInitialData = async () => {
        try {
            const token = await getToken();
            // 1. Fetch all data including user profile for ownership check
            const [userRes, stateRes, bracketsRes, groupsRes, namesRes] = await Promise.all([
                fetch(`${API_BASE_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`${API_BASE_URL}/api/tournament/state?season=2036`),
                fetch(`${API_BASE_URL}/api/tournament/brackets?season=2036`, { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`${API_BASE_URL}/api/tournament/groups/me?season=2036`, { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`${API_BASE_URL}/api/tournament/team-names`),
            ]);

            const userData = await userRes.json();
            const stateData = await stateRes.json();
            const bracketListData = await bracketsRes.json();
            const groupsListData = await groupsRes.json();
            const namesData = namesRes.ok ? await namesRes.json() : {};

            // 2. Set all state variables
            setCurrentUserId(userData.id);
            setPhase(stateData.phase);
            setBrackets(bracketListData);
            setMyGroups(groupsListData);
            if (namesData && typeof namesData === 'object') {
                setTeamNames(namesData);
            }
        } catch (e) {
            console.error(e);
            setPhase('BRACKETOLOGY');
        } finally {
            setLoading(false);
        }
    };

    // This will trigger loadInitialData every time you tap the LCAA tab 
    // OR every time you hit the "← My Brackets" button to return to the list
    useFocusEffect(
        useCallback(() => {
            loadInitialData();
        }, [])
    );

    const handleCreateBracket = async () => {
        // 1. Platform fork for the limit warning
        if (brackets.length >= 10) {
            if (Platform.OS === 'web') window.alert("Limit Reached\n\nYou can only create up to 10 brackets.");
            else Alert.alert("Limit Reached", "You can only create up to 10 brackets.");
            return;
        }

        try {
            const token = await getToken();
            const res = await fetch(`${API_BASE_URL}/api/tournament/brackets`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name: `Bracket ${brackets.length + 1}`, season: 2036 })
            });
            if (res.ok) {
                const newBracket = await res.json();
                setBrackets([...brackets, newBracket]);
                setSelectedBracketId(newBracket.id); // Auto-open new bracket
            }
        } catch (e) {
            // 2. Platform fork for the error handling
            console.error("Failed to create bracket:", e);
            if (Platform.OS === 'web') window.alert("Error\n\nCould not create bracket.");
            else Alert.alert("Error", "Could not create bracket.");
        }
    };

    const handleCloseMap = () => {
        setSelectedBracketId(null); // Close the map
        loadInitialData();          // Refresh the list counts immediately
    };

    const handleRenameBracket = (id: string, currentName: string) => {
        const executeRename = async (newName?: string) => {
            if (!newName || newName.trim() === "") return; // Prevent saving blank names

            try {
                const token = await getToken();

                // Safely encode spaces and special characters for the web URL
                const encodedName = encodeURIComponent(newName.trim());

                await fetch(`${API_BASE_URL}/api/tournament/brackets/${id}?name=${encodedName}`, {
                    method: 'PATCH',
                    headers: { Authorization: `Bearer ${token}` }
                });

                loadInitialData(); // Refresh list
            } catch (e) {
                console.error("Failed to rename bracket:", e);
                Alert.alert("Error", "Could not rename bracket. Please check your network connection.");
            }
        };

        if (Platform.OS === 'web') {
            const newName = window.prompt("Rename Bracket\n\nEnter a new name for your entry:", currentName);
            if (newName !== null) executeRename(newName);
        } else {
            Alert.prompt(
                "Rename Bracket",
                "Enter a new name for your entry:",
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Rename", onPress: executeRename }
                ],
                "plain-text",
                currentName
            );
        }
    };

    const handleDeleteBracket = (id: string) => {
        // 1. Isolate the delete logic and add error handling
        const executeDelete = async () => {
            try {
                const token = await getToken();
                await fetch(`${API_BASE_URL}/api/tournament/brackets/${id}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` }
                });
                loadInitialData();
            } catch (e) {
                console.error("Failed to delete bracket:", e);
                Alert.alert("Error", "Could not delete bracket. Please check your network connection.");
            }
        };

        // 2. Platform fork
        if (Platform.OS === 'web') {
            // Web uses the native browser confirmation box
            if (window.confirm("Delete Bracket\n\nAre you sure? This will permanently remove this bracket and all its picks.")) {
                executeDelete();
            }
        } else {
            // Mobile uses your exact original Alert.alert
            Alert.alert(
                "Delete Bracket",
                "Are you sure? This will permanently remove this bracket and all its picks.",
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Delete", style: "destructive", onPress: executeDelete }
                ]
            );
        }
    };

    const handleCreateGroup = () => {
        // 1. Isolate the API logic and add URL encoding/error handling
        const executeCreate = async (groupName?: string) => {
            if (!groupName || groupName.trim() === "") return;

            try {
                const token = await getToken();
                const encodedName = encodeURIComponent(groupName.trim());

                const res = await fetch(`${API_BASE_URL}/api/tournament/groups?name=${encodedName}&season=2036`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (res.ok) {
                    if (Platform.OS === 'web') window.alert("Success!\n\nGroup created! Share the code with friends.");
                    else Alert.alert("Success", "Group created! Share the code with friends.");
                    loadInitialData(); // Refresh both lists
                } else {
                    const errorData = await res.json().catch(() => ({}));
                    const errorMsg = errorData.detail || "Failed to create group.";
                    if (Platform.OS === 'web') window.alert(`Error\n\n${errorMsg}`);
                    else Alert.alert("Error", errorMsg);
                }
            } catch (e) {
                console.error("Failed to create group:", e);
                if (Platform.OS === 'web') window.alert("Error\n\nCould not create group. Please check your network connection.");
                else Alert.alert("Error", "Could not create group. Please check your network connection.");
            }
        };

        // 2. The completely hidden platform fork
        if (Platform.OS === 'web') {
            const groupName = window.prompt("Create Bracket Group\n\nEnter a name for your league (e.g., The Office Pool):");
            if (groupName !== null) {
                executeCreate(groupName);
            }
        } else {
            // By casting Alert to 'any', the web bundler ignores this entirely
            const safePrompt = (Alert as any).prompt;
            if (safePrompt) {
                safePrompt(
                    "Create Bracket Group",
                    "Enter a name for your league (e.g., The Office Pool):",
                    [
                        { text: "Cancel", style: "cancel" },
                        { text: "Create", onPress: executeCreate }
                    ]
                );
            } else {
                Alert.alert("Not Supported", "Text prompts are only supported on iOS right now.");
            }
        }
    };

    const handleJoinGroup = () => {
        // 1. Isolate the API logic
        const executeJoin = async (code: string, targetBracketId: string) => {
            try {
                const token = await getToken();
                const res = await fetch(`${API_BASE_URL}/api/tournament/groups/join?code=${code.toUpperCase()}&user_bracket_id=${targetBracketId}`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = await res.json();

                if (res.ok) {
                    if (Platform.OS === 'web') window.alert(`Welcome!\n\nYou've joined ${data.group_name}.`);
                    else Alert.alert("Welcome!", `You've joined ${data.group_name}.`);
                    loadInitialData();
                } else {
                    const errorMsg = data.detail || "Failed to join group.";
                    if (Platform.OS === 'web') window.alert(`Error\n\n${errorMsg}`);
                    else Alert.alert("Error", errorMsg);
                }
            } catch (e) {
                console.error("Failed to join group:", e);
                if (Platform.OS === 'web') window.alert("Error\n\nNetwork error while joining group.");
                else Alert.alert("Error", "Network error while joining group.");
            }
        };

        // 2. The completely hidden platform fork
        if (Platform.OS === 'web') {
            const code = window.prompt("Join Bracket Group\n\nEnter the 6-character join code:");
            if (code) {
                if (brackets.length === 0) {
                    window.alert("You need to create a bracket first before joining a group.");
                } else if (brackets.length === 1) {
                    executeJoin(code, brackets[0].id);
                } else {
                    const options = brackets.map((b, index) => `${index + 1}. ${b.name}`).join('\n');
                    const selection = window.prompt(`Select Your Entry\n\nEnter the NUMBER of the bracket to use:\n\n${options}`);
                    const parsedIndex = parseInt(selection || '', 10) - 1;

                    if (!isNaN(parsedIndex) && brackets[parsedIndex]) {
                        executeJoin(code, brackets[parsedIndex].id);
                    } else if (selection !== null) {
                        window.alert("Invalid bracket selection.");
                    }
                }
            }
        } else {
            // Mobile safe prompt
            const safePrompt = (Alert as any).prompt;
            if (safePrompt) {
                safePrompt(
                    "Join Bracket Group",
                    "Enter the 6-character join code:",
                    [
                        { text: "Cancel", style: "cancel" },
                        {
                            text: "Next",
                            onPress: (code?: string) => {
                                if (!code) return;
                                const bracketButtons = brackets.map(b => ({
                                    text: b.name,
                                    onPress: () => executeJoin(code, b.id)
                                }));
                                Alert.alert(
                                    "Select Your Entry",
                                    "Choose which bracket to enter into this group. Remember: a bracket can only be used in one group.",
                                    [
                                        ...bracketButtons,
                                        { text: "Cancel", style: "cancel" }
                                    ]
                                );
                            }
                        }
                    ]
                );
            } else {
                Alert.alert("Not Supported", "Text prompts are only supported on iOS right now.");
            }
        }
    };

    const handleDeleteGroup = (id: string) => {
        // 1. Isolate the API logic and add error handling
        const executeDelete = async () => {
            try {
                const token = await getToken();
                await fetch(`${API_BASE_URL}/api/tournament/groups/${id}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` }
                });
                loadInitialData(); // Refresh the list
            } catch (e) {
                console.error("Failed to delete group:", e);
                if (Platform.OS === 'web') window.alert("Error\n\nCould not delete group. Please check your network connection.");
                else Alert.alert("Error", "Could not delete group. Please check your network connection.");
            }
        };

        // 2. Platform fork
        if (Platform.OS === 'web') {
            // Web uses the native browser confirmation box
            if (window.confirm("Delete Group\n\nAre you sure? This will permanently disband this group for all members currently in it.")) {
                executeDelete();
            }
        } else {
            // Mobile uses your exact original Alert.alert
            Alert.alert(
                "Delete Group",
                "Are you sure? This will permanently disband this group for all members currently in it.",
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Delete", style: "destructive", onPress: executeDelete }
                ]
            );
        }
    };

    const handleLeaveGroup = (id: string) => {
        // 1. Isolate the API logic and add error handling
        const executeLeave = async () => {
            try {
                const token = await getToken();
                await fetch(`${API_BASE_URL}/api/tournament/groups/${id}/leave`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` }
                });
                loadInitialData(); // Refresh the list
            } catch (e) {
                console.error("Failed to leave group:", e);
                if (Platform.OS === 'web') window.alert("Error\n\nCould not leave group. Please check your network connection.");
                else Alert.alert("Error", "Could not leave group. Please check your network connection.");
            }
        };

        // 2. Platform fork
        if (Platform.OS === 'web') {
            // Web uses the native browser confirmation box
            if (window.confirm("Leave Group\n\nAre you sure you want to leave this group? Your bracket entry will be removed from the leaderboard.")) {
                executeLeave();
            }
        } else {
            // Mobile uses your exact original Alert.alert
            Alert.alert(
                "Leave Group",
                "Are you sure you want to leave this group? Your bracket entry will be removed from the leaderboard.",
                [
                    { text: "Cancel", style: "cancel" },
                    { text: "Leave", style: "destructive", onPress: executeLeave }
                ]
            );
        }
    };

    const loadLeaderboard = async (groupId: string, groupName: string) => {
        setLoading(true);
        try {
            const token = await getToken();
            const res = await fetch(`${API_BASE_URL}/api/tournament/groups/${groupId}/leaderboard`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            setLeaderboard(data);
            setActiveGroupId(groupId);
            setActiveGroupName(groupName);
        } catch (e) {
            console.error("Failed to load leaderboard:", e);
            if (Platform.OS === 'web') {
                window.alert("Error\n\nCould not load leaderboard.");
            } else {
                Alert.alert("Error", "Could not load leaderboard.");
            }
        } finally {
            setLoading(false);
        }
    };

    const runPersonalSim = async () => {
        if (simLoading) return;
        setSimLoading(true);
        try {
            const token = await getToken();
            const res = await fetch(`${API_BASE_URL}/api/tournament/simulate?season=2036`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setPersonalSim(data);
            }
        } catch (e) { console.log(e); } finally { setSimLoading(false); }
    };

    if (loading) return <ActivityIndicator style={{ flex: 1 }} color={theme.text} />;

    // --- RENDER LOGIC ---

    // 1. Bracketology Mode (Always stays the same)
    if (phase === 'BRACKETOLOGY') {
        return (
            <View style={{ flex: 1, backgroundColor: theme.background }}>
                <TournamentMap
                    isMock={true}
                    overrideBracketData={personalSim ?? undefined}
                    onRunPersonalSim={runPersonalSim}
                />
            </View>
        );
    }

    // 2. Map View (If a bracket is selected)
    if (selectedBracketId) {
        // Find if this bracket belongs to the current user
        const isMyBracket = brackets.some(b => b.id === selectedBracketId);

        return (
            <View style={{ flex: 1, backgroundColor: theme.background }}>
                <TournamentMap
                    isMock={false}
                    initialBracketId={selectedBracketId}
                    onClose={handleCloseMap}
                    viewOnly={!isMyBracket} // If it's not mine, I can only view it
                    scoreSummary={scoreSummary || undefined}
                />
            </View>
        );
    }

    if (activeGroupId) {
        return (
            <ScrollView style={{ flex: 1, backgroundColor: theme.background }} contentContainerStyle={{ padding: 20, paddingTop: 60 }}>
                <Pressable onPress={() => setActiveGroupId(null)} style={{ marginBottom: 20 }}>
                    <Text style={{ color: '#007AFF', fontWeight: 'bold' }}>← Back to Groups</Text>
                </Pressable>

                {/* UPDATED HEADER */}
                <Text style={{ color: theme.text, fontSize: 28, fontWeight: '800' }}>
                    {activeGroupName || 'Leaderboard'}
                </Text>
                <Text style={{ color: theme.mutedText, marginBottom: 30 }}>
                    Group Standings • 2036 LCAA
                </Text>

                {leaderboard.map((row, index) => (
                    <Pressable
                        key={index}
                        onPress={() => {
                            const isMyBracket = brackets.some(b => b.id === row.bracket_id);

                            if (isMyBracket) {
                                // Always allow viewing your own bracket
                                setSelectedBracketId(row.bracket_id);
                                return;
                            }

                            if (phase === 'LIVE') {
                                // Only allow peeking others once tournament is LIVE
                                setSelectedBracketId(row.bracket_id);
                            } else {
                                // Platform fork for the locked alert
                                if (Platform.OS === 'web') {
                                    window.alert("Locked\n\nYou can only view other entries once the tournament is LIVE.");
                                } else {
                                    Alert.alert(
                                        "Locked",
                                        "You can only view other entries once the tournament is LIVE."
                                    );
                                }
                            }
                        }}
                        style={({ pressed }) => [{
                            backgroundColor: theme.card,
                            padding: 16,
                            borderRadius: 15,
                            marginBottom: 10,
                            borderWidth: index === 0 ? 2 : 1,
                            borderColor: index === 0 ? '#FFD700' : theme.border,
                            opacity: pressed ? 0.7 : 1
                        }]}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={{ color: theme.text, fontSize: 18, fontWeight: '900', width: 35 }}>{index + 1}</Text>
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: theme.text, fontWeight: '800', fontSize: 16 }}>{row.user_name}</Text>
                                <Text style={{ color: theme.mutedText, fontSize: 11 }}>{row.bracket_name}</Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <Text style={{ color: theme.text, fontSize: 22, fontWeight: '900' }}>{row.score}</Text>
                                <Text style={{ color: theme.mutedText, fontSize: 10, fontWeight: '700' }}>{row.pts_rem} REM</Text>

                                {/* LIVE-only champ pick peek */}
                                {phase === 'LIVE' && row.champ_pick && (
                                    <View style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center' }}>
                                        <TeamLogo teamId={row.champ_pick} size={18} />
                                        <Text
                                            style={{
                                                marginLeft: 6,
                                                color: theme.mutedText,
                                                fontSize: 10,
                                                fontWeight: '600',
                                            }}
                                            numberOfLines={1}
                                        >
                                            Champ: {teamNames[row.champ_pick] || row.champ_pick}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    </Pressable>
                ))}
            </ScrollView>
        );
    }

    // 3. List View (Default LIVE state)
    return (
        <>
            <Head>
                <title>LCAA Tournament | Legends CBB</title>
            </Head>

            <ScrollView
                style={{ flex: 1, backgroundColor: theme.background }}
                contentContainerStyle={{
                    padding: 20,
                    // iPad uses 10px, phones use the dynamic top inset (Notch room)
                    paddingTop: isTablet ? 10 : insets.top
                }}
            >
                {/* --- BRANDED HEADER --- */}
                <View style={{
                    alignItems: 'center',
                    marginBottom: 20,
                    marginTop: isTablet ? 12 : 18 // 12 for iPad, 18 for all Phones
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
                        Tournament Challenge
                    </Text>
                </View>

                {/* Existing Title (we keep it but it will now sit below the logo) */}
                <Text style={{ color: theme.text, fontSize: 30, fontWeight: '800', textAlign: 'center', marginBottom: 5 }}>
                    LCAA Tournament Bracket Challenge
                </Text>

                {/* --- MODE TOGGLE (NEW) --- */}
                <View style={{ flexDirection: 'row', backgroundColor: theme.card, borderRadius: 12, padding: 4, marginVertical: 20, borderWidth: 1, borderColor: theme.border }}>
                    <Pressable
                        onPress={() => setViewMode('BRACKETS')}
                        style={{ flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: viewMode === 'BRACKETS' ? theme.border : 'transparent', alignItems: 'center' }}
                    >
                        <Text style={{ color: theme.text, fontWeight: '700', fontSize: 13 }}>My Brackets</Text>
                    </Pressable>
                    <Pressable
                        onPress={() => setViewMode('GROUPS')}
                        style={{ flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: viewMode === 'GROUPS' ? theme.border : 'transparent', alignItems: 'center' }}
                    >
                        <Text style={{ color: theme.text, fontWeight: '700', fontSize: 13 }}>My Groups</Text>
                    </Pressable>
                </View>

                {viewMode === 'BRACKETS' ? (
                    /* --- EXISTING BRACKETS LIST --- */
                    <>
                        <Text style={{ color: theme.mutedText, fontSize: 16, marginBottom: 30 }}>Manage your 2036 Tournament bracket entries. Press and hold down on a bracket you've made to change its name.</Text>
                        <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700', marginBottom: 15 }}>My Brackets ({brackets.length}/10)</Text>

                        {brackets.map((b) => (
                            <Pressable
                                key={b.id}
                                onPress={() => setSelectedBracketId(b.id)}
                                onLongPress={() => handleRenameBracket(b.id, b.name)}
                                style={{
                                    backgroundColor: theme.card,
                                    padding: 16,
                                    borderRadius: 15,
                                    marginBottom: 12,
                                    borderWidth: 1,
                                    borderColor: theme.border,
                                    flexDirection: 'row',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}
                            >
                                <View style={{ flex: 1 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Text style={{ color: theme.text, fontSize: 18, fontWeight: '800' }}>{b.name}</Text>
                                        {b.is_locked && <Text style={{ marginLeft: 8, fontSize: 12 }}>🔒</Text>}
                                    </View>

                                    <View style={{ flexDirection: 'row', marginTop: 6, alignItems: 'center' }}>
                                        <View style={{
                                            backgroundColor: b.is_locked ? '#34C75922' : '#FF950022',
                                            paddingHorizontal: 8,
                                            paddingVertical: 2,
                                            borderRadius: 4,
                                            marginRight: 10
                                        }}>
                                            <Text style={{ color: b.is_locked ? '#34C759' : '#FF9500', fontSize: 10, fontWeight: '900' }}>
                                                {b.is_locked ? 'LOCKED' : 'DRAFT'}
                                            </Text>
                                        </View>
                                        <Text style={{ color: theme.text, fontSize: 12, fontWeight: '600' }}>
                                            {b.pick_count ?? 0} / 79 Picks Made
                                        </Text>
                                    </View>
                                </View>

                                {/* ONLY SHOW DELETE IF NOT LIVE */}
                                {phase !== 'LIVE' && (
                                    <Pressable
                                        onPress={() => handleDeleteBracket(b.id)}
                                        style={{ padding: 10, marginLeft: 10 }}
                                    >
                                        <Text style={{ fontSize: 18 }}>🗑️</Text>
                                    </Pressable>
                                )}
                            </Pressable>
                        ))}

                        {/* ONLY SHOW CREATE BUTTON IF PREDICTIONS ARE OPEN */}
                        {phase === 'SELECTION_SUNDAY' && brackets.length < 10 && (
                            <Pressable
                                onPress={handleCreateBracket}
                                style={{ backgroundColor: '#007AFF', padding: 18, borderRadius: 15, alignItems: 'center', marginTop: 10 }}
                            >
                                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>+ Create New Bracket</Text>
                            </Pressable>
                        )}

                        {/* Show a "Locked" notice if the tournament has started */}
                        {phase === 'LIVE' && (
                            <View style={{ padding: 18, borderRadius: 15, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, alignItems: 'center', marginTop: 10 }}>
                                <Text style={{ color: theme.mutedText, fontWeight: '700' }}>🔒 Tournament Started: Entries Locked</Text>
                            </View>
                        )}
                    </>
                ) : (
                    /* --- GROUPS VIEW --- */
                    <>
                        <Text style={{ color: theme.mutedText, fontSize: 16, marginBottom: 30 }}>Compete against friends in custom leagues.</Text>

                        {myGroups.length > 0 ? (
                            myGroups.map((g, index) => {
                                // Check if the current logged-in user is the creator
                                const isOwner = g.owner_user_id === currentUserId;

                                return (
                                    <View
                                        key={`${g.id}-${index}`}
                                        style={{
                                            backgroundColor: theme.card,
                                            padding: 18,
                                            borderRadius: 15,
                                            marginBottom: 12,
                                            borderWidth: 1,
                                            borderColor: theme.border,
                                            flexDirection: 'row',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}
                                    >
                                        <Pressable
                                            style={{ flex: 1 }}
                                            onPress={() => loadLeaderboard(g.id, g.name)}
                                        >
                                            <Text style={{ color: theme.text, fontSize: 17, fontWeight: '800' }}>{g.name}</Text>
                                            <Text style={{ color: theme.mutedText, fontSize: 12, marginTop: 4 }}>
                                                {isOwner ? `CODE: ${g.join_code} (OWNER)` : `CODE: ${g.join_code}`}
                                            </Text>
                                        </Pressable>

                                        {/* DYNAMIC ACTION: Delete for owner, Leave for member (Only visible if NOT live)*/}
                                        {phase !== 'LIVE' && (
                                            <Pressable
                                                onPress={() => isOwner ? handleDeleteGroup(g.id) : handleLeaveGroup(g.id)}
                                                style={{ padding: 10, marginLeft: 10 }}
                                            >
                                                <Text style={{ fontSize: 18 }}>{isOwner ? '🗑️' : '🚪'}</Text>
                                            </Pressable>
                                        )}
                                    </View>
                                );
                            })
                        ) : (
                            <View style={{ alignItems: 'center', marginVertical: 40 }}>
                                <Text style={{ fontSize: 40, marginBottom: 10 }}>🏆</Text>
                                <Text style={{ color: theme.text, fontWeight: '700' }}>No Groups Joined Yet</Text>
                            </View>
                        )}

                        {/* ONLY SHOW GROUP CONTROLS IF NOT LIVE */}
                        {phase === 'SELECTION_SUNDAY' && (
                            <>
                                <Pressable
                                    onPress={handleCreateGroup}
                                    style={{ backgroundColor: '#5856D6', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 }}
                                >
                                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>+ Create a Group</Text>
                                </Pressable>

                                <Pressable
                                    onPress={handleJoinGroup}
                                    style={{ borderWidth: 1, borderColor: '#5856D6', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 12 }}
                                >
                                    <Text style={{ color: '#5856D6', fontWeight: 'bold' }}>Join with Code</Text>
                                </Pressable>
                            </>
                        )}
                    </>
                )}
            </ScrollView>
        </>
    );
}
