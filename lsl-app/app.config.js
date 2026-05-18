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
                projectId: "f20baf8d-6663-422d-93a7-04984c1b3562",
            },
        },
        updates: {
            url: "https://u.expo.dev/f20baf8d-6663-422d-93a7-04984c1b3562"
        }
    };
};