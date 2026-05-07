import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ActivityIndicator, Pressable, ScrollView, StyleSheet, Alert, Image, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL } from '@/lib/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppColors } from '@/constants/app-colors';
import TournamentMap from '../tournament/map';
import { getToken } from '@/lib/auth-storage';
import { useFocusEffect } from 'expo-router';

export default function BracketTab() {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = AppColors[colorScheme];
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const isTablet = width >= 768;

    const [phase, setPhase] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [brackets, setBrackets] = useState<any[]>([]);
    const [selectedBracketId, setSelectedBracketId] = useState<string | null>(null);

    // Sim State
    const [personalSim, setPersonalSim] = useState<any[] | null>(null);
    const [simLoading, setSimLoading] = useState(false);

    const [viewMode, setViewMode] = useState<'BRACKETS' | 'GROUPS'>('BRACKETS');
    const [myGroups, setMyGroups] = useState<any[]>([]);

    const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
    const [leaderboard, setLeaderboard] = useState<any[]>([]);

    const loadInitialData = async () => {
        try {
            const token = await getToken();
            const [stateRes, bracketsRes, groupsRes] = await Promise.all([
                fetch(`${API_BASE_URL}/api/tournament/state?season=2036`),
                fetch(`${API_BASE_URL}/api/tournament/brackets?season=2036`, { headers: { Authorization: `Bearer ${token}` } }),
                fetch(`${API_BASE_URL}/api/tournament/groups/me?season=2036`, { headers: { Authorization: `Bearer ${token}` } }) // NEW
            ]);

            const stateData = await stateRes.json();
            const bracketListData = await bracketsRes.json();
            const groupsListData = await groupsRes.json(); // NEW

            setPhase(stateData.phase);
            setBrackets(bracketListData);
            setMyGroups(groupsListData); // NEW
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
        if (brackets.length >= 10) {
            Alert.alert("Limit Reached", "You can only create up to 10 brackets.");
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
            Alert.alert("Error", "Could not create bracket.");
        }
    };

    const handleCloseMap = () => {
        setSelectedBracketId(null); // Close the map
        loadInitialData();          // Refresh the list counts immediately
    };

    const handleRenameBracket = (id: string, currentName: string) => {
        Alert.prompt(
            "Rename Bracket",
            "Enter a new name for your entry:",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Rename",
                    onPress: async (newName?: string) => {
                        if (!newName) return;
                        const token = await getToken();
                        await fetch(`${API_BASE_URL}/api/tournament/brackets/${id}?name=${newName}`, {
                            method: 'PATCH',
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        loadInitialData(); // Refresh list
                    }
                }
            ],
            "plain-text",
            currentName
        );
    };

    const handleDeleteBracket = (id: string) => {
        Alert.alert(
            "Delete Bracket",
            "Are you sure? This will permanently remove this bracket and all its picks.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        const token = await getToken();
                        await fetch(`${API_BASE_URL}/api/tournament/brackets/${id}`, {
                            method: 'DELETE',
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        loadInitialData();
                    }
                }
            ]
        );
    };

    const handleCreateGroup = () => {
        Alert.prompt(
            "Create Bracket Group",
            "Enter a name for your league (e.g., The Office Pool):",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Create",
                    onPress: async (groupName?: string) => {
                        if (!groupName) return;
                        const token = await getToken();
                        const res = await fetch(`${API_BASE_URL}/api/tournament/groups?name=${groupName}&season=2036`, {
                            method: 'POST',
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        if (res.ok) {
                            Alert.alert("Success", "Group created! Share the code with friends.");
                            loadInitialData(); // Refresh both lists
                        }
                    }
                }
            ]
        );
    };

    const handleJoinGroup = () => {
        Alert.prompt(
            "Join Bracket Group",
            "Enter the 6-character join code:",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Next",
                    onPress: (code?: string) => { // Added type
                        if (!code) return;

                        // Create the buttons list
                        const bracketButtons = brackets.map(b => ({
                            text: b.name,
                            onPress: async () => {
                                const token = await getToken();
                                const res = await fetch(`${API_BASE_URL}/api/tournament/groups/join?code=${code.toUpperCase()}&user_bracket_id=${b.id}`, {
                                    method: 'POST',
                                    headers: { Authorization: `Bearer ${token}` }
                                });
                                const data = await res.json();
                                if (res.ok) {
                                    Alert.alert("Welcome!", `You've joined ${data.group_name}.`);
                                    loadInitialData();
                                } else {
                                    Alert.alert("Error", data.detail || "Failed to join group.");
                                }
                            }
                        }));

                        // Show selection with a separate cancel button to avoid type mismatch
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
    };

    const handleDeleteGroup = (id: string) => {
        Alert.alert(
            "Delete Group",
            "Are you sure? This will permanently disband this group for all members currently in it.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        const token = await getToken();
                        await fetch(`${API_BASE_URL}/api/tournament/groups/${id}`, {
                            method: 'DELETE',
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        loadInitialData(); // Refresh the list
                    }
                }
            ]
        );
    };

    const loadLeaderboard = async (groupId: string) => {
        setLoading(true);
        try {
            const token = await getToken();
            const res = await fetch(`${API_BASE_URL}/api/tournament/groups/${groupId}/leaderboard`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            setLeaderboard(data);
            setActiveGroupId(groupId);
        } catch (e) {
            Alert.alert("Error", "Could not load leaderboard.");
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
        return (
            <View style={{ flex: 1, backgroundColor: theme.background }}>
                {/* Header for the Map to get back to the list */}
                <View style={{ height: 90, backgroundColor: theme.background, justifyContent: 'flex-end', paddingBottom: 10, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: theme.border }}>
                    {/* CHANGE: Use handleCloseMap instead of an inline arrow function */}
                    <Pressable onPress={handleCloseMap}>
                        <Text style={{ color: '#007AFF', fontWeight: 'bold' }}>← My Brackets</Text>
                    </Pressable>
                </View>
                <TournamentMap isMock={false} initialBracketId={selectedBracketId} />
            </View>
        );
    }

    if (activeGroupId) {
        return (
            <ScrollView style={{ flex: 1, backgroundColor: theme.background }} contentContainerStyle={{ padding: 20, paddingTop: 60 }}>
                <Pressable onPress={() => setActiveGroupId(null)} style={{ marginBottom: 20 }}>
                    <Text style={{ color: '#007AFF', fontWeight: 'bold' }}>← Back to Groups</Text>
                </Pressable>

                <Text style={{ color: theme.text, fontSize: 28, fontWeight: '800' }}>Leaderboard</Text>
                <Text style={{ color: theme.mutedText, marginBottom: 30 }}>LCAA Tournament Standings</Text>

                {leaderboard.map((row, index) => (
                    <View key={index} style={{
                        backgroundColor: theme.card,
                        padding: 16,
                        borderRadius: 15,
                        marginBottom: 10,
                        borderWidth: index === 0 ? 2 : 1,
                        borderColor: index === 0 ? '#FFD700' : theme.border
                    }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            {/* Rank */}
                            <Text style={{ color: theme.text, fontSize: 18, fontWeight: '900', width: 35 }}>{index + 1}</Text>

                            {/* User Info */}
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: theme.text, fontWeight: '800', fontSize: 16 }}>{row.user_name}</Text>
                                <Text style={{ color: theme.mutedText, fontSize: 11 }}>{row.bracket_name}</Text>
                            </View>

                            {/* Scores */}
                            <View style={{ alignItems: 'flex-end' }}>
                                <Text style={{ color: theme.text, fontSize: 22, fontWeight: '900' }}>{row.score}</Text>
                                <Text style={{ color: theme.mutedText, fontSize: 10, fontWeight: '700' }}>{row.pts_rem} REM</Text>
                            </View>
                        </View>
                    </View>
                ))}
            </ScrollView>
        );
    }

    // 3. List View (Default LIVE state)
    return (
        <ScrollView style={{ flex: 1, backgroundColor: theme.background }} contentContainerStyle={{ padding: 20, paddingTop: 60 }}>
            <Text style={{ color: theme.text, fontSize: 32, fontWeight: '800', marginBottom: 5 }}>LCAA Tournament Bracket Challenge</Text>

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
                    <Text style={{ color: theme.mutedText, fontSize: 16, marginBottom: 30 }}>Manage your 2036 Tournament bracket entries.</Text>
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

                            <Pressable
                                onPress={() => handleDeleteBracket(b.id)}
                                style={{ padding: 10, marginLeft: 10 }}
                            >
                                <Text style={{ fontSize: 18 }}>🗑️</Text>
                            </Pressable>
                        </Pressable>
                    ))}

                    {brackets.length < 10 && (
                        <Pressable
                            onPress={handleCreateBracket}
                            style={{ backgroundColor: '#007AFF', padding: 18, borderRadius: 15, alignItems: 'center', marginTop: 10 }}
                        >
                            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>+ Create New Bracket</Text>
                        </Pressable>
                    )}
                </>
            ) : (
                /* --- GROUPS VIEW --- */
                <>
                    <Text style={{ color: theme.mutedText, fontSize: 16, marginBottom: 30 }}>Compete against friends in custom leagues.</Text>

                    {myGroups.length > 0 ? (
                        myGroups.map((g, index) => (
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
                                    onPress={() => loadLeaderboard(g.id)} // <--- CHANGE THIS
                                >
                                    <Text style={{ color: theme.text, fontSize: 17, fontWeight: '800' }}>{g.name}</Text>
                                    <Text style={{ color: theme.mutedText, fontSize: 12, marginTop: 4 }}>CODE: {g.join_code}</Text>
                                </Pressable>

                                {/* DELETE BUTTON */}
                                <Pressable
                                    onPress={() => handleDeleteGroup(g.id)}
                                    style={{ padding: 5, marginLeft: 10 }}
                                >
                                    <Text style={{ fontSize: 18 }}>🗑️</Text>
                                </Pressable>
                            </View>
                        ))
                    ) : (
                        <View style={{ alignItems: 'center', marginVertical: 40 }}>
                            <Text style={{ fontSize: 40, marginBottom: 10 }}>🏆</Text>
                            <Text style={{ color: theme.text, fontWeight: '700' }}>No Groups Joined Yet</Text>
                        </View>
                    )}

                    <Pressable
                        onPress={handleCreateGroup}
                        style={{ backgroundColor: '#5856D6', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 }}
                    >
                        <Text style={{ color: '#fff', fontWeight: 'bold' }}>+ Create a Group</Text>
                    </Pressable>

                    <Pressable
                        onPress={handleJoinGroup} // Update this line
                        style={{ borderWidth: 1, borderColor: '#5856D6', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 12 }}
                    >
                        <Text style={{ color: '#5856D6', fontWeight: 'bold' }}>Join with Code</Text>
                    </Pressable>
                </>
            )}
        </ScrollView>
    );
}
