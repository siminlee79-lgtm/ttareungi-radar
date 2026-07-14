const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const sharp = require("sharp");

// Post-processes @capacitor/assets output so the Android adaptive icon is correct.
//
// Two things the generator gets wrong for our sources:
//   1. It wraps both layers in <inset android:inset="16.7%">. Our
//      icon-foreground.svg already sits inside the 66% safe zone, so the extra
//      inset shrinks the logo to ~42% of the layer, and an inset background
//      leaves the mask edges transparent instead of full-bleed white.
//   2. It emits the layers at the legacy 48dp launcher size, but an adaptive
//      layer is 108dp — the logo gets upscaled and goes soft.
//
// So we re-render the foreground from the SVG at true 108dp sizes, point the
// background at the flat colour resource, and drop the unused background PNGs.

const projectRoot = path.resolve(__dirname, "..");
const foregroundSvg = path.join(projectRoot, "assets", "icon-foreground.svg");
const resDir = path.join(projectRoot, "android", "app", "src", "main", "res");

// Keep in sync with the <rect> fill in assets/icon-background.svg.
const backgroundColor = "#2F4050";

const densities = {
  mdpi: 108,
  hdpi: 162,
  xhdpi: 216,
  xxhdpi: 324,
  xxxhdpi: 432,
};

const adaptiveIconXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
`;

function runGenerator() {
  const result = spawnSync("npx", ["@capacitor/assets", "generate", "--android"], {
    cwd: projectRoot,
    shell: true,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

async function renderForeground() {
  const svg = fs.readFileSync(foregroundSvg);

  for (const [density, size] of Object.entries(densities)) {
    const target = path.join(resDir, `mipmap-${density}`, "ic_launcher_foreground.png");
    fs.mkdirSync(path.dirname(target), { recursive: true });
    await sharp(svg, { density: 384 })
      .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(target);
    console.log(`foreground ${density.padEnd(8)} ${size}x${size}`);
  }
}

function writeAdaptiveXml() {
  for (const name of ["ic_launcher.xml", "ic_launcher_round.xml"]) {
    const target = path.join(resDir, "mipmap-anydpi-v26", name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, adaptiveIconXml, "utf8");
    console.log(`xml        ${name} (no inset, flat colour background)`);
  }
}

function writeBackgroundColor() {
  const target = path.join(resDir, "values", "ic_launcher_background.xml");
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${backgroundColor}</color>
</resources>
`;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, xml, "utf8");
  console.log(`colour     ic_launcher_background = ${backgroundColor}`);
}

function removeBackgroundPngs() {
  for (const density of Object.keys(densities)) {
    const target = path.join(resDir, `mipmap-${density}`, "ic_launcher_background.png");
    if (fs.existsSync(target)) {
      fs.rmSync(target);
      console.log(`removed    mipmap-${density}/ic_launcher_background.png`);
    }
  }
}

async function main() {
  if (!process.argv.includes("--skip-generate")) {
    runGenerator();
  }

  await renderForeground();
  writeAdaptiveXml();
  writeBackgroundColor();
  removeBackgroundPngs();
  console.log("\nAndroid icons ready.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
