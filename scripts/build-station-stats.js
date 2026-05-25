const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const inputDir = path.join(projectRoot, "raw-data", "daily-usage");
const outputFile = path.join(projectRoot, "data", "station-stats.json");

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      row.push(cell);
      if (row.some((value) => value.trim())) {
        rows.push(row);
      }
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  if (row.some((value) => value.trim())) {
    rows.push(row);
  }

  return rows;
}

function findColumn(headers, candidates) {
  return headers.findIndex((header) => candidates.some((candidate) => header.includes(candidate)));
}

function readCSVFile(filePath) {
  const buffer = fs.readFileSync(filePath);
  const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
  const rows = parseCSV(text);

  if (rows.length < 2) {
    return [];
  }

  const headers = rows[0].map((header) => header.trim());
  const stationIndex = findColumn(headers, ["대여소", "대여소명", "station"]);
  const countIndex = findColumn(headers, ["이용건수", "대여건수", "count"]);

  if (stationIndex < 0 || countIndex < 0) {
    throw new Error(`${path.basename(filePath)}에서 대여소/이용건수 컬럼을 찾지 못했습니다.`);
  }

  return rows.slice(1).map((row) => ({
    stationName: String(row[stationIndex] || "").trim(),
    usageCount: Number(String(row[countIndex] || "0").replaceAll(",", "").trim()) || 0,
  }));
}

function normalizeStationName(name) {
  return name.replace(/^\d+\.\s*/, "").replace(/\s+/g, " ").trim();
}

function buildStats() {
  if (!fs.existsSync(inputDir)) {
    throw new Error(`입력 폴더가 없습니다: ${inputDir}`);
  }

  const sourceFiles = fs
    .readdirSync(inputDir)
    .filter((file) => file.toLowerCase().endsWith(".csv"))
    .sort();

  if (!sourceFiles.length) {
    throw new Error(`CSV 파일을 넣어주세요: ${inputDir}`);
  }

  const stationMap = new Map();

  sourceFiles.forEach((file) => {
    const rows = readCSVFile(path.join(inputDir, file));

    rows.forEach((row) => {
      const stationName = normalizeStationName(row.stationName);

      if (!stationName) {
        return;
      }

      const current = stationMap.get(stationName) || { stationName, usageCount: 0 };
      current.usageCount += row.usageCount;
      stationMap.set(stationName, current);
    });
  });

  const stations = [...stationMap.values()].filter((station) => station.usageCount > 0);
  const topRentalStations = [...stations].sort((a, b) => b.usageCount - a.usageCount).slice(0, 10);
  const lowUsageStations = [...stations].sort((a, b) => a.usageCount - b.usageCount || a.stationName.localeCompare(b.stationName, "ko-KR")).slice(0, 10);

  const output = {
    generatedAt: new Date().toISOString(),
    sourceFiles,
    topRentalStations,
    lowUsageStations,
  };

  fs.writeFileSync(outputFile, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  return output;
}

try {
  const output = buildStats();
  console.log(`완료: ${outputFile}`);
  console.log(`원본 파일: ${output.sourceFiles.length}개`);
  console.log(`최다 이용 1위: ${output.topRentalStations[0]?.stationName || "없음"}`);
  console.log(`저이용 1위: ${output.lowUsageStations[0]?.stationName || "없음"}`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
