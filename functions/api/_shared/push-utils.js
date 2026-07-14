export const pushCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

let cachedFcmAccessToken = null;

export function jsonResponse(body, init = {}) {
  return Response.json(body, {
    ...init,
    headers: {
      ...pushCorsHeaders,
      ...(init.headers || {}),
    },
  });
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function authorizePushRequest(context) {
  const auth = context.request.headers.get("Authorization") || "";
  const url = new URL(context.request.url);
  const secret = context.env.PUSH_CRON_SECRET;

  if (!secret) {
    return { ok: false, response: jsonResponse({ error: "Missing PUSH_CRON_SECRET" }, { status: 500 }) };
  }

  if (auth !== `Bearer ${secret}` && url.searchParams.get("secret") !== secret) {
    return { ok: false, response: jsonResponse({ error: "Unauthorized" }, { status: 401 }) };
  }

  return { ok: true };
}

export function getBinding(context, name = "DB") {
  return context.env?.[name] || null;
}

export function normalizePlace(place, slotKey) {
  if (!place || !Number.isFinite(Number(place.lat)) || !Number.isFinite(Number(place.lng))) {
    return null;
  }

  return {
    slotKey,
    id: String(place.id || slotKey),
    type: String(place.type || ""),
    name: String(place.name || "저장 장소"),
    address: String(place.address || ""),
    lat: Number(place.lat),
    lng: Number(place.lng),
  };
}

export function normalizePlaces(places) {
  const source = Array.isArray(places) ? places : [];
  return [normalizePlace(source[0], "saved1"), normalizePlace(source[1], "saved2")].filter(Boolean);
}

export function normalizeAlarmSettings(settings = {}) {
  const fallback = {
    enabled: false,
    targets: { saved1: true, saved2: true },
    placeTimes: {
      saved1: { time: "07:00" },
      saved2: { time: "18:30" },
    },
  };

  return {
    ...fallback,
    ...settings,
    enabled: Boolean(settings.enabled),
    targets: {
      ...fallback.targets,
      ...(settings.targets || {}),
    },
    placeTimes: {
      saved1: normalizePlaceTime(settings.placeTimes?.saved1, fallback.placeTimes.saved1.time),
      saved2: normalizePlaceTime(settings.placeTimes?.saved2, fallback.placeTimes.saved2.time),
    },
  };
}

export function normalizePlaceTime(value, fallback) {
  const time = value?.time || value?.morning || fallback;
  return {
    ...value,
    time: /^\d{2}:\d{2}$/.test(time) ? time : fallback,
  };
}

export function getTimeParts(now = new Date(), timezone = "Asia/Seoul") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .formatToParts(now)
    .reduce((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});

  return {
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    hhmm: `${parts.hour}:${parts.minute}`,
  };
}

export function isPlaceDue(place, alarms, hhmm) {
  if (!place || !alarms.enabled || alarms.targets?.[place.slotKey] === false) {
    return false;
  }

  return alarms.placeTimes?.[place.slotKey]?.time === hhmm;
}

export async function fetchAllBikeRows(env) {
  const seoulOpenApiKey = env.SEOUL_OPEN_API_KEY;

  if (!seoulOpenApiKey) {
    throw new Error("Missing SEOUL_OPEN_API_KEY");
  }

  const baseUrl = `http://openapi.seoul.go.kr:8088/${seoulOpenApiKey}/json/bikeList`;
  // list_total_count reports the requested page size (1000), not the grand
  // total, so page sequentially until a short page (the last one) instead.
  const pageSize = 1000;
  const maxPages = 6;
  const allRows = [];

  for (let page = 0; page < maxPages; page += 1) {
    const start = page * pageSize + 1;
    const end = start + pageSize - 1;
    const data = await fetchBikePage(baseUrl, start, end);
    const rows = data.rentBikeStatus?.row || [];
    allRows.push(...rows);

    if (rows.length < pageSize) {
      break;
    }
  }

  return allRows;
}

async function fetchBikePage(baseUrl, start, end) {
  const response = await fetch(`${baseUrl}/${start}/${end}/`);

  if (!response.ok) {
    throw new Error(`Seoul API error: ${response.status}`);
  }

  return response.json();
}

