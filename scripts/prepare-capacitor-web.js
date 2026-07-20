const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const outputDir = path.join(projectRoot, "www");

const files = [
  "index.html",
  "developer.html",
  "privacy.html",
  "terms.html",
  "location.html",
  "app-ads.txt",
  "robots.txt",
  "sitemap.xml",
  "app.js",
  "styles.css",
  "manifest.webmanifest",
  "service-worker.js",
];

const directories = ["data", "guides", "icons"];

function copyFile(relativePath) {
  const source = path.join(projectRoot, relativePath);
  const target = path.join(outputDir, relativePath);

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function copyDirectory(relativePath) {
  const source = path.join(projectRoot, relativePath);
  const target = path.join(outputDir, relativePath);

  fs.mkdirSync(target, { recursive: true });

  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const childRelativePath = path.join(relativePath, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(childRelativePath);
    } else {
      copyFile(childRelativePath);
    }
  }
}

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });

for (const file of files) {
  copyFile(file);
}

for (const directory of directories) {
  copyDirectory(directory);
}

fs.writeFileSync(
  path.join(outputDir, "config.local.js"),
  [
    "window.TTAREUNGI_CONFIG = {",
    "  ...(window.TTAREUNGI_CONFIG || {}),",
    "  IS_NATIVE_APP: true,",
    '  APP_VERSION: "v53",',
    '  API_BASE_URL: "https://ttareungi-radar.pages.dev",',
    "};",
    "",
  ].join("\n"),
  "utf8",
);

console.log(`Capacitor web assets prepared: ${outputDir}`);
