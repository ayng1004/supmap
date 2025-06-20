// Remplacer l'import par une forme compatible avec les environnements non-module
const { MAPBOX_API_KEY } = process.env;

module.exports = {
  name: "frontend-mobile",
  slug: "frontend-mobile",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  // Ajout du schéma URL pour les deep links
  scheme: "4proj",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff"
  },
  scheme: "4proj",
  updates: {
    fallbackToCacheTimeout: 0
  },
  assetBundlePatterns: [
    "**/*"
  ],
  ios: {
    bundleIdentifier: "com.ayng.frontendmobile",
    supportsTablet: true,
    buildNumber: "1.0.0",
    infoPlist: {
      UIBackgroundModes: ["location", "fetch"],
      NSLocationWhenInUseUsageDescription: "SupMap utilise votre localisation pour vous montrer les incidents à proximité et vous aider à naviguer.",
      NSLocationAlwaysAndWhenInUseUsageDescription: "SupMap utilise votre localisation en arrière-plan pour vous alerter des incidents à proximité.",
      NSLocationAlwaysUsageDescription: "SupMap utilise votre localisation en arrière-plan pour vous alerter des incidents à proximité."
    }
  },
  android: {
    package: "com.ayng.frontendmobile",
    versionCode: 1,
    permissions: [
      "ACCESS_FINE_LOCATION",
      "ACCESS_COARSE_LOCATION",
      "INTERNET"
    ],
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          {
            scheme: "4proj"
          },
          {
            scheme: "https",
            host: "4proj.app",
            pathPrefix: "/"
          }
        ],
        category: [
          "BROWSABLE",
          "DEFAULT"
        ]
      }
    ],
    jsEngine: "hermes"
  },
  extra: {
    eas: {
      projectId: "587d92f2-3ccf-4738-bbe6-13cef52a2029"
    },
    API_URL: "http://192.168.1.27:3001/",
    MAPBOX_API_KEY: MAPBOX_API_KEY
  },
  plugins: [
    "expo-secure-store",
    "expo-location"
    // Suppression du plugin expo-linking qui cause l'erreur
  ],
  runtimeVersion: {
    policy: "appVersion"
  }
};