const LOCAL_SEOUL_OPEN_API_KEY = window.TTAREUNGI_CONFIG?.SEOUL_OPEN_API_KEY || "";
const SEOUL_BIKE_API = LOCAL_SEOUL_OPEN_API_KEY
  ? `http://openapi.seoul.go.kr:8088/${LOCAL_SEOUL_OPEN_API_KEY}/json/bikeList`
  : "";
const DEFAULT_CENTER = { lat: 37.5665, lng: 126.978 };
const DEFAULT_ALARMS = {
  morning: "07:00",
  evening: "18:30",
  enabled: false,
  targets: { saved1: true, saved2: true },
};

const fallbackStations = [
  { id: "demo-1", name: "홍대입구역 2번출구", bikes: 1, rackCount: 15, shared: 7, lat: 37.55762, lng: 126.92432 },
  { id: "demo-2", name: "동교동삼거리", bikes: 8, rackCount: 14, shared: 57, lat: 37.5569, lng: 126.9197 },
  { id: "demo-3", name: "연남파출소 앞", bikes: 3, rackCount: 12, shared: 25, lat: 37.5623, lng: 126.9237 },
  { id: "demo-4", name: "경의선숲길 입구", bikes: 5, rackCount: 10, shared: 50, lat: 37.5596, lng: 126.9296 },
];

const storageKey = "ttareungi-radar-places-v2";
const alarmStorageKey = "ttareungi-radar-alarms-v1";
const alarmSentStorageKey = "ttareungi-radar-alarm-sent-v1";
const stationList = document.querySelector("#stationList");
const refreshButton = document.querySelector("#refreshButton");
const pullRefreshHint = document.querySelector("#pullRefreshHint");
const notificationButton = document.querySelector("#notificationButton");
const notificationStatus = document.querySelector("#notificationStatus");
const currentDateTime = document.querySelector("#currentDateTime");
const timeMode = document.querySelector("#timeMode");
const placeForm = document.querySelector("#placeForm");
const placeType = document.querySelector("#placeType");
const placeName = document.querySelector("#placeName");
const placeAddress = document.querySelector("#placeAddress");
const placeList = document.querySelector("#placeList");
const morningAlarm = document.querySelector("#morningAlarm");
const eveningAlarm = document.querySelector("#eveningAlarm");
const alarmSaved1 = document.querySelector("#alarmSaved1");
const alarmSaved2 = document.querySelector("#alarmSaved2");
const saveAlarmButton = document.querySelector("#saveAlarmButton");
const openMyButton = document.querySelector("#openMyButton");
const installGuideButton = document.querySelector("#installGuideButton");
const installGuideDialog = document.querySelector("#installGuideDialog");
const installGuideClose = document.querySelector("#installGuideClose");
const locationStatus = document.querySelector("#locationStatus");
const mapTitle = document.querySelector("#mapTitle");
const kakaoMapElement = document.querySelector("#kakaoMap");
const mapSection = document.querySelector("#mapSection");
const tabButtons = document.querySelectorAll(".tab-button");
const radarPage = document.querySelector("#radarPage");
const myPage = document.querySelector("#myPage");
const watchCards = {
  current: document.querySelector('[data-watch-card="current"]'),
  saved1: document.querySelector('[data-watch-card="saved-1"]'),
  saved2: document.querySelector('[data-watch-card="saved-2"]'),
};

let places = loadPlaces();
let alarmSettings = loadAlarmSettings();
let currentPosition = null;
let allStations = [];
let stations = [];
let highlightedStationId = "";
let kakaoMap = null;
let kakaoOverlays = [];
let pullStartY = 0;
let isPullingToRefresh = false;
let isRefreshing = false;

