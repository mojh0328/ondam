import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.restaurantcostcalculator.app",
  appName: "Restaurant Cost Calculator",

  // Points to the Vite output produced by `pnpm build:cap`.
  // Run `pnpm cap:sync` after every web build to push updates into the
  // Android project.
  webDir: "dist/capacitor",

  server: {
    // Use HTTPS scheme on Android so SameSite=None cookies are honoured.
    androidScheme: "https",
  },
};

export default config;
