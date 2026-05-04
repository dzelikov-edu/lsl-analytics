import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, Pressable } from 'react-native';
import { API_BASE_URL } from '@/lib/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppColors } from '@/constants/app-colors';
import TournamentMap from '../tournament/map';
import { getToken } from '@/lib/auth-storage';

export default function BracketTab() {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = AppColors[colorScheme];
    const [phase, setPhase] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [personalSim, setPersonalSim] = useState<any[] | null>(null);
    const [simLoading, setSimLoading] = useState(false);

    useEffect(() => {
        async function checkPhase() {
            try {
                const res = await fetch(`${API_BASE_URL}/api/tournament/state?season=2036`);
                const data = await res.json();
                setPhase(data.phase);
            } catch (e) {
                setPhase('BRACKETOLOGY');
            } finally {
                setLoading(false);
            }
        }
        checkPhase();
    }, []);

    if (loading) return <ActivityIndicator style={{ flex: 1 }} color={theme.text} />;

    if (phase === 'BRACKETOLOGY') {
        return (
            <View style={{ flex: 1, backgroundColor: theme.background }}>
                <View style={{ padding: 12, paddingTop: 48 }}>
                    <Pressable
                        onPress={async () => {
                            setSimLoading(true);
                            try {
                                const token = await getToken();
                                if (!token) {
                                    console.log("No token; cannot run personal sim.");
                                    return;
                                }
                                const res = await fetch(`${API_BASE_URL}/api/tournament/simulate?season=2036`, {
                                    method: 'POST',
                                    headers: { Authorization: `Bearer ${token}` },
                                });
                                if (res.ok) {
                                    const data = await res.json();
                                    if (Array.isArray(data) && data.length > 0) {
                                        setPersonalSim(data);
                                    } else {
                                        console.log("Personal sim returned empty data.");
                                    }
                                } else {
                                    console.log("Personal sim failed:", res.status);
                                }
                            } catch (e) {
                                console.log("Error running personal sim:", e);
                            } finally {
                                setSimLoading(false);
                            }
                        }}
                        style={{
                            borderRadius: 10,
                            paddingVertical: 10,
                            paddingHorizontal: 14,
                            backgroundColor: '#5856D6',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>
                            {simLoading ? 'Running AI Bracketology Sim…' : 'Run AI Bracketology Sim'}
                        </Text>
                        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 10, marginTop: 2 }}>
                            This sim is just for you. It won’t affect the published projection.
                        </Text>
                    </Pressable>
                </View>

                {/* Map fills the rest */}
                <View style={{ flex: 1 }}>
                    <TournamentMap
                        isMock={true}
                        overrideBracketData={personalSim ?? undefined}
                    />
                </View>
            </View>
        );
    }

    // Mode 2: Show the Real Bracket (Official)
    return <TournamentMap isMock={false} />;
}

