import { AppColors } from '@/constants/app-colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { API_BASE_URL } from '@/lib/api';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type ConferenceRow = {
    conference_id: string;
    conference_name: string;
    teams_count?: number;
    week?: number;
    polls?: {
        LSL?: {
            week?: number;
            top25_count?: number;
            next5_count?: number;
        };
    };
};

export default function ConferencesScreen() {
    const colorScheme = useColorScheme() ?? 'light';
    const theme = AppColors[colorScheme];

    const styles = useMemo(
        () =>
            StyleSheet.create({
                content: {
                    padding: 20,
                    paddingBottom: 40,
                    backgroundColor: theme.background,
                },
                screenTitle: {
                    fontSize: 32,
                    fontWeight: '800',
                    marginBottom: 20,
                    color: theme.text,
                },
                centerBlock: {
                    paddingVertical: 40,
                    alignItems: 'center',
                    justifyContent: 'center',
                },
                helper: {
                    fontSize: 15,
                    color: theme.mutedText,
                    marginTop: 12,
                },
                card: {
                    borderWidth: 1,
                    borderColor: theme.border,
                    borderRadius: 14,
                    padding: 14,
                    marginBottom: 12,
                    backgroundColor: theme.card,
                },
                cardPressed: {
                    opacity: 0.75,
                },
                conferenceName: {
                    fontSize: 22,
                    fontWeight: '700',
                    marginBottom: 8,
                    color: theme.text,
                },
                context: {
                    fontSize: 15,
                    color: theme.mutedText,
                },
                errorTitle: {
                    fontSize: 18,
                    fontWeight: '700',
                    marginBottom: 8,
                    color: theme.text,
                },
            }),
        [theme]
    );

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [conferences, setConferences] = useState<ConferenceRow[]>([]);

    useEffect(() => {
        const loadConferences = async () => {
            try {
                setLoading(true);
                setError(null);

                const response = await fetch(`${API_BASE_URL}/conferences`);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const json = await response.json();
                setConferences(json?.conferences ?? []);
            } catch (err: any) {
                setError(err?.message ?? 'Unknown error');
            } finally {
                setLoading(false);
            }
        };

        loadConferences();
    }, []);

    const formatContext = (conf: ConferenceRow) => {
        const top25 = conf?.polls?.LSL?.top25_count ?? 0;
        const next5 = conf?.polls?.LSL?.next5_count ?? 0;

        if (top25 > 0 || next5 > 0) {
            return `Teams: ${conf.teams_count ?? 0} • LSL Top 25: ${top25} • Next 5: ${next5}`;
        }

        return `Teams: ${conf.teams_count ?? 0}`;
    };

    return (
        <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.screenTitle}>Conferences</Text>

            {loading ? (
                <View style={styles.centerBlock}>
                    <ActivityIndicator size="large" />
                    <Text style={styles.helper}>Loading conferences...</Text>
                </View>
            ) : error ? (
                <View style={styles.card}>
                    <Text style={styles.errorTitle}>Error</Text>
                    <Text style={styles.context}>{error}</Text>
                </View>
            ) : conferences.length === 0 ? (
                <View style={styles.card}>
                    <Text style={styles.context}>No conferences available.</Text>
                </View>
            ) : (
                conferences.map((conf) => (
                    <Pressable
                        key={conf.conference_id}
                        onPress={() => router.push(`/conference/${conf.conference_id}`)}
                        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
                        <Text style={styles.conferenceName}>{conf.conference_name}</Text>
                        <Text style={styles.context}>{formatContext(conf)}</Text>
                    </Pressable>
                ))
            )}
        </ScrollView>
    );
}