function createId() {
  return window.crypto?.randomUUID ? window.crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadPlaces() {
  const saved = window.localStorage.getItem(storageKey);

  if (!saved) {
    return [];
  }

  try {
    return JSON.parse(saved);
  } catch {
    return [];
  }
}

function savePlaces() {
  window.localStorage.setItem(storageKey, JSON.stringify(places));
}

function loadAlarmSettings() {
  const saved = window.localStorage.getItem(alarmStorageKey);

  if (!saved) {
    return { ...DEFAULT_ALARMS };
  }

  try {
    const parsed = JSON.parse(saved);
    return {
      ...DEFAULT_ALARMS,
      ...parsed,
      targets: { ...DEFAULT_ALARMS.targets, ...parsed.targets },
    };
  } catch {
    return { ...DEFAULT_ALARMS };
  }
}

function saveAlarmSettings() {
  window.localStorage.setItem(alarmStorageKey, JSON.stringify(alarmSettings));
}

function normalizeStation(row) {
  return {
    id: row.stationId,
    name: row.stationName,
    bikes: Number(row.parkingBikeTotCnt) || 0,
    rackCount: Number(row.rackTotCnt) || 0,
    shared: Number(row.shared) || 0,
    lat: Number(row.stationLatitude),
    lng: Number(row.stationLongitude),
  };
}

async function fetchSeoulBikeStations() {
  locationStatus.textContent = "서울시 실시간 따릉이 정보를 불러오는 중입니다.";

  try {
    const rows = await fetchBikeRows();

    allStations = rows
      .map(normalizeStation)
      .filter((station) => Number.isFinite(station.lat) && Number.isFinite(station.lng));

    if (!allStations.length) {
      throw new Error("대여소 데이터가 비어 있습니다.");
    }

    if (currentPosition) {
      updateNearbyStations(currentPosition);
    } else {
      stations = getNearbyStations(DEFAULT_CENTER);
      renderDashboard();
      renderKakaoOverlays(stations);
    }

    locationStatus.textContent = currentPosition
      ? `현재 위치 기준으로 실시간 대여소 ${allStations.length.toLocaleString("ko-KR")}곳을 불러왔습니다.`
      : "현재 위치 권한을 허용하면 위치 기준으로 다시 계산합니다.";
  } catch (error) {
    console.error(error);
    allStations = [];
    stations = fallbackStations;
    locationStatus.textContent = "실시간 데이터를 불러오지 못해 임시 데이터로 표시합니다.";
    renderDashboard();
    renderKakaoOverlays(stations);
  }
}

async function fetchBikeRows() {
  const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

  if (!isLocal) {
    const response = await fetch("/api/bikes");

    if (!response.ok) {
      throw new Error(`Cloudflare API 오류: ${response.status}`);
    }

    const data = await response.json();
    return data.rows || [];
  }

  if (!SEOUL_BIKE_API) {
    throw new Error("로컬 서울시 API 키가 없습니다. config.local.js를 설정하거나 배포 환경에서 실행하세요.");
  }

  const ranges = [[1, 1000], [1001, 2000], [2001, 3000]];
  const responses = await Promise.all(
    ranges.map(async ([start, end]) => {
      const response = await fetch(`${SEOUL_BIKE_API}/${start}/${end}/`);

      if (!response.ok) {
        throw new Error(`서울시 API 오류: ${response.status}`);
      }

      return response.json();
    }),
  );

  return responses.flatMap((data) => data.rentBikeStatus?.row || []);
}

function getTimeProfile(now) {
  const minutes = now.getHours() * 60 + now.getMinutes();

  if (minutes >= 420 && minutes <= 540) {
    return { label: "출근 집중 시간대", pressure: 28, direction: "대여" };
  }

  if (minutes >= 1080 && minutes <= 1260) {
    return { label: "퇴근 집중 시간대", pressure: 24, direction: "반납" };
  }

  if (minutes >= 780 && minutes <= 900) {
    return { label: "점심 이동 시간대", pressure: 12, direction: "대여" };
  }

  if (minutes >= 1260 || minutes <= 60) {
    return { label: "야간 이용 시간대", pressure: 16, direction: "대여" };
  }

  return { label: "일반 시간대", pressure: 6, direction: "대여" };
}

function getStockRate(station) {
  if (Number.isFinite(station.shared) && station.shared >= 0) {
    return Math.min(100, Math.max(0, station.shared));
  }

  if (station.rackCount > 0) {
    return Math.min(100, Math.max(0, (station.bikes / station.rackCount) * 100));
  }

  return station.bikes > 0 ? 100 : 0;
}

function getRisk(station) {
  const stockRate = getStockRate(station);
  const score = Math.round(100 - stockRate);

  if (stockRate < 30) {
    return { label: "마감임박", level: "critical", className: "danger", score, stockRate };
  }

  if (stockRate < 60) {
    return { label: "재고소진중", level: "low", className: "warning", score, stockRate };
  }

  return { label: "여유", level: "enough", className: "safe", score, stockRate };
}

function formatNow(now) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);
}

