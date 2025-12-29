import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'com.votetok.app',
    appName: 'VouTop',
    webDir: 'build',
    server: {
        url: 'https://voutop.com', // ← Apuntar a producción
        androidScheme: 'https',
        cleartext: false
    }
};

export default config;
