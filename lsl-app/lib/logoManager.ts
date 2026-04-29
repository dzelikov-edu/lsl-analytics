// lib/logoManager.ts (Folder Sync Version)
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';

const docDir = (FileSystem as any).documentDirectory;
const TEAM_LOGO_DIR = `${docDir}team-logos/`;
const CONF_LOGO_DIR = `${docDir}conference-logos/`;

// Base URLs pointing to your public GitHub folders
// Ensure these match your actual repo structure and username!
const GITHUB_TEAMS_BASE = "https://raw.githubusercontent.com/dzelikov-edu/lsl-realism-mods/main/team-logos/";
const GITHUB_CONFS_BASE = "https://raw.githubusercontent.com/dzelikov-edu/lsl-realism-mods/main/conference-logos/";

// Hardcoded list of your 9 conferences to ensure they sync
const CONFERENCES = ["AAC", "ACC", "B10", "B12", "BE", "MW", "P12", "SEC", "WCC"];

export async function importLogoPack(teamIds: string[]) {
    console.log(`[SYNC] Starting sync for ${teamIds.length} teams and ${CONFERENCES.length} conferences...`);

    try {
        // 1. Ensure both local directories exist on the device
        await FileSystem.makeDirectoryAsync(TEAM_LOGO_DIR, { intermediates: true }).catch(() => { });
        await FileSystem.makeDirectoryAsync(CONF_LOGO_DIR, { intermediates: true }).catch(() => { });

        let successCount = 0;
        let failCount = 0;

        // 2. Sync Team Logos (one by one)
        for (const tid of teamIds) {
            const fileName = `${tid}.png`;
            const downloadUrl = `${GITHUB_TEAMS_BASE}${fileName}`;
            const fileUri = `${TEAM_LOGO_DIR}${fileName}`;

            try {
                const res = await FileSystem.downloadAsync(downloadUrl, fileUri);

                if (res.status === 200) {
                    successCount++;
                } else {
                    failCount++;
                }
            } catch (e) {
                failCount++;
            }

            if ((successCount + failCount) % 50 === 0) { // Log progress every 50 downloads
                console.log(`[SYNC] Team Progress: ${successCount + failCount}/${teamIds.length}`);
            }
        }

        // 3. Sync Conference Logos (one by one)
        for (const conf of CONFERENCES) {
            const fileName = `${conf}.png`;
            const downloadUrl = `${GITHUB_CONFS_BASE}${fileName}`;
            const fileUri = `${CONF_LOGO_DIR}${fileName}`;

            try {
                const res = await FileSystem.downloadAsync(downloadUrl, fileUri);
                if (res.status === 200) successCount++;
                else failCount++;
            } catch (e) {
                failCount++;
            }
        }

        // 4. Mark that custom logos are now available
        await AsyncStorage.setItem('has_custom_logos', 'true');
        console.log(`[SYNC] ✅ Finished. Success: ${successCount}, Fail: ${failCount}`);
        return true;

    } catch (error) {
        console.error('[SYNC] ❌ Fatal error during sync:', error);
        return false;
    }
}