function calculateDistance(a, b) {
  const earthRadius = 6371000;
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * earthRadius * Math.asin(Math.sqrt(h));
}

function formatDistance(meters) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)}km` : `${Math.round(meters)}m`;
}

function formatBikeAvailability(count) {
  return count > 0 ? `현재 따릉이 ${count}대` : "현재 대여 가능 따릉이가 없습니다";
}

function getNearbyStations(center, limit = 8) {
  const source = allStations.length ? allStations : fallbackStations;

  return source
    .map((station) => {
      const distanceMeters = calculateDistance(center, station);

      return {
        ...station,
        distanceMeters,
        distance: formatDistance(distanceMeters),
      };
    })
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, limit);
}

function updateNearbyStations(center) {
  stations = getNearbyStations(center);
  renderDashboard();
  renderKakaoOverlays(stations);
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getAreaAlert(areaName, center, now = new Date()) {
  const nearby = getNearbyStations(center, 5).map((station) => ({
    ...station,
    risk: getRisk(station, now),
  }));
  const primary = nearby[0];
  const alternative = nearby
    .filter((station) => station.id !== primary?.id && station.bikes > 2)
    .sort((a, b) => a.risk.score - b.risk.score || a.distanceMeters - b.distanceMeters)[0];

  if (!primary) {
    return {
      title: `${areaName} 확인 중`,
      detailHTML: "대여소 정보를 불러오는 중입니다.",
      label: "대기",
      score: "--",
      className: "waiting",
    };
  }

  if (primary.risk.level === "critical") {
    const mainLine = `${escapeHTML(primary.name)} ${formatBikeAvailability(primary.bikes)}.`;
    const alternativeLine = alternative
      ? `대체대여소는 <button class="inline-link" data-focus-station="${escapeHTML(alternative.id)}">${escapeHTML(alternative.name)}</button>입니다.<br />거리 ${alternative.distance}, ${formatBikeAvailability(alternative.bikes)}.`
      : "주변 대체대여소도 부족합니다.<br />조금 일찍 움직이는 것을 추천합니다.";

    return {
      title: `${areaName} 마감임박`,
      detailHTML: `${mainLine}<br />${alternativeLine}`,
      label: "마감임박",
      score: primary.risk.score,
      className: "danger",
    };
  }

  if (primary.risk.level === "low") {
    return {
      title: `${areaName} 재고소진중`,
      detailHTML: `${escapeHTML(primary.name)} ${formatBikeAvailability(primary.bikes)}.<br />아직 가능성은 있지만 출발 전 한 번 더 확인하세요.`,
      label: "재고소진중",
      score: primary.risk.score,
      className: "warning",
    };
  }

  return {
    title: `${areaName} 여유`,
    detailHTML: "좋아요. 주변 대여소 수급이 안정적입니다.<br />지금은 따릉이 타기 좋은 타이밍이에요.",
    label: "여유",
    score: primary.risk.score,
    className: "safe",
  };
}

function setWatchCard(card, alert) {
  if (!card) {
    return;
  }

  card.querySelector("[data-watch-title]").textContent = alert.title;
  card.querySelector("[data-watch-detail]").innerHTML = alert.detailHTML;
  card.querySelector("[data-watch-label]").textContent = alert.label;
  card.querySelector("[data-watch-value]").textContent = alert.score;
  card.querySelector("[data-watch-score]").className = `score-badge ${alert.className}`;
  card.classList.toggle("is-waiting", alert.className === "waiting");
}

function getWatchedPlaces() {
  return [places[0], places[1]];
}

function renderWatchCards(now = new Date()) {
  if (currentPosition) {
    setWatchCard(watchCards.current, getAreaAlert("현재위치", currentPosition, now));
  } else {
    setWatchCard(watchCards.current, {
      title: "현재위치 확인 필요",
      detailHTML: "현재 위치 권한을 허용하면 주변 대여소를 자동으로 계산합니다.<br />권한을 거부하면 정확한 주변 대여소를 볼 수 없습니다.",
      label: "대기",
      score: "--",
      className: "waiting",
    });
  }

  const [firstPlace, secondPlace] = getWatchedPlaces();
  renderSavedWatchCard(watchCards.saved1, firstPlace, "첫 번째 장소", now);
  renderSavedWatchCard(watchCards.saved2, secondPlace, "두 번째 장소", now);
}

function renderSavedWatchCard(card, place, fallbackName, now) {
  if (!place) {
    setWatchCard(card, {
      title: `${fallbackName}를 저장하세요`,
      detailHTML: "마이메뉴에서 자주 가는 장소를 저장하고 레이더에 등록하세요.",
      label: "대기",
      score: "--",
      className: "waiting",
    });
    return;
  }

  if (!place.lat || !place.lng) {
    setWatchCard(card, {
      title: `${place.name} 위치 확인 필요`,
      detailHTML: "주소를 다시 저장하면 카카오 주소 검색으로 위치를 확인합니다.",
      label: "대기",
      score: "--",
      className: "waiting",
    });
    return;
  }

  setWatchCard(card, getAreaAlert(place.name, { lat: place.lat, lng: place.lng }, now));
}

function renderDashboard() {
  const now = new Date();
  currentDateTime.textContent = formatNow(now);
  timeMode.textContent = getTimeProfile(now).label;
  renderWatchCards(now);
  renderStations(stations);
  renderAlarmSettings();
}

function renderAlarmSettings() {
  if (morningAlarm) {
    morningAlarm.value = alarmSettings.morning;
  }

  if (eveningAlarm) {
    eveningAlarm.value = alarmSettings.evening;
  }

  if (alarmSaved1) {
    alarmSaved1.checked = alarmSettings.targets?.saved1 !== false;
  }

  if (alarmSaved2) {
    alarmSaved2.checked = alarmSettings.targets?.saved2 !== false;
  }

  if (notificationStatus) {
    const enabledText = alarmSettings.enabled ? "켜짐" : "꺼짐";
    const targetText = getAlarmTargetPlaces().map((place) => place.name).join(", ") || "저장 장소 1, 2";
    notificationStatus.innerHTML = `${targetText} 기준 레이다 알림 ${enabledText}.<br />알림시간은 오전 ${alarmSettings.morning},<br />저녁 ${alarmSettings.evening} 입니다.`;
  }

  if (notificationButton && alarmSettings.enabled) {
    notificationButton.textContent = "켜짐";
  }
}

function renderStations(list = stations) {
  stationList.innerHTML = list
    .map((station) => {
      const risk = getRisk(station);
      const highlightClass = station.id === highlightedStationId ? " highlighted" : "";

      return `
        <article class="station-card${highlightClass}" data-station-id="${escapeHTML(station.id)}">
          <div>
            <h3>${escapeHTML(station.name)}</h3>
            <p>${station.distance || ""} · ${formatBikeAvailability(station.bikes)}</p>
          </div>
          <span class="station-pill ${risk.className}">${risk.label}</span>
        </article>
      `;
    })
    .join("");
}

function renderPlaces() {
  placeList.innerHTML = places
    .map(
      (place) => `
        <article class="place-card">
          <div>
            <span>${escapeHTML(place.type)}</span>
            <h3>${escapeHTML(place.name)}</h3>
            <p>${escapeHTML(place.address)}${place.lat ? " · 위치 저장됨" : ""}</p>
          </div>
        </article>
      `,
    )
    .join("");

  renderDashboard();
}

function geocodePlace(address) {
  return new Promise((resolve) => {
    if (!window.kakao?.maps?.services) {
      resolve(null);
      return;
    }

    const geocoder = new kakao.maps.services.Geocoder();
    geocoder.addressSearch(address, (result, status) => {
      if (status !== kakao.maps.services.Status.OK || !result[0]) {
        resolve(null);
        return;
      }

      resolve({
        lat: Number(result[0].y),
        lng: Number(result[0].x),
      });
    });
  });
}

function requestCurrentLocation() {
  if (!("geolocation" in navigator)) {
    locationStatus.textContent = "이 브라우저는 현재 위치를 지원하지 않습니다.";
    return;
  }

  locationStatus.textContent = "현재 위치 권한을 요청하는 중입니다.";

  navigator.geolocation.getCurrentPosition(
    (position) => {
      currentPosition = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };

      mapTitle.textContent = "현재위치 주변 대여소";
      locationStatus.textContent = `현재위치 확인 완료: ${currentPosition.lat.toFixed(4)}, ${currentPosition.lng.toFixed(4)}`;
      moveKakaoMap(currentPosition.lat, currentPosition.lng);
      updateNearbyStations(currentPosition);
    },
    () => {
      currentPosition = null;
      locationStatus.textContent = "현재위치 권한이 허용되지 않았습니다. Safari 주소창 설정에서 위치 권한을 허용하면 다시 계산됩니다.";
      renderDashboard();
    },
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
  );
}

function initKakaoMap() {
  if (!window.kakao?.maps || !kakaoMapElement) {
    locationStatus.textContent = "카카오맵 도메인 등록이 필요합니다. JavaScript SDK 도메인을 확인하세요.";
    return;
  }

  const center = new kakao.maps.LatLng(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng);
  kakaoMap = new kakao.maps.Map(kakaoMapElement, {
    center,
    level: 5,
  });

  kakaoMapElement.classList.add("loaded");
  renderKakaoOverlays(stations.length ? stations : getNearbyStations(DEFAULT_CENTER));
}

function renderKakaoOverlays(list) {
  if (!kakaoMap || !window.kakao?.maps) {
    return;
  }

  kakaoOverlays.forEach((overlay) => overlay.setMap(null));
  kakaoOverlays = list.map((station) => {
    const risk = getRisk(station);
    const content = document.createElement("div");
    content.className = `map-count-marker ${risk.className}${station.id === highlightedStationId ? " selected" : ""}`;
    content.textContent = station.bikes;
    content.title = `${station.name} · ${station.bikes}대`;

    return new kakao.maps.CustomOverlay({
      content,
      map: kakaoMap,
      position: new kakao.maps.LatLng(station.lat, station.lng),
      yAnchor: 1,
    });
  });
}

function moveKakaoMap(lat, lng) {
  if (!kakaoMap || !window.kakao?.maps) {
    return;
  }

  kakaoMap.setCenter(new kakao.maps.LatLng(lat, lng));
  kakaoMap.setLevel(4);
}

function focusStation(stationId) {
  const station = [...stations, ...allStations].find((item) => item.id === stationId);

  if (!station) {
    return;
  }

  highlightedStationId = stationId;

  if (!stations.some((item) => item.id === stationId)) {
    stations = getNearbyStations({ lat: station.lat, lng: station.lng });
  }

  renderStations(stations);
  renderKakaoOverlays(stations);
  moveKakaoMap(station.lat, station.lng);
  mapSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function focusArea(areaName, center) {
  highlightedStationId = "";
  stations = getNearbyStations(center);
  mapTitle.textContent = `${areaName} 주변 대여소`;
  locationStatus.textContent = `${areaName} 기준으로 지도와 대체 대여소를 바꿨습니다.`;
  renderStations(stations);
  renderKakaoOverlays(stations);
  moveKakaoMap(center.lat, center.lng);
  mapSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function ensurePlaceCoords(place) {
  if (!place || (place.lat && place.lng)) {
    return place;
  }

  const coords = await geocodePlace(place.address);

  if (!coords) {
    return place;
  }

  place.lat = coords.lat;
  place.lng = coords.lng;
  savePlaces();
  renderPlaces();
  return place;
}

async function focusWatchCard(cardKey) {
  if (cardKey === "current") {
    if (!currentPosition) {
      requestCurrentLocation();
      return;
    }

    focusArea("현재위치", currentPosition);
    return;
  }

  const [firstPlace, secondPlace] = getWatchedPlaces();
  const place = await ensurePlaceCoords(cardKey === "saved-1" ? firstPlace : secondPlace);

  if (!place || !place.lat || !place.lng) {
    switchTab("my");
    placeName.focus();
    return;
  }

  focusArea(place.name, { lat: place.lat, lng: place.lng });
}

function switchTab(tabName) {
  tabButtons.forEach((button) => button.classList.toggle("active", button.dataset.tab === tabName));
  radarPage.classList.toggle("active", tabName === "radar");
  myPage.classList.toggle("active", tabName === "my");
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js");
  }
}

async function refreshRadar() {
  if (isRefreshing) {
    return;
  }

  isRefreshing = true;
  pullRefreshHint?.classList.remove("ready");
  pullRefreshHint?.classList.add("visible");
  if (pullRefreshHint) {
    pullRefreshHint.textContent = "새로고침 중";
  }

  await fetchSeoulBikeStations();
  refreshButton.animate([{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }], {
    duration: 450,
    easing: "ease-out",
  });

  if (pullRefreshHint) {
    pullRefreshHint.textContent = "새로고침 완료";
    setTimeout(() => {
      pullRefreshHint.classList.remove("visible", "ready");
      pullRefreshHint.textContent = "놓으면 새로고침";
    }, 500);
  }

  isRefreshing = false;
}

function openInstallGuide() {
  if (installGuideDialog) {
    installGuideDialog.hidden = false;
  }
}

function closeInstallGuide() {
  if (installGuideDialog) {
    installGuideDialog.hidden = true;
  }
}

function setupPullToRefresh() {
  window.addEventListener(
    "touchstart",
    (event) => {
      if (window.scrollY > 0 || !event.touches[0] || isRefreshing) {
        return;
      }

      pullStartY = event.touches[0].clientY;
      isPullingToRefresh = true;
    },
    { passive: true },
  );

  window.addEventListener(
    "touchmove",
    (event) => {
      if (!isPullingToRefresh || !event.touches[0]) {
        return;
      }

      const pullDistance = event.touches[0].clientY - pullStartY;

      if (pullDistance <= 0) {
        return;
      }

      if (window.scrollY === 0) {
        event.preventDefault();
      }

      pullRefreshHint?.classList.add("visible");
      pullRefreshHint?.classList.toggle("ready", pullDistance > 82);

      if (pullRefreshHint) {
        pullRefreshHint.textContent = pullDistance > 82 ? "놓으면 새로고침" : "조금 더 당기세요";
      }
    },
    { passive: false },
  );

  window.addEventListener(
    "touchend",
    async (event) => {
      if (!isPullingToRefresh || !event.changedTouches[0]) {
        return;
      }

      const pullDistance = event.changedTouches[0].clientY - pullStartY;
      isPullingToRefresh = false;

      if (window.scrollY === 0 && pullDistance > 82) {
        await refreshRadar();
      } else {
        pullRefreshHint?.classList.remove("visible", "ready");
      }
    },
    { passive: true },
  );
}

refreshButton.addEventListener("click", refreshRadar);

installGuideButton.addEventListener("click", openInstallGuide);
installGuideClose.addEventListener("click", closeInstallGuide);
installGuideDialog.addEventListener("click", (event) => {
  if (event.target === installGuideDialog) {
    closeInstallGuide();
  }
});

Object.entries(watchCards).forEach(([cardKey, card]) => {
  if (!card) {
    return;
  }

  card.tabIndex = 0;
  card.addEventListener("click", (event) => {
    if (event.target.closest("[data-focus-station]")) {
      return;
    }

    focusWatchCard(cardKey);
  });
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      focusWatchCard(cardKey);
    }
  });
});

saveAlarmButton.addEventListener("click", async () => {
  let enabled = alarmSettings.enabled;

  if ("Notification" in window) {
    const permission = await Notification.requestPermission();
    enabled = permission === "granted";
  }

  alarmSettings = {
    ...alarmSettings,
    enabled,
    morning: morningAlarm.value || DEFAULT_ALARMS.morning,
    evening: eveningAlarm.value || DEFAULT_ALARMS.evening,
    targets: {
      saved1: alarmSaved1?.checked ?? true,
      saved2: alarmSaved2?.checked ?? true,
    },
  };
  saveAlarmSettings();
  renderAlarmSettings();
});

notificationButton.addEventListener("click", async () => {
  if (!("Notification" in window)) {
    notificationStatus.textContent = "이 브라우저는 알림을 지원하지 않습니다.";
    return;
  }

  const permission = await Notification.requestPermission();

  if (permission !== "granted") {
    notificationStatus.textContent = "브라우저 설정에서 알림을 허용해야 합니다.";
    return;
  }

  alarmSettings = {
    ...alarmSettings,
    enabled: true,
    morning: morningAlarm?.value || alarmSettings.morning,
    evening: eveningAlarm?.value || alarmSettings.evening,
    targets: {
      saved1: alarmSaved1?.checked ?? true,
      saved2: alarmSaved2?.checked ?? true,
    },
  };
  saveAlarmSettings();
  renderAlarmSettings();
  const alert = getAlarmNotificationAlert();

  new Notification("따릉이 레이더", {
    body: `${formatNow(new Date())} 기준 ${alert.title}. ${alert.text}`,
    icon: "./icons/icon-192.svg",
  });
});

function getAlarmTargetPlaces() {
  const [firstPlace, secondPlace] = getWatchedPlaces();
  const targets = alarmSettings.targets || DEFAULT_ALARMS.targets;
  const selected = [];

  if (targets.saved1 && firstPlace) {
    selected.push(firstPlace);
  }

  if (targets.saved2 && secondPlace) {
    selected.push(secondPlace);
  }

  return selected;
}

function getPlaceNotificationAlert(place) {
  if (!place || !place.lat || !place.lng) {
    return {
      title: "저장 장소 설정 필요",
      text: "마이메뉴에서 알림 기준 장소를 등록해주세요.",
    };
  }

  const alert = getAreaAlert(place.name, { lat: place.lat, lng: place.lng });
  return {
    title: alert.title,
    text: alert.detailHTML.replace(/<br\s*\/?>/g, " ").replace(/<[^>]*>/g, ""),
  };
}

function getAlarmNotificationAlert() {
  const alerts = getAlarmTargetPlaces().map(getPlaceNotificationAlert);

  if (!alerts.length) {
    return {
      title: "저장 장소 설정 필요",
      text: "마이메뉴에서 저장 장소 1, 2를 등록해주세요.",
    };
  }

  return {
    title: "저장 장소 레이더 알림",
    text: alerts.map((alert) => `${alert.title}. ${alert.text}`).join(" / "),
  };
}

function checkScheduledNotification() {
  if (!("Notification" in window) || !alarmSettings.enabled || Notification.permission !== "granted") {
    return;
  }

  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const alarmTimes = [alarmSettings.morning, alarmSettings.evening];

  if (!alarmTimes.includes(currentTime)) {
    return;
  }

  const sentKey = `${now.toISOString().slice(0, 10)}-${currentTime}`;

  if (window.localStorage.getItem(alarmSentStorageKey) === sentKey) {
    return;
  }

  const alert = getAlarmNotificationAlert();
  window.localStorage.setItem(alarmSentStorageKey, sentKey);

  new Notification("따릉이 레이더", {
    body: `${alert.title}. ${alert.text}`,
    icon: "./icons/icon-192.svg",
  });
}

placeForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const address = placeAddress.value.trim();
  const coords = await geocodePlace(address);
  const nextPlaces = [
    ...places,
    {
      id: createId(),
      type: placeType.value,
      name: placeName.value.trim(),
      address,
      lat: coords?.lat,
      lng: coords?.lng,
      role: "",
    },
  ];

  places = nextPlaces.slice(-2);

  savePlaces();
  renderPlaces();
  placeForm.reset();
  placeType.value = "집";
});

placeList.addEventListener("click", (event) => {
  const button = event.target.closest("button");

  if (!button) {
    return;
  }

  const role = button.dataset.role;
  const id = button.dataset.id;

  places = places.map((place) => ({
    ...place,
    role: place.id === id ? role : place.role === role ? "" : place.role,
  }));

  savePlaces();
  renderPlaces();
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-focus-station]");

  if (!button) {
    return;
  }

  focusStation(button.dataset.focusStation);
});

tabButtons.forEach((button) => {
  button.addEventListener("click", () => switchTab(button.dataset.tab));
});

openMyButton.addEventListener("click", () => switchTab("my"));

renderPlaces();
renderDashboard();
initKakaoMap();
fetchSeoulBikeStations();
setTimeout(requestCurrentLocation, 600);
registerServiceWorker();
setupPullToRefresh();
setInterval(renderDashboard, 60 * 1000);
setInterval(checkScheduledNotification, 30 * 1000);
