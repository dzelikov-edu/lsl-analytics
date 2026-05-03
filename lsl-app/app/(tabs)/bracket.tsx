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
        // Mode 1: Show the Mock Bracket (Projections)
        return <TournamentMap isMock={true} />;
    }

    // Mode 2: Show the Real Bracket (Official)
    return <TournamentMap isMock={false} />;
}

