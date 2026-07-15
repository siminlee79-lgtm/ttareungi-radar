const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

// Renders the Play Console listing images. These are uploaded by hand in the
// console, so they live in assets/ rather than the Android project.
const projectRoot = path.resolve(__dirname, "..");
const assetsDir = path.join(projectRoot, "assets");

const targets = [
  // Play requires a 512x512 icon and applies its own rounded mask, so the
  // source is the square (non-rounded) variant.
  { source: "store-icon.svg", output: "play-store-icon-512.png", width: 512, height: 512, flatten: true },
  { source: "feature-graphic.svg", output: "play-feature-graphic-1024x500.png", width: 1024, height: 500, flatten: true },
];

async function main() {
  for (const target of targets) {
    const sourcePath = path.join(assetsDir, target.source);
    const outputPath = path.join(assetsDir, target.output);

    let pipeline = sharp(fs.readFileSync(sourcePath), { density: 384 }).resize(target.width, target.height);

    // Play rejects alpha on these, so composite onto the brand background.
    if (target.flatten) {
      pipeline = pipeline.flatten({ background: "#2f4050" });
    }

    const info = await pipeline.png().toFile(outputPath);
    const sizeKb = (info.size / 1024).toFixed(1);
    console.log(`${target.output.padEnd(36)} ${info.width}x${info.height}  ${sizeKb} KB  alpha=${info.channels === 4}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
