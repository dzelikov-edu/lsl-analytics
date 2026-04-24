import 'dotenv/config';

export default ({ config }) => {
    return {
        ...config,
        plugins: [
            ...(config.plugins || []), // Keep existing plugins (like expo-router, expo-splash-screen, etc.)
            "expo-secure-store"
        ],
        extra: {
            ...config.extra,
            backendUrl: process.env.EXPO_PUBLIC_BACKEND_URL || 'https://lsl-analytics.onrender.com',
            eas: {
                projectId: process.env.EAS_PROJECT_ID || config.extra?.eas?.projectId,
            },
        },
        updates: {
            url: process.env.EAS_UPDATE_URL || config.updates?.url,
        }
    };
};
