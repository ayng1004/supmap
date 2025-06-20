import dotenv from 'dotenv';

// Charge dynamiquement .env.production ou .env.development
dotenv.config({
  path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development',
});

export default {
  expo: {
    name: "Trafine",
    slug: "trafine",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    extra: {
      API_URL: process.env.API_URL,
      MAPBOX_API_KEY: process.env.MAPBOX_API_KEY,
    },
    runtimeVersion: {
      policy: "nativeVersion"
    },
    updates: {
      fallbackToCacheTimeout: 0
    },
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: true,
      buildNumber: "1.0.0"
    },
    android: {
      versionCode: 1,
      package: "com.supmap.trafine",
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      permissions: [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "INTERNET"
      ]
    },
    web: {
      favicon: "./assets/favicon.png"
    }
  }
};
