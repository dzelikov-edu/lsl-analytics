import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { API_BASE_URL } from '@/lib/api';

export default function ConferenceDetailScreen() {
    const { confId } = useLocalSearchParams<{ confId: string }>();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [conference, setConference] = useState<any>(null);

    useEffect(() => {
        const loadConference = async () => {
            if (!confId) return;

            try {
                setLoading(true);
                setError(null);

                const response = await fetch(`${API_BASE_URL}/conferences/${confId}`);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const json = await response.json();
                setConference(json);
            } catch (err: any) {
                setError(err?.message ?? 'Unknown error');
            } finally {
                setLoading(false);
            }
        };

        loadConference();
    }, [confId]);

    const standings = conference?.standings ?? conference?.teams ?? [];

    return (
        <ScrollView contentContainerStyle={styles.content}>
            {loading ? (
                <View style={styles.centerBlock}>
                    <ActivityIndicator size="large" />
                    <Text style={styles.helper}>Loading conference...</Text>
                </View>
            ) : error ? (
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Error</Text>
                    <Text style={styles.context}>{error}</Text>
                </View>
            ) : !conference ? (
                <View style={styles.card}>
                    <Text style={styles.context}>No conference data available.</Text>
                </View>
            ) : (
                <>
                    <View style={styles.header}>
                        <Text style={styles.conferenceName}>
                            {conference.conf_name ?? conference.conference_name ?? confId}
                        </Text>
                        <Text style={styles.context}>
                            Conference Detail
                        </Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Standings</Text>
                        <View style={styles.card}>
                            {standings.length === 0 ? (
                                <Text style={styles.context}>No standings available.</Text>
                            ) : (
                                standings.map((row: any, index: number) => (
                                    <Text key={`${row.team_id ?? row.team_name}-${index}`} style={styles.listRow}>
                                        {index + 1}. {row.team_name ?? row.team_id}
                                    </Text>
                                ))
                            )}
                        </View>
                    </View>
                </>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    content: {
        padding: 20,
        paddingBottom: 40,
        backgroundColor: '#fff',
    },
    header: {
        marginBottom: 24,
    },
    conferenceName: {
        fontSize: 32,
        fontWeight: '800',
        marginBottom: 6,
    },
    section: {
        marginBottom: 14,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 10,
    },
    centerBlock: {
        paddingVertical: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    helper: {
        fontSize: 15,
        opacity: 0.7,
        marginTop: 12,
    },
    card: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 14,
        padding: 14,
        marginBottom: 14,
        backgroundColor: '#fafafa',
    },
    context: {
        fontSize: 15,
        opacity: 0.75,
    },
    listRow: {
        fontSize: 16,
        marginBottom: 8,
    },
});