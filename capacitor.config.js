/** @type {import('@capacitor/cli').CapacitorConfig} */
const config = {
  appId: "com.bikeradarseoul.app",
  appName: "따릉이 레이더",
  webDir: "www",
  bundledWebRuntime: false,
  server: {
    androidScheme: "https",
  },
};

module.exports = config;
