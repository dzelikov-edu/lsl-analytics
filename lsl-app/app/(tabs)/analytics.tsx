import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function AnalyticsScreen() {
    return (
        <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.screenTitle}>Analytics</Text>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Leaders</Text>

                <View style={styles.card}>
                    <Text style={styles.cardLabel}>Power Leader</Text>
                    <Text style={styles.cardTeam}>Creighton</Text>
                    <Text style={styles.cardValue}>97.998</Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardLabel}>Resume Leader</Text>
                    <Text style={styles.cardTeam}>—</Text>
                    <Text style={styles.cardValue}>No games yet</Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardLabel}>Form Leader</Text>
                    <Text style={styles.cardTeam}>—</Text>
                    <Text style={styles.cardValue}>No games yet</Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardLabel}>Toughest Schedule</Text>
                    <Text style={styles.cardTeam}>—</Text>
                    <Text style={styles.cardValue}>No games yet</Text>
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Featured Insights</Text>
                <View style={styles.listCard}>
                    <Text style={styles.listRow}>Power Leader — Creighton</Text>
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Top Tables</Text>
                <View style={styles.listCard}>
                    <Text style={styles.listRow}>Power: Creighton, Marquette, Michigan, Oklahoma State, Kansas</Text>
                    <Text style={styles.listRow}>Resume: —</Text>
                    <Text style={styles.listRow}>Form: —</Text>
                    <Text style={styles.listRow}>SOS: —</Text>
                </View>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    content: {
        padding: 20,
        paddingBottom: 40,
        backgroundColor: '#fff',
    },
    screenTitle: {
        fontSize: 32,
        fontWeight: '800',
        marginBottom: 20,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 22,
        fontWeight: '700',
        marginBottom: 12,
    },
    card: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
        backgroundColor: '#fafafa',
    },
    cardLabel: {
        fontSize: 14,
        opacity: 0.65,
        marginBottom: 6,
    },
    cardTeam: {
        fontSize: 22,
        fontWeight: '700',
        marginBottom: 4,
    },
    cardValue: {
        fontSize: 15,
        opacity: 0.75,
    },
    listCard: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 14,
        padding: 14,
        backgroundColor: '#fafafa',
    },
    listRow: {
        fontSize: 16,
        marginBottom: 8,
    },
});