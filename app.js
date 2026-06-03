const APP_CONFIG = window.TTAREUNGI_CONFIG || {};
const LOCAL_SEOUL_OPEN_API_KEY = APP_CONFIG.SEOUL_OPEN_API_KEY || "";
const SEOUL_BIKE_API = LOCAL_SEOUL_OPEN_API_KEY
  ? `http://openapi.seoul.go.kr:8088/${LOCAL_SEOUL_OPEN_API_KEY}/json/bikeList`
  : "";
const REMOTE_API_BASE_URL = APP_CONFIG.API_BASE_URL || "https://ttareungi-radar.pages.dev";
const APP_VERSION = APP_CONFIG.APP_VERSION || "v45";
const IS_NATIVE_APP =
  Boolean(APP_CONFIG.IS_NATIVE_APP) ||
  Boolean(window.Capacitor?.isNativePlatform?.()) ||
  window.location.protocol === "capacitor:" ||
  window.location.protocol === "ionic:";
const DEFAULT_CENTER = { lat: 37.5665, lng: 126.978 };
const LOCATION_FALLBACK_MESSAGE =
  "지하철이나 실내에서는 현재위치 확인이 어려울 수 있어요.<br />저장한 장소 기준으로 따릉이 상황을 확인해보세요.";
const DEFAULT_ALARMS = {
  morning: "07:00",
  evening: "18:30",
  enabled: false,
  targets: { saved1: true, saved2: true },
  placeTimes: {
    saved1: { time: "07:00" },
    saved2: { time: "18:30" },
  },
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
const pushDeviceIdKey = "ttareungi-radar-push-device-id-v1";
const pushTokenKey = "ttareungi-radar-fcm-token-v1";
const stationList = document.querySelector("#stationList");
const refreshButton = document.querySelector("#refreshButton");
const pullRefreshHint = document.querySelector("#pullRefreshHint");
const notificationButton = document.querySelector("#notificationButton");
const notificationStatus = document.querySelector("#notificationStatus");
const currentDateTime = document.querySelector("#currentDateTime");
const timeMode = document.querySelector("#timeMode");
const brandHomeButton = document.querySelector("#brandHomeButton");
const placeForms = document.querySelectorAll("[data-place-form]");
const placeList = document.querySelector("#placeList");
const morningAlarm = document.querySelector("#morningAlarm");
const eveningAlarm = document.querySelector("#eveningAlarm");
const saved1MorningAlarm = document.querySelector("#saved1MorningAlarm");
const saved1EveningAlarm = document.querySelector("#saved1EveningAlarm");
const saved2MorningAlarm = document.querySelector("#saved2MorningAlarm");
const saved2EveningAlarm = document.querySelector("#saved2EveningAlarm");
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
const mapState = document.querySelector("#mapState");
const mapSection = document.querySelector("#mapSection");
const mapPreview = document.querySelector(".map-preview");
const tabButtons = document.querySelectorAll(".tab-button");
const tipCategoryButtons = document.querySelectorAll("[data-tip-category]");
const tipPanels = document.querySelectorAll("[data-tip-panel]");
const liveStatsSummary = document.querySelector("#liveStatsSummary");
const statNearbyStations = document.querySelector("#statNearbyStations");
const statAvailableBikes = document.querySelector("#statAvailableBikes");
const statEmptyStations = document.querySelector("#statEmptyStations");
const statCriticalStations = document.querySelector("#statCriticalStations");
const statBestStation = document.querySelector("#statBestStation");
const statBestStationDetail = document.querySelector("#statBestStationDetail");
const placeStatsSummary = document.querySelector("#placeStatsSummary");
const placeStatsGrid = document.querySelector("#placeStatsGrid");
const alternativeRankingList = document.querySelector("#alternativeRankingList");
const historicalStatsStatus = document.querySelector("#historicalStatsStatus");
const topRentalStations = document.querySelector("#topRentalStations");
const lowUsageStations = document.querySelector("#lowUsageStations");
const radarPage = document.querySelector("#radarPage");
const placesPage = document.querySelector("#placesPage");
const tipsPage = document.querySelector("#tipsPage");
const watchCards = {
  current: document.querySelector('[data-watch-card="current"]'),
  saved1: document.querySelector('[data-watch-card="saved-1"]'),
  saved2: document.querySelector('[data-watch-card="saved-2"]'),
};

let places = loadPlaces();
let alarmSettings = loadAlarmSettings();
let currentPosition = null;
let locationFailed = false;
let allStations = [];
let stations = [];
let highlightedStationId = "";
let kakaoMap = null;
let kakaoOverlays = [];
let kakaoMapLoaded = false;
let mapResizeObserver = null;
let pullStartY = 0;
let isPullingToRefresh = false;
let isRefreshing = false;
let pushListenersReady = false;
let pushToken = window.localStorage.getItem(pushTokenKey) || "";

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
      placeTimes: {
        saved1: normalizePlaceTime(parsed.placeTimes?.saved1, DEFAULT_ALARMS.placeTimes.saved1.time),
        saved2: normalizePlaceTime(parsed.placeTimes?.saved2, DEFAULT_ALARMS.placeTimes.saved2.time),
      },
    };
  } catch {
    return { ...DEFAULT_ALARMS };
  }
}

