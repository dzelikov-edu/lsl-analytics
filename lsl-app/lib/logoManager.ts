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
const GITHUB_NAMES_URL = "https://raw.githubusercontent.com/dzelikov-edu/lsl-realism-mods/main/team_names.json";

// Hardcoded list of your 9 conferences to ensure they sync
const CONFERENCES = ["AAC", "ACC", "B10", "B12", "BE", "MW", "P12", "SEC", "WCC"];

// Special non-team IDs that should also sync from the team-logos folder
// The file must exist at: team-logos/LCAA_FOREVER_FOUR.png in your GitHub repo
const SPECIAL_TEAM_ASSETS = ["LCAA_FOREVER_FOUR"];

export async function importLogoPack(teamIds: string[], onProgress?: (current: number, total: number) => void) {
    console.log(`[SYNC] Starting sync for ${teamIds.length} teams and ${CONFERENCES.length} conferences...`);

    try {
        // 1. Ensure both local directories exist on the device
        await FileSystem.makeDirectoryAsync(TEAM_LOGO_DIR, { intermediates: true }).catch(() => { });
        await FileSystem.makeDirectoryAsync(CONF_LOGO_DIR, { intermediates: true }).catch(() => { });

        let successCount = 0;
        let failCount = 0;
        const totalFiles = teamIds.length + CONFERENCES.length + SPECIAL_TEAM_ASSETS.length;

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
            if (onProgress) onProgress(successCount + failCount, totalFiles);
        }

        // 2b. Sync special non-team assets (e.g., LCAA_FOREVER_FOUR)
        for (const tid of SPECIAL_TEAM_ASSETS) {
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
            if (onProgress) onProgress(successCount + failCount, totalFiles);
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
            if (onProgress) onProgress(successCount + failCount, totalFiles);
        }

        // 4. Download the Team Name Mapping File
        const namesPath = `${FileSystem.documentDirectory}team_names.json`;
        try {
            await FileSystem.downloadAsync(GITHUB_NAMES_URL, namesPath);
            console.log("[SYNC] ✅ Team names mapping downloaded.");
        } catch (e) {
            console.log("[SYNC] ⚠️ Team names download failed.");
        }

        // 5. Mark that custom logos are now available
        await AsyncStorage.setItem('has_custom_logos', 'true');
        console.log(`[SYNC] ✅ Finished. Success: ${successCount}, Fail: ${failCount}`);
        return true;

    } catch (error) {
        console.error('[SYNC] ❌ Fatal error during sync:', error);
        return false;
    }
}
