import {
  getBinding,
  jsonResponse,
  normalizeAlarmSettings,
  normalizePlaces,
  pushCorsHeaders,
  readJson,
} from "../_shared/push-utils.js";

export async function onRequestOptions() {
  return new Response(null, { headers: pushCorsHeaders });
}

export async function onRequestPost(context) {
  const db = getBinding(context);

  if (!db) {
    return jsonResponse({ error: "Missing D1 binding DB" }, { status: 500 });
  }

  const body = await readJson(context.request);

  if (!body?.deviceId || !body?.token) {
    return jsonResponse({ error: "deviceId and token are required" }, { status: 400 });
  }

  const places = normalizePlaces(body.places);
  const alarmSettings = normalizeAlarmSettings(body.alarmSettings);
  const enabled = Boolean(alarmSettings.enabled && places.length);
  const now = new Date().toISOString();

  await db
    .prepare(
      `
      INSERT INTO push_subscriptions (
        device_id,
        fcm_token,
        platform,
        timezone,
        enabled,
        places_json,
        alarm_settings_json,
        app_version,
        created_at,
        updated_at,
        last_seen_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(device_id) DO UPDATE SET
        fcm_token = excluded.fcm_token,
        platform = excluded.platform,
        timezone = excluded.timezone,
        enabled = excluded.enabled,
        places_json = excluded.places_json,
        alarm_settings_json = excluded.alarm_settings_json,
        app_version = excluded.app_version,
        updated_at = excluded.updated_at,
        last_seen_at = excluded.last_seen_at,
        last_error = NULL
      `,
    )
    .bind(
      String(body.deviceId),
      String(body.token),
      String(body.platform || "android"),
      String(body.timezone || "Asia/Seoul"),
      enabled ? 1 : 0,
      JSON.stringify(places),
      JSON.stringify(alarmSettings),
      String(body.appVersion || ""),
      now,
      now,
      now,
    )
    .run();

  return jsonResponse({
    ok: true,
    enabled,
    places: places.length,
  });
}
