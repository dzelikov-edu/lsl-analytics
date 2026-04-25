import 'dotenv/config';

export default ({ config }) => {
    return {
        ...config,
        // --- ADD THIS BACK (EAS REQUIRES IT) ---
        runtimeVersion: {
            policy: "appVersion"
        },
        // ---------------------------------------
        plugins: [
            ...(config.plugins || []),
            "expo-secure-store"
        ],
        extra: {
            ...config.extra,
            backendUrl: 'https://lsl-backend.onrender.com',
            eas: {
                projectId: "1123b7ce-5272-4e3c-a214-fca8911aa554",
            },
        },
        updates: {
            url: "https://u.expo.dev/1123b7ce-5272-4e3c-a214-fca8911aa554"
        }
    };
};
