import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { API_BASE_URL } from '@/lib/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppColors } from '@/constants/app-colors';
import TournamentMap from '../tournament/map'; // We will adjust map.tsx next

export default function BracketTab() {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = AppColors[colorScheme];
    const [phase, setPhase] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

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
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
                <Text style={{ color: theme.text, fontSize: 24, fontWeight: 'bold' }}>Mock Bracket View</Text>
                <Text style={{ color: theme.mutedText, marginTop: 10 }}>The projected Top 80 will appear here.</Text>
                {/* We will build the Mock View next */}
            </View>
        );
    }

    // If Phase is LIVE or SELECTION_SUNDAY, show the real map
    return <TournamentMap />;
}
