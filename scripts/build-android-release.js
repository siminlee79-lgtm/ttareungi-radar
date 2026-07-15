const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const androidDir = path.join(projectRoot, "android");
const androidStudioJbr = "C:\\Program Files\\Android\\Android Studio\\jbr";
const keystorePropertiesFile = path.join(androidDir, "keystore.properties");
const aabPath = path.join(androidDir, "app", "build", "outputs", "bundle", "release", "app-release.aab");

function run(command, options = {}) {
  const result = spawnSync(command, {
    cwd: options.cwd || projectRoot,
    env: options.env || process.env,
    shell: true,
    stdio: "inherit",
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

if (!fs.existsSync(keystorePropertiesFile)) {
  console.error("Missing android/keystore.properties — the bundle would be unsigned.");
  console.error("Copy android/keystore.properties.example and fill in the upload key details.");
  process.exit(1);
}

const env = { ...process.env };

if (!env.JAVA_HOME && fs.existsSync(androidStudioJbr)) {
  env.JAVA_HOME = androidStudioJbr;
  env.Path = `${path.join(androidStudioJbr, "bin")};${env.Path || ""}`;
}

// Call the wrapper by absolute path: cmd.exe does not reliably resolve a bare
// "gradlew.bat" from the spawned shell's cwd, so a relative name fails with
// "'gradlew.bat' is not recognized".
const gradlew = path.join(androidDir, process.platform === "win32" ? "gradlew.bat" : "gradlew");

run("npm run cap:sync", { env });
run(`"${gradlew}" bundleRelease`, { cwd: androidDir, env });

if (!fs.existsSync(aabPath)) {
  console.error(`\nBuild reported success but no bundle at ${aabPath}`);
  process.exit(1);
}

const sizeMb = (fs.statSync(aabPath).size / 1024 / 1024).toFixed(2);
console.log(`\nBundle ready: ${path.relative(projectRoot, aabPath)} (${sizeMb} MB)`);
