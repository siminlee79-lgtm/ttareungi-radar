const fs = require("fs");
const path = require("path");

const datasetUrl = "https://data.seoul.go.kr/dataList/datasetView.do?currentPageNo=1&infId=OA-15246&serviceKind=1&srvType=A";
const downloadUrl = "https://datafile.seoul.go.kr/bigfile/iot/inf/nio_download.do?&useCache=false";
const projectRoot = path.resolve(__dirname, "..");
const outputDir = path.join(projectRoot, "raw-data", "daily-usage");

function sanitizeFileName(fileName) {
  return fileName.replace(/[\\/:*?"<>|]/g, "_");
}

async function fetchLatestMeta() {
  const response = await fetch(datasetUrl);

  if (!response.ok) {
    throw new Error(`서울 열린데이터광장 페이지를 불러오지 못했습니다. ${response.status}`);
  }

  const html = await response.text();
  const match = html.match(/title="([^"]+\.csv)"[^]*?downloadFile\('(\d+)'\)/);

  if (!match) {
    throw new Error("최신 CSV 다운로드 정보를 찾지 못했습니다.");
  }

  return {
    fileName: sanitizeFileName(match[1]),
    seq: match[2],
  };
}

async function downloadFile(meta) {
  fs.mkdirSync(outputDir, { recursive: true });

  const body = new URLSearchParams({
    infId: "OA-15246",
    seqNo: "",
    seq: meta.seq,
    infSeq: "1",
  });
  const response = await fetch(downloadUrl, {
    method: "POST",
    body,
  });

  if (!response.ok) {
    throw new Error(`CSV 다운로드 실패: ${response.status}`);
  }

  const outputFile = path.join(outputDir, meta.fileName);
  const bytes = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(outputFile, bytes);

  return outputFile;
}

async function main() {
  const meta = await fetchLatestMeta();
  const outputFile = await downloadFile(meta);

  console.log(`다운로드 완료: ${outputFile}`);
  console.log(`파일명: ${meta.fileName}`);
  console.log(`seq: ${meta.seq}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
