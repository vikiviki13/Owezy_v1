import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.owezy.app',
  appName: 'Owezy',
  webDir: 'dist',
  android: {
    path: 'Mobile app/android',
    buildOptions: {
      releaseType: 'APK'
    }
  },
  ios: {
    path: 'Mobile app/ios'
  }
};

export default config;
