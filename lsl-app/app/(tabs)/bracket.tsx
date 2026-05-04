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

    const runPersonalSim = async () => {
        if (simLoading) return;
        console.log('Running personal sim...');
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
    };

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
                <TournamentMap
                    isMock={true}
                    overrideBracketData={personalSim ?? undefined}
                    onRunPersonalSim={runPersonalSim}
                />
            </View>
        );
    }

    // Mode 2: Show the Real Bracket (Official)
    return <TournamentMap isMock={false} />;
}