function normalizePlaceTime(savedTime, fallback) {
  return {
    ...savedTime,
    time: savedTime?.time || savedTime?.morning || fallback,
  };
}

function saveAlarmSettings() {
  window.localStorage.setItem(alarmStorageKey, JSON.stringify(alarmSettings));
}

function getPushNotificationsPlugin() {
  return window.Capacitor?.Plugins?.PushNotifications || null;
}

function getDeviceId() {
  const saved = window.localStorage.getItem(pushDeviceIdKey);

  if (saved) {
    return saved;
  }

  const nextId = createId();
  window.localStorage.setItem(pushDeviceIdKey, nextId);
  return nextId;
}

function getPushPayload(token) {
  return {
    deviceId: getDeviceId(),
    token,
    platform: IS_NATIVE_APP ? "android" : "web",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Seoul",
    appVersion: APP_VERSION,
    places,
    alarmSettings,
  };
}

async function syncPushRegistration(token = pushToken) {
  if (!token || !alarmSettings.enabled) {
    return false;
  }

  const response = await fetch(`${REMOTE_API_BASE_URL}/api/push/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(getPushPayload(token)),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || error.error || `푸시 설정 저장 실패: ${response.status}`);
  }

  return response.json();
}

async function unregisterPushRegistration() {
  const token = pushToken || window.localStorage.getItem(pushTokenKey) || "";
  const response = await fetch(`${REMOTE_API_BASE_URL}/api/push/unregister`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      deviceId: getDeviceId(),
      token,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || error.error || `푸시 해제 실패: ${response.status}`);
  }

  return response.json();
}

async function setupNativePushNotifications() {
  const PushNotifications = getPushNotificationsPlugin();

  if (!PushNotifications || pushListenersReady) {
    return;
  }

  pushListenersReady = true;
  await PushNotifications.addListener("registration", async (token) => {
    pushToken = token.value;
    window.localStorage.setItem(pushTokenKey, pushToken);

    try {
      await syncPushRegistration(pushToken);
      if (notificationStatus && alarmSettings.enabled) {
        notificationStatus.innerHTML = "서버 푸시 알림이 준비됐습니다.<br />정해진 시간에 저장장소 기준으로 알려드립니다.";
      }
    } catch (error) {
      console.warn("푸시 등록 저장 실패", error);
      if (notificationStatus) {
        notificationStatus.textContent = "푸시 토큰은 받았지만 서버 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.";
      }
    }
  });
  await PushNotifications.addListener("registrationError", (error) => {
    console.warn("FCM 토큰 발급 실패", error);
    if (notificationStatus) {
      notificationStatus.textContent = "푸시 토큰 발급에 실패했습니다. Firebase 설정을 확인해 주세요.";
    }
  });
  await PushNotifications.addListener("pushNotificationReceived", (notification) => {
    console.info("푸시 수신", notification);
  });
  await PushNotifications.addListener("pushNotificationActionPerformed", () => {
    window.focus();
    switchTab("radar");
  });
}

async function enableNativePushNotifications() {
  const PushNotifications = getPushNotificationsPlugin();

  if (!PushNotifications) {
    notificationStatus.textContent = "Android 푸시 플러그인을 찾지 못했습니다.";
    return false;
  }

  await setupNativePushNotifications();
  const permission = await PushNotifications.requestPermissions();

  if (permission.receive !== "granted") {
    notificationStatus.textContent = "Android 설정에서 알림 권한을 허용해야 합니다.";
    return false;
  }

  notificationStatus.innerHTML = "푸시 토큰을 발급받는 중입니다.<br />잠시만 기다려 주세요.";
  await PushNotifications.register();
  return true;
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
      : locationFailed
        ? getPlainLocationFallbackMessage()
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

  if (IS_NATIVE_APP) {
    const response = await fetch(`${REMOTE_API_BASE_URL}/api/bikes`);

    if (!response.ok) {
      throw new Error(`Native API error: ${response.status}`);
    }

    const data = await response.json();
    return data.rows || [];
  }

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
      title: areaName,
      detailHTML: `${mainLine}<br />${alternativeLine}`,
      label: "마감임박",
      score: primary.risk.score,
      className: "danger",
    };
  }

  if (primary.risk.level === "low") {
    return {
      title: areaName,
      detailHTML: `${escapeHTML(primary.name)} ${formatBikeAvailability(primary.bikes)}.<br />아직 가능성은 있지만 출발 전 한 번 더 확인하세요.`,
      label: "재고소진중",
      score: primary.risk.score,
      className: "warning",
    };
  }

  return {
    title: areaName,
    detailHTML: `${escapeHTML(primary.name)} ${formatBikeAvailability(primary.bikes)}.<br />주변 대여소 수급이 안정적입니다.`,
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

function getPlaceIcon(type = "") {
  const icons = {
    집: "🏠",
    사무실: "🏢",
    학교: "🏫",
    학원: "📚",
    병원: "🏥",
    기타: "📍",
  };

  return icons[type] || "📍";
}

function getPlaceDisplayName(place) {
  return `${getPlaceIcon(place.type)} ${place.name}`;
}

function renderWatchCards(now = new Date()) {
  if (currentPosition) {
    setWatchCard(watchCards.current, getAreaAlert("🏁 현재위치", currentPosition, now));
  } else if (locationFailed) {
    setWatchCard(watchCards.current, {
      title: "🏁 현재위치 확인 어려움",
      detailHTML: LOCATION_FALLBACK_MESSAGE,
      label: "대기",
      score: "--",
      className: "waiting",
    });
  } else {
    setWatchCard(watchCards.current, {
      title: "🏁 현재위치 확인 필요",
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
      title: `📍 ${fallbackName}를 저장하세요`,
      detailHTML: "내장소저장에서 자주 가는 장소와 알림시간을 저장하세요.",
      label: "대기",
      score: "--",
      className: "waiting",
    });
    return;
  }

  if (!place.lat || !place.lng) {
    setWatchCard(card, {
      title: `${getPlaceDisplayName(place)} 위치 확인 필요`,
      detailHTML: "주소를 다시 저장하면 카카오 주소 검색으로 위치를 확인합니다.",
      label: "대기",
      score: "--",
      className: "waiting",
    });
    return;
  }

  setWatchCard(card, getAreaAlert(getPlaceDisplayName(place), { lat: place.lat, lng: place.lng }, now));
}

function getPlainLocationFallbackMessage() {
  return LOCATION_FALLBACK_MESSAGE.replace("<br />", " ");
}

function renderDashboard() {
  const now = new Date();
  currentDateTime.textContent = formatNow(now);
  timeMode.textContent = getTimeProfile(now).label;
  renderWatchCards(now);
  renderStations(stations);
  renderLiveStats(stations);
  renderPersonalStats();
  renderAlarmSettings();
}

function renderAlarmSettings() {
  if (notificationStatus) {
    const enabledText = alarmSettings.enabled ? "켜짐" : "꺼짐";
    const pushText = IS_NATIVE_APP && alarmSettings.enabled ? " 서버 푸시 준비 중." : "";
    const targetText = getAlarmTargetPlaces().map((place) => place.name).join(", ") || "저장 장소 1, 2";
    notificationStatus.innerHTML = `${targetText} 기준 레이다 알림 ${enabledText}.${pushText}<br />알림시간은 내장소저장에서 장소별로 설정합니다.`;
  }

  if (notificationButton && alarmSettings.enabled) {
    notificationButton.textContent = "알림 끄기";
  } else if (notificationButton) {
    notificationButton.textContent = "알림 켜기";
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

function renderLiveStats(list = stations) {
  if (!liveStatsSummary) {
    return;
  }

  const nearby = Array.isArray(list) ? list : [];
  const totalStations = nearby.length;
  const totalBikes = nearby.reduce((sum, station) => sum + Math.max(0, Number(station.bikes) || 0), 0);
  const emptyStations = nearby.filter((station) => (Number(station.bikes) || 0) <= 0).length;
  const criticalStations = nearby.filter((station) => getRisk(station).level === "critical").length;
  const bestStation = [...nearby].sort((a, b) => {
    const bikeGap = (Number(b.bikes) || 0) - (Number(a.bikes) || 0);
    return bikeGap || (Number(a.distanceMeters) || 0) - (Number(b.distanceMeters) || 0);
  })[0];

  statNearbyStations.textContent = totalStations ? `${totalStations}곳` : "--";
  statAvailableBikes.textContent = totalStations ? `${totalBikes}대` : "--";
  statEmptyStations.textContent = totalStations ? `${emptyStations}곳` : "--";
  statCriticalStations.textContent = totalStations ? `${criticalStations}곳` : "--";

  if (bestStation) {
    statBestStation.textContent = bestStation.name;
    statBestStationDetail.textContent = `${bestStation.distance || "거리 계산 중"} · ${formatBikeAvailability(bestStation.bikes)}`;
    liveStatsSummary.textContent = `현재 지도 기준 주변 ${totalStations}개 대여소를 계산했습니다.`;
  } else {
    statBestStation.textContent = "--";
    statBestStationDetail.textContent = "주변 대여소 계산 중";
    liveStatsSummary.textContent = "위치와 대여소 정보를 불러오면 실시간 통계를 보여드립니다.";
  }
}

function getStationBikeCount(station) {
  return Math.max(0, Number(station?.bikes) || 0);
}

function getPlaceAvailability(nearby) {
  const stationsCount = nearby.length;
  const totalBikes = nearby.reduce((sum, station) => sum + getStationBikeCount(station), 0);
  const emptyStations = nearby.filter((station) => getStationBikeCount(station) <= 0).length;
  const criticalStations = nearby.filter((station) => getRisk(station).level === "critical").length;
  const bestStation = [...nearby].sort((a, b) => {
    const bikeGap = getStationBikeCount(b) - getStationBikeCount(a);
    return bikeGap || (Number(a.distanceMeters) || 0) - (Number(b.distanceMeters) || 0);
  })[0];
  const averageBikes = stationsCount ? totalBikes / stationsCount : 0;
  const score = Math.max(0, Math.min(100, Math.round(averageBikes * 9 + (stationsCount - criticalStations) * 5 - emptyStations * 8)));

  if (!stationsCount) {
    return {
      label: "대기",
      className: "waiting",
      summary: "주변 대여소를 계산하는 중입니다.",
      totalBikes,
      emptyStations,
      criticalStations,
      bestStation,
      score: "--",
    };
  }

  if (totalBikes <= 3 || criticalStations >= Math.ceil(stationsCount / 2)) {
    return {
      label: "주의",
      className: "danger",
      summary: "가까운 대여소 재고가 빠르게 줄어든 상태입니다.",
      totalBikes,
      emptyStations,
      criticalStations,
      bestStation,
      score,
    };
  }

  if (totalBikes <= 10 || emptyStations >= 2) {
    return {
      label: "보통",
      className: "warning",
      summary: "대여는 가능하지만 출발 전 한 번 더 확인하는 편이 좋습니다.",
      totalBikes,
      emptyStations,
      criticalStations,
      bestStation,
      score,
    };
  }

  return {
    label: "안정",
    className: "safe",
    summary: "주변 대체 선택지가 충분한 편입니다.",
    totalBikes,
    emptyStations,
    criticalStations,
    bestStation,
    score,
  };
}

function getPlaceStatCard(place, index) {
  const displayName = getPlaceDisplayName(place);

  if (!place?.lat || !place?.lng) {
    return `
      <article class="place-stat-card is-empty">
        <span>저장장소 ${index + 1}</span>
        <strong>${escapeHTML(displayName)} 위치 확인 필요</strong>
        <p>주소를 다시 저장하면 주변 대여소 통계를 계산합니다.</p>
      </article>
    `;
  }

  const nearby = getNearbyStations({ lat: place.lat, lng: place.lng }, 8);
  const stats = getPlaceAvailability(nearby);
  const bestText = stats.bestStation
    ? `${escapeHTML(stats.bestStation.name)} · ${stats.bestStation.distance} · ${getStationBikeCount(stats.bestStation)}대`
    : "대체 대여소 계산 중";

  return `
    <article class="place-stat-card">
      <div class="place-stat-card-head">
        <div>
          <span>${escapeHTML(place.type || `저장장소 ${index + 1}`)}</span>
          <strong>${escapeHTML(displayName)}</strong>
        </div>
        <mark class="${stats.className}">${stats.label}</mark>
      </div>
      <dl class="place-stat-metrics">
        <div>
          <dt>주변 재고</dt>
          <dd>${stats.totalBikes}대</dd>
        </div>
        <div>
          <dt>0대</dt>
          <dd>${stats.emptyStations}곳</dd>
        </div>
        <div>
          <dt>지수</dt>
          <dd>${stats.score}</dd>
        </div>
      </dl>
      <p>${stats.summary}</p>
      <small>추천 대체: ${bestText}</small>
    </article>
  `;
}

function renderAlternativeRanking(savedPlaces) {
  if (!alternativeRankingList) {
    return;
  }

  const candidates = savedPlaces
    .flatMap((place) => {
      if (!place?.lat || !place?.lng) {
        return [];
      }

      return getNearbyStations({ lat: place.lat, lng: place.lng }, 6)
        .filter((station) => getStationBikeCount(station) > 0)
        .map((station) => ({
          ...station,
          placeName: getPlaceDisplayName(place),
          rankScore: getStationBikeCount(station) * 8 - (Number(station.distanceMeters) || 0) / 80,
        }));
    })
    .sort((a, b) => b.rankScore - a.rankScore)
    .slice(0, 5);

  if (!candidates.length) {
    alternativeRankingList.innerHTML = "<li>대체 대여소 계산 중</li>";
    return;
  }

  alternativeRankingList.innerHTML = candidates
    .map(
      (station) => `
        <li>
          <strong>${escapeHTML(station.name)}</strong>
          <span>${escapeHTML(station.placeName)} · ${station.distance} · ${getStationBikeCount(station)}대</span>
        </li>
      `,
    )
    .join("");
}

function renderPersonalStats() {
  if (!placeStatsSummary || !placeStatsGrid) {
    return;
  }

  const savedPlaces = places.filter(Boolean);

  if (!savedPlaces.length) {
    placeStatsSummary.textContent = "내장소저장에서 집이나 회사 위치를 저장하면 개인 통계가 표시됩니다.";
    placeStatsGrid.innerHTML = `
      <article class="place-stat-card is-empty">
        <strong>저장장소를 등록하면 표시됩니다</strong>
        <p>자주 쓰는 장소 기준으로 주변 재고, 0대 대여소, 대체 후보를 계산합니다.</p>
      </article>
    `;
    renderAlternativeRanking([]);
    return;
  }

  const readyPlaces = savedPlaces.filter((place) => place.lat && place.lng);
  const placeNames = savedPlaces.map((place) => getPlaceDisplayName(place)).join(", ");
  placeStatsSummary.textContent = readyPlaces.length
    ? `${placeNames} 주변 실시간 대여소를 비교했습니다.`
    : "저장장소 좌표를 확인하면 주변 통계를 계산합니다.";
  placeStatsGrid.innerHTML = savedPlaces.map(getPlaceStatCard).join("");
  renderAlternativeRanking(savedPlaces);
}

async function loadHistoricalStats() {
  if (!historicalStatsStatus || !topRentalStations || !lowUsageStations) {
    return;
  }

  try {
    const response = await fetch("./data/station-stats.json", { cache: "no-store" });

    if (!response.ok) {
      throw new Error("stats file not found");
    }

    const stats = await response.json();
    renderHistoricalStats(stats);
  } catch {
    historicalStatsStatus.textContent = "과거 대여이력 CSV를 집계하면 실제 순위가 표시됩니다.";
    renderRankingList(topRentalStations, []);
    renderRankingList(lowUsageStations, []);
  }
}

function renderHistoricalStats(stats) {
  const topStations = Array.isArray(stats.topRentalStations) ? stats.topRentalStations : [];
  const lowStations = Array.isArray(stats.lowUsageStations) ? stats.lowUsageStations : [];
  const generatedText = stats.generatedAt ? ` · ${new Date(stats.generatedAt).toLocaleDateString("ko-KR")} 집계` : "";
  const sourceText = stats.sourceFiles?.length ? `원본 ${stats.sourceFiles.length}개 파일` : "원본 데이터 대기";

  historicalStatsStatus.textContent = `${sourceText}${generatedText}`;
  renderRankingList(topRentalStations, topStations);
  renderRankingList(lowUsageStations, lowStations);
}

function renderRankingList(element, items) {
  if (!items.length) {
    element.innerHTML = "<li>집계 데이터 준비 중</li>";
    return;
  }

  element.innerHTML = items
    .slice(0, 5)
    .map(
      (item) => `
        <li>
          <strong>${escapeHTML(item.stationName || item.name || "대여소명 없음")}</strong>
          <span>${Number(item.usageCount || 0).toLocaleString("ko-KR")}건</span>
        </li>
      `,
    )
    .join("");
}

function renderPlaces() {
  placeForms.forEach((form) => {
    const slotIndex = Number(form.dataset.slotIndex || 0);
    const slotKey = getPlaceSlotKey(slotIndex);
    const place = places[slotIndex];
    const summary = form.querySelector("[data-slot-summary]");
    const typeInput = form.elements.type;
    const nameInput = form.elements.name;
    const addressInput = form.elements.address;
    const alarmInput = form.elements.alarmTime;

    if (place) {
      typeInput.value = place.type || "집";
      nameInput.value = place.name || "";
      addressInput.value = place.address || "";
      summary.textContent = `${getPlaceIcon(place.type)} ${place.name} 저장됨`;
    } else {
      typeInput.value = slotIndex === 0 ? "집" : "사무실";
      nameInput.value = "";
      addressInput.value = "";
      summary.textContent = slotIndex === 0 ? "첫 번째 장소를 저장하세요" : "두 번째 장소를 저장하세요";
    }

    alarmInput.value = getPlaceAlarmTime(slotKey);
  });

  if (placeList) {
    placeList.innerHTML = [0, 1]
      .map((index) => {
        const place = places[index];

        if (!place) {
          return "";
        }

        return `
          <article class="place-card">
            <div>
              <span>저장장소 ${index + 1} · ${escapeHTML(place.type)}</span>
              <h3>${escapeHTML(getPlaceDisplayName(place))}</h3>
              <p>${escapeHTML(place.address)} · 알림 ${escapeHTML(getPlaceAlarmTime(getPlaceSlotKey(index)))}</p>
            </div>
          </article>
        `;
      })
      .join("");
  }

  renderDashboard();
}

function getPlaceSlotKey(slotIndex) {
  return slotIndex === 0 ? "saved1" : "saved2";
}

function getPlaceAlarmTime(slotKey) {
  return alarmSettings.placeTimes?.[slotKey]?.time || alarmSettings.placeTimes?.[slotKey]?.morning || DEFAULT_ALARMS.placeTimes[slotKey].time;
}

function setSlotStatus(form, message = "", type = "") {
  const status = form.querySelector("[data-slot-status]");

  if (!status) {
    return;
  }

  status.textContent = message;
  status.dataset.type = type;
}

function setAddressFieldError(form, hasError) {
  const addressInput = form.elements.address;

  if (!addressInput) {
    return;
  }

  addressInput.classList.toggle("field-error", hasError);
  addressInput.setAttribute("aria-invalid", hasError ? "true" : "false");
}

function setMapState(title, detail = "", type = "loading") {
  if (!mapState) {
    return;
  }

  mapPreview?.classList.toggle("is-map-loading", type === "loading");
  mapPreview?.classList.toggle("is-map-error", type === "error");
  mapPreview?.classList.remove("is-map-loaded");
  mapState.hidden = false;
  mapState.dataset.type = type;
  mapState.innerHTML = `<strong>${escapeHTML(title)}</strong>${detail ? `<span>${escapeHTML(detail)}</span>` : ""}`;
}

function hideMapState() {
  if (!mapState) {
    return;
  }

  mapPreview?.classList.remove("is-map-loading", "is-map-error");
  mapPreview?.classList.add("is-map-loaded");
  mapState.hidden = true;
}

function relayoutKakaoMap(lat, lng) {
  if (!kakaoMap || !window.kakao?.maps) {
    return;
  }

  const center = Number.isFinite(lat) && Number.isFinite(lng) ? new kakao.maps.LatLng(lat, lng) : null;
  kakaoMap.relayout();

  if (center) {
    kakaoMap.setCenter(center);
  }
}

function queueKakaoMapRelayout(lat, lng) {
  if (!kakaoMap || !window.kakao?.maps) {
    return;
  }

  requestAnimationFrame(() => relayoutKakaoMap(lat, lng));
  [180, 500, 1200].forEach((delay) => {
    setTimeout(() => relayoutKakaoMap(lat, lng), delay);
  });
}

function showRadarNotification(body) {
  const notification = new Notification("따릉이 레이더", {
    body,
    icon: "./icons/icon-192.svg",
  });

  notification.onclick = () => {
    window.focus();
    switchTab("radar");
    (mapPreview || mapSection).scrollIntoView({ behavior: "smooth", block: "start" });
    notification.close();
  };
}

function geocodePlace(address) {
  return new Promise((resolve) => {
    if (!window.kakao?.maps?.services) {
      resolve(null);
      return;
    }

    const toCoords = (item) => ({
      lat: Number(item.y),
      lng: Number(item.x),
    });

    const geocoder = new kakao.maps.services.Geocoder();
    geocoder.addressSearch(address, (result, status) => {
      if (status === kakao.maps.services.Status.OK && result[0]) {
        resolve(toCoords(result[0]));
        return;
      }

      if (!kakao.maps.services.Places) {
        resolve(null);
        return;
      }

      const placesSearch = new kakao.maps.services.Places();
      placesSearch.keywordSearch(address, (placeResult, placeStatus) => {
        if (placeStatus !== kakao.maps.services.Status.OK || !placeResult[0]) {
          resolve(null);
          return;
        }

        resolve(toCoords(placeResult[0]));
      });
    });
  });
}

function requestCurrentLocation(options = {}) {
  if (!("geolocation" in navigator)) {
    locationFailed = true;
    locationStatus.textContent = getPlainLocationFallbackMessage();
    renderDashboard();
    return;
  }

  locationFailed = false;
  locationStatus.textContent = "현재 위치 권한을 요청하는 중입니다.";

  navigator.geolocation.getCurrentPosition(
    (position) => {
      currentPosition = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      locationFailed = false;

      mapTitle.textContent = "현재위치 주변 대여소";
      locationStatus.textContent = `현재위치 확인 완료: ${currentPosition.lat.toFixed(4)}, ${currentPosition.lng.toFixed(4)}`;
      moveKakaoMap(currentPosition.lat, currentPosition.lng);
      updateNearbyStations(currentPosition);
    },
    (error) => {
      currentPosition = null;
      locationFailed = true;
      console.warn("현재위치 확인 실패", error);
      locationStatus.textContent = getPlainLocationFallbackMessage();
      renderDashboard();
    },
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
  );
}

function requestFreshCurrentLocation() {
  if (!("geolocation" in navigator)) {
    locationFailed = true;
    locationStatus.textContent = getPlainLocationFallbackMessage();
    renderDashboard();
    return Promise.resolve(false);
  }

  locationFailed = false;
  locationStatus.textContent = "현재 위치를 다시 확인하는 중입니다.";

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        currentPosition = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        locationFailed = false;

        mapTitle.textContent = "현재위치 주변 대여소";
        locationStatus.textContent = `현재위치 확인 완료: ${currentPosition.lat.toFixed(4)}, ${currentPosition.lng.toFixed(4)}`;
        moveKakaoMap(currentPosition.lat, currentPosition.lng);
        updateNearbyStations(currentPosition);
        resolve(true);
      },
      (error) => {
        currentPosition = null;
        locationFailed = true;
        console.warn("현재위치 확인 실패", error);
        locationStatus.textContent = getPlainLocationFallbackMessage();
        renderDashboard();
        resolve(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  });
}

function initKakaoMap() {
  if (!window.kakao?.maps || !kakaoMapElement) {
    locationStatus.textContent = "카카오맵 도메인 등록이 필요합니다. JavaScript SDK 도메인을 확인하세요.";
    setMapState("지도를 불러오지 못했어요", "카카오맵 도메인 등록이나 네트워크 상태를 확인해 주세요.", "error");
    return;
  }

  setMapState("지도를 불러오는 중입니다", "주변 대여소를 지도에 표시하고 있어요.");
  const center = new kakao.maps.LatLng(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng);
  kakaoMap = new kakao.maps.Map(kakaoMapElement, {
    center,
    level: 5,
  });
  queueKakaoMapRelayout(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng);

  if ("ResizeObserver" in window && mapPreview && !mapResizeObserver) {
    mapResizeObserver = new ResizeObserver(() => {
      const center = currentPosition || DEFAULT_CENTER;
      queueKakaoMapRelayout(center.lat, center.lng);
    });
    mapResizeObserver.observe(mapPreview);
  }

  kakaoMapLoaded = false;
  kakao.maps.event.addListener(kakaoMap, "tilesloaded", () => {
    kakaoMapLoaded = true;
    setTimeout(() => {
      relayoutKakaoMap();
      kakaoMapElement.classList.add("loaded");
      hideMapState();
    }, 450);
  });

  setTimeout(() => {
    if (!kakaoMapLoaded) {
      setMapState("지도를 불러오는 중입니다", "네트워크 상태에 따라 조금 더 걸릴 수 있어요.");
    }
  }, 4500);

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

  relayoutKakaoMap(lat, lng);
  kakaoMap.setLevel(4);
  queueKakaoMapRelayout(lat, lng);
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
  (mapPreview || mapSection).scrollIntoView({ behavior: "smooth", block: "start" });
}

function focusArea(areaName, center) {
  highlightedStationId = "";
  stations = getNearbyStations(center);
  mapTitle.textContent = `${areaName} 주변 대여소`;
  locationStatus.textContent = `${areaName} 기준으로 지도와 대체 대여소를 바꿨습니다.`;
  renderStations(stations);
  renderKakaoOverlays(stations);
  moveKakaoMap(center.lat, center.lng);
  (mapPreview || mapSection).scrollIntoView({ behavior: "smooth", block: "start" });
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
  const place = await ensurePlaceCoords(cardKey === "saved1" ? firstPlace : secondPlace);

  if (!place || !place.lat || !place.lng) {
    switchTab("places");
    const targetForm = placeForms[cardKey === "saved1" ? 0 : 1];
    targetForm?.elements.name?.focus();
    return;
  }

  focusArea(place.name, { lat: place.lat, lng: place.lng });
}

function switchTab(tabName) {
  tabButtons.forEach((button) => button.classList.toggle("active", button.dataset.tab === tabName));
  radarPage.classList.toggle("active", tabName === "radar");
  placesPage.classList.toggle("active", tabName === "places");
  tipsPage.classList.toggle("active", tabName === "tips");

  if (tabName === "radar") {
    const center = currentPosition || DEFAULT_CENTER;
    queueKakaoMapRelayout(center.lat, center.lng);
  }
}

function switchTipCategory(category) {
  tipCategoryButtons.forEach((button) => button.classList.toggle("active", button.dataset.tipCategory === category));
  tipPanels.forEach((panel) => panel.classList.toggle("active", panel.dataset.tipPanel === category));
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator && ["http:", "https:"].includes(window.location.protocol)) {
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

  await requestFreshCurrentLocation();
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

saveAlarmButton?.addEventListener("click", async () => {
  let enabled = alarmSettings.enabled;

  if ("Notification" in window) {
    const permission = await Notification.requestPermission();
    enabled = permission === "granted";
  }

  alarmSettings = {
    ...alarmSettings,
    enabled,
  };
  saveAlarmSettings();
  renderAlarmSettings();
});

notificationButton?.addEventListener("click", async () => {
  if (alarmSettings.enabled) {
    alarmSettings = {
      ...alarmSettings,
      enabled: false,
    };
    saveAlarmSettings();
    renderAlarmSettings();
    unregisterPushRegistration().catch((error) => console.warn("푸시 해제 실패", error));
    if (notificationStatus) {
      notificationStatus.textContent = "레이다 알림을 껐습니다.";
    }
    return;
  }

  if (IS_NATIVE_APP && getPushNotificationsPlugin()) {
    alarmSettings = {
      ...alarmSettings,
      enabled: true,
      targets: {
        saved1: true,
        saved2: true,
      },
    };
    saveAlarmSettings();
    renderAlarmSettings();
    await enableNativePushNotifications();
    return;
  }

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
    targets: {
      saved1: true,
      saved2: true,
    },
  };
  saveAlarmSettings();
  renderAlarmSettings();
  syncPushRegistration().catch((error) => console.warn("푸시 설정 저장 실패", error));
  const alert = getAlarmNotificationAlert();

  showRadarNotification(`${formatNow(new Date())} 기준 ${alert.title}. ${alert.text}`);
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

function hasSavedAlarmPlaces() {
  return getAlarmTargetPlaces().length > 0;
}

function shouldUseNativePush() {
  return IS_NATIVE_APP && Boolean(getPushNotificationsPlugin());
}

async function ensureNativePushEnabled(statusTarget = null) {
  if (!shouldUseNativePush() || alarmSettings.enabled || !hasSavedAlarmPlaces()) {
    return false;
  }

  if (statusTarget) {
    statusTarget.textContent = "알림 권한을 확인하는 중입니다.";
    statusTarget.dataset.type = "info";
  }

  alarmSettings = {
    ...alarmSettings,
    enabled: true,
    targets: {
      saved1: true,
      saved2: true,
    },
  };
  saveAlarmSettings();
  renderAlarmSettings();

  const enabled = await enableNativePushNotifications();
  alarmSettings = {
    ...alarmSettings,
    enabled,
  };
  saveAlarmSettings();
  renderAlarmSettings();

  if (statusTarget) {
    statusTarget.textContent = enabled
      ? "장소와 알림시간을 저장했고, 알림 권한을 허용했습니다."
      : "장소는 저장했습니다. Android 설정에서 알림 권한을 허용해야 정해진 시간에 받을 수 있습니다.";
    statusTarget.dataset.type = enabled ? "success" : "error";
  }

  return enabled;
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
  const [firstPlace, secondPlace] = getWatchedPlaces();
  const duePlaces = [
    { place: firstPlace, key: "saved1" },
    { place: secondPlace, key: "saved2" },
  ].filter(({ place, key }) => {
    const alarmTime = getPlaceAlarmTime(key);
    return place && alarmTime === currentTime;
  });

  if (!duePlaces.length) {
    return;
  }

  const sentKey = `${now.toISOString().slice(0, 10)}-${currentTime}-${duePlaces.map(({ key }) => key).join("-")}`;

  if (window.localStorage.getItem(alarmSentStorageKey) === sentKey) {
    return;
  }

  const alertTexts = duePlaces.map(({ place }) => {
    const alert = getPlaceNotificationAlert(place);
    return `${alert.title}. ${alert.text}`;
  });
  window.localStorage.setItem(alarmSentStorageKey, sentKey);

  showRadarNotification(alertTexts.join(" / "));
}

placeForms.forEach((form) => {
  form.addEventListener("submit", async (event) => savePlaceSlot(event, form));
  form.elements.address?.addEventListener("input", () => {
    setAddressFieldError(form, false);
    setSlotStatus(form);
  });
});

async function savePlaceSlot(event, form) {
  event.preventDefault();

  const slotIndex = Number(form.dataset.slotIndex || 0);
  const slotKey = getPlaceSlotKey(slotIndex);
  const address = form.elements.address.value.trim();
  const name = form.elements.name.value.trim();
  const editingPlace = places[slotIndex];
  const canReuseCoords =
    editingPlace &&
    editingPlace.address === address &&
    Number.isFinite(Number(editingPlace.lat)) &&
    Number.isFinite(Number(editingPlace.lng));
  const submitButton = form.querySelector('button[type="submit"]');

  setAddressFieldError(form, false);
  setSlotStatus(form, "주소를 확인하는 중입니다.", "info");
  if (submitButton) {
    submitButton.disabled = true;
  }

  const coords = canReuseCoords ? { lat: Number(editingPlace.lat), lng: Number(editingPlace.lng) } : await geocodePlace(address);

  if (submitButton) {
    submitButton.disabled = false;
  }

  if (!coords) {
    const message = window.kakao?.maps?.services
      ? "주소를 찾지 못했어요. 도로명주소나 지번주소로 다시 입력해 주세요. 예: 서울 강서구 등촌로 163"
      : "주소검색 연결이 막혔어요. 로컬 127.0.0.1 대신 배포 주소나 localhost에서 다시 확인해주세요.";
    setSlotStatus(form, message, "error");
    setAddressFieldError(form, true);
    form.elements.address.focus();
    return;
  }

  const nextPlace = {
    id: editingPlace?.id || createId(),
    type: form.elements.type.value,
    name,
    address,
    lat: coords.lat,
    lng: coords.lng,
    role: "",
  };

  places[slotIndex] = nextPlace;
  places = places.slice(0, 2);
  alarmSettings = {
    ...alarmSettings,
    enabled: alarmSettings.enabled,
    targets: { ...alarmSettings.targets, [slotKey]: true },
    placeTimes: {
      ...alarmSettings.placeTimes,
      [slotKey]: { ...alarmSettings.placeTimes?.[slotKey], time: form.elements.alarmTime.value },
    },
  };

  if (!shouldUseNativePush() && "Notification" in window) {
    const permission = await Notification.requestPermission();
    alarmSettings.enabled = permission === "granted" || alarmSettings.enabled;
  }

  savePlaces();
  saveAlarmSettings();
  renderPlaces();
  setAddressFieldError(form, false);
  setSlotStatus(form, "장소와 알림시간을 저장했습니다.", "success");
  const pushEnabled = await ensureNativePushEnabled(form.querySelector("[data-slot-status]"));

  if (!pushEnabled) {
    syncPushRegistration().catch((error) => console.warn("푸시 설정 저장 실패", error));
  }
}

placeList?.addEventListener("click", (event) => {
  const button = event.target.closest("button");

  if (!button) {
    return;
  }

  const action = button.dataset.placeAction;
  const id = button.dataset.id;
  const place = places.find((item) => item.id === id);

  if (action === "delete") {
    places = places.filter((item) => item.id !== id);
    savePlaces();
    renderPlaces();
    return;
  }

  const role = button.dataset.role;

  if (!role) {
    return;
  }

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

brandHomeButton?.addEventListener("click", () => {
  switchTab("radar");
  window.scrollTo({ top: 0, behavior: "smooth" });
});

tipCategoryButtons.forEach((button) => {
  button.addEventListener("click", () => switchTipCategory(button.dataset.tipCategory));
});

openMyButton?.addEventListener("click", () => switchTab("places"));

renderPlaces();
renderDashboard();
loadHistoricalStats();
initKakaoMap();
fetchSeoulBikeStations();
setTimeout(requestCurrentLocation, 600);
setupNativePushNotifications().catch((error) => console.warn("푸시 리스너 준비 실패", error));
if (shouldUseNativePush() && hasSavedAlarmPlaces() && !alarmSettings.enabled) {
  setTimeout(() => {
    ensureNativePushEnabled().catch((error) => console.warn("푸시 자동 설정 실패", error));
  }, 900);
} else {
  syncPushRegistration().catch((error) => console.warn("푸시 설정 저장 실패", error));
}
registerServiceWorker();
setupPullToRefresh();
setInterval(renderDashboard, 60 * 1000);
setInterval(checkScheduledNotification, 30 * 1000);
