/** @type {import('@capacitor/cli').CapacitorConfig} */
const config = {
  appId: "com.bikeradarseoul.app",
  appName: "Bike Radar Seoul",
  webDir: "www",
  bundledWebRuntime: false,
  server: {
    androidScheme: "https",
  },
};

module.exports = config;
