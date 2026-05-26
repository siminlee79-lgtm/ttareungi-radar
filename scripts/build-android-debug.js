const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const androidDir = path.join(projectRoot, "android");
const androidStudioJbr = "C:\\Program Files\\Android\\Android Studio\\jbr";

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

const env = { ...process.env };

if (!env.JAVA_HOME && fs.existsSync(androidStudioJbr)) {
  env.JAVA_HOME = androidStudioJbr;
  env.Path = `${path.join(androidStudioJbr, "bin")};${env.Path || ""}`;
}

run("npm run cap:sync", { env });
run(process.platform === "win32" ? "gradlew.bat assembleDebug" : "./gradlew assembleDebug", { cwd: androidDir, env });
