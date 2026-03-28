import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function TeamsScreen() {
    return (
        <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.screenTitle}>Teams</Text>

            <View style={styles.teamCard}>
                <View style={styles.cardHeader}>
                    <Text style={styles.teamName}>Creighton</Text>
                    <Text style={styles.pollBadge}>#1</Text>
                </View>
                <Text style={styles.analyticsStrip}>Power #1 • Resume — • Form — • SOS —</Text>
            </View>

            <View style={styles.teamCard}>
                <View style={styles.cardHeader}>
                    <Text style={styles.teamName}>Marquette</Text>
                    <Text style={styles.pollBadge}>#2</Text>
                </View>
                <Text style={styles.analyticsStrip}>Power #2 • Resume — • Form — • SOS —</Text>
            </View>

            <View style={styles.teamCard}>
                <View style={styles.cardHeader}>
                    <Text style={styles.teamName}>Michigan</Text>
                    <Text style={styles.pollBadge}>#3</Text>
                </View>
                <Text style={styles.analyticsStrip}>Power #3 • Resume — • Form — • SOS —</Text>
            </View>

            <View style={styles.teamCard}>
                <View style={styles.cardHeader}>
                    <Text style={styles.teamName}>Kansas</Text>
                    <Text style={styles.pollBadge}>#5</Text>
                </View>
                <Text style={styles.analyticsStrip}>Power #5 • Resume — • Form — • SOS —</Text>
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
    teamCard: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 14,
        padding: 14,
        marginBottom: 12,
        backgroundColor: '#fafafa',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    teamName: {
        fontSize: 22,
        fontWeight: '700',
    },
    pollBadge: {
        fontSize: 18,
        fontWeight: '700',
    },
    analyticsStrip: {
        fontSize: 14,
        opacity: 0.75,
    },
});