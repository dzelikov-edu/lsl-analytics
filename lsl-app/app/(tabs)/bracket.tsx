import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ActivityIndicator, Pressable, ScrollView, StyleSheet, Alert } from 'react-native';
import { API_BASE_URL } from '@/lib/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppColors } from '@/constants/app-colors';
import TournamentMap from '../tournament/map';
import { getToken } from '@/lib/auth-storage';
import { useFocusEffect } from 'expo-router';

export default function BracketTab() {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = AppColors[colorScheme];

    const [phase, setPhase] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [brackets, setBrackets] = useState<any[]>([]);
    const [selectedBracketId, setSelectedBracketId] = useState<string | null>(null);

    // Sim State
    const [personalSim, setPersonalSim] = useState<any[] | null>(null);
    const [simLoading, setSimLoading] = useState(false);

    const loadInitialData = async () => {
        try {
            const token = await getToken();
            const [stateRes, bracketsRes] = await Promise.all([
                fetch(`${API_BASE_URL}/api/tournament/state?season=2036`),
                fetch(`${API_BASE_URL}/api/tournament/brackets?season=2036`, { headers: { Authorization: `Bearer ${token}` } })
            ]);

            const stateData = await stateRes.json();
            const bracketListData = await bracketsRes.json();

            setPhase(stateData.phase);
            setBrackets(bracketListData);
        } catch (e) {
            console.error(e);
            setPhase('BRACKETOLOGY');
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(useCallback(() => { loadInitialData(); }, []));

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
                <TournamentMap isMock={true} overrideBracketData={personalSim ?? undefined} onRunPersonalSim={runPersonalSim} />
            </View>
        );
    }

    // 2. Map View (If a bracket is selected)
    if (selectedBracketId) {
        return (
            <View style={{ flex: 1, backgroundColor: theme.background }}>
                {/* Header for the Map to get back to the list */}
                <View style={{ height: 90, backgroundColor: theme.background, justifyContent: 'flex-end', paddingBottom: 10, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: theme.border }}>
                    <Pressable onPress={() => setSelectedBracketId(null)}>
                        <Text style={{ color: '#007AFF', fontWeight: 'bold' }}>← My Brackets</Text>
                    </Pressable>
                </View>
                <TournamentMap isMock={false} initialBracketId={selectedBracketId} />
            </View>
        );
    }

    // 3. List View (Default LIVE state)
    return (
        <ScrollView style={{ flex: 1, backgroundColor: theme.background }} contentContainerStyle={{ padding: 20, paddingTop: 60 }}>
            <Text style={{ color: theme.text, fontSize: 32, fontWeight: '800', marginBottom: 5 }}>LCAA Bracket Challenge</Text>
            <Text style={{ color: theme.mutedText, fontSize: 16, marginBottom: 30 }}>Manage your 2036 Tournament bracket entries.</Text>

            <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700', marginBottom: 15 }}>My Brackets ({brackets.length}/10)</Text>

            {/* Replace the brackets.map block with this */}
            {brackets.map((b) => (
                <Pressable
                    key={b.id}
                    onPress={() => setSelectedBracketId(b.id)}
                    onLongPress={() => handleRenameBracket(b.id, b.name)} // Added Renaming
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
                                    {b.is_locked ? 'PUBLISHED' : 'DRAFT'}
                                </Text>
                            </View>
                            {/* We will add real pick counts here in the next step */}
                            <Text style={{ color: theme.text, fontSize: 12, fontWeight: '600' }}>
                                {b.pick_count ?? 0} / 79 Picks Made
                            </Text>
                        </View>
                    </View>

                    <Pressable
                        onPress={() => handleDeleteBracket(b.id)}
                        style={{ padding: 10 }}
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
        </ScrollView>
    );
}