export function normalizeBikeRow(row) {
  return {
    id: row.stationId,
    name: String(row.stationName || "").replace(/^\d+\.\s*/, ""),
    bikes: Number(row.parkingBikeTotCnt) || 0,
    rackCount: Number(row.rackTotCnt) || 0,
    shared: Number(row.shared) || 0,
    lat: Number(row.stationLatitude),
    lng: Number(row.stationLongitude),
  };
}

export function getNearbyStations(center, rows, limit = 5) {
  return rows
    .map(normalizeBikeRow)
    .filter((station) => Number.isFinite(station.lat) && Number.isFinite(station.lng))
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

export function buildPlaceAlert(place, rows) {
  const nearby = getNearbyStations(place, rows, 5).map((station) => ({
    ...station,
    risk: getRisk(station),
  }));
  const primary = nearby[0];
  const alternative = nearby
    .filter((station) => station.id !== primary?.id && station.bikes > 2)
    .sort((a, b) => a.risk.score - b.risk.score || a.distanceMeters - b.distanceMeters)[0];

  if (!primary) {
    return {
      title: `${place.name} 따릉이 알림`,
      body: "주변 대여소 정보를 불러오지 못했어요. 앱에서 다시 확인해 주세요.",
    };
  }

  if (primary.risk.level === "critical") {
    const alternativeText = alternative
      ? `대체 대여소는 ${alternative.name}, ${alternative.distance}, 현재 ${alternative.bikes}대입니다.`
      : "주변 대체 대여소도 부족합니다. 조금 일찍 움직이는 것을 추천합니다.";

    return {
      title: `${place.name} 마감임박`,
      body: `${primary.name} 현재 ${primary.bikes}대. ${alternativeText}`,
    };
  }

  if (primary.risk.level === "low") {
    return {
      title: `${place.name} 재고소진중`,
      body: `${primary.name} 현재 ${primary.bikes}대. 출발 전 한 번 더 확인하세요.`,
    };
  }

  return {
    title: `${place.name} 여유`,
    body: `${primary.name} 현재 ${primary.bikes}대. 주변 수급이 안정적입니다.`,
  };
}

function getRisk(station) {
  const bikes = Number(station.bikes) || 0;
  const rackCount = Number(station.rackCount) || 0;
  const stockRate = rackCount ? Math.round((bikes / rackCount) * 100) : 0;
  const score = Math.max(0, Math.min(99, 100 - stockRate));

  if (bikes <= 1 || stockRate < 30) {
    return { label: "마감임박", level: "critical", className: "danger", score };
  }

  if (stockRate < 60) {
    return { label: "재고소진중", level: "low", className: "warning", score };
  }

  return { label: "여유", level: "enough", className: "safe", score };
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

export async function sendFcm(env, token, notification, data = {}) {
  const serviceAccount = getFirebaseServiceAccount(env);
  const accessToken = await getFcmAccessToken(serviceAccount);
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        token,
        notification,
        data: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, String(value)])),
        android: {
          priority: "HIGH",
        },
      },
    }),
  });
  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.error?.message || `FCM error ${response.status}`);
  }

  return result;
}

function getFirebaseServiceAccount(env) {
  if (env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const parsed = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
    parsed.private_key = parsed.private_key?.replace(/\\n/g, "\n");
    return parsed;
  }

  if (env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
    return {
      project_id: env.FIREBASE_PROJECT_ID,
      client_email: env.FIREBASE_CLIENT_EMAIL,
      private_key: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    };
  }

  throw new Error("Missing Firebase service account env vars");
}

async function getFcmAccessToken(serviceAccount) {
  const nowSeconds = Math.floor(Date.now() / 1000);

  if (cachedFcmAccessToken && cachedFcmAccessToken.expiresAt > nowSeconds + 60) {
    return cachedFcmAccessToken.token;
  }

  const assertion = await createJwtAssertion(serviceAccount, nowSeconds);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const token = await response.json();

  if (!response.ok) {
    throw new Error(token.error_description || token.error || `OAuth error ${response.status}`);
  }

  cachedFcmAccessToken = {
    token: token.access_token,
    expiresAt: nowSeconds + Number(token.expires_in || 3600),
  };

  return cachedFcmAccessToken.token;
}

async function createJwtAssertion(serviceAccount, nowSeconds) {
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  };
  const unsigned = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(claim))}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(serviceAccount.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));

  return `${unsigned}.${base64UrlEncode(signature)}`;
}

function pemToArrayBuffer(pem) {
  const base64 = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer;
}

function base64UrlEncode(value) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
