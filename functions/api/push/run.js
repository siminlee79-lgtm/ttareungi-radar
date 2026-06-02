import {
  authorizePushRequest,
  buildPlaceAlert,
  fetchAllBikeRows,
  getBinding,
  getTimeParts,
  isPlaceDue,
  jsonResponse,
  normalizeAlarmSettings,
  pushCorsHeaders,
  sendFcm,
} from "../_shared/push-utils.js";

export async function onRequestOptions() {
  return new Response(null, { headers: pushCorsHeaders });
}

export async function onRequestGet(context) {
  return runPushJob(context);
}

export async function onRequestPost(context) {
  return runPushJob(context);
}

async function runPushJob(context) {
  const auth = authorizePushRequest(context);

  if (!auth.ok) {
    return auth.response;
  }

  const db = getBinding(context);

  if (!db) {
    return jsonResponse({ error: "Missing D1 binding DB" }, { status: 500 });
  }

  const subscriptions = await db
    .prepare(
      `
      SELECT device_id, fcm_token, timezone, places_json, alarm_settings_json, last_sent_key
      FROM push_subscriptions
      WHERE enabled = 1 AND fcm_token IS NOT NULL
      LIMIT 500
      `,
    )
    .all();

  const dueItems = [];

  for (const subscription of subscriptions.results || []) {
    const timezone = subscription.timezone || "Asia/Seoul";
    const { dateKey, hhmm } = getTimeParts(new Date(), timezone);
    const places = JSON.parse(subscription.places_json || "[]");
    const alarmSettings = normalizeAlarmSettings(JSON.parse(subscription.alarm_settings_json || "{}"));
    const duePlaces = places.filter((place) => isPlaceDue(place, alarmSettings, hhmm));

    if (!duePlaces.length) {
      continue;
    }

    const sentKey = `${dateKey}-${hhmm}-${duePlaces.map((place) => place.slotKey).join("-")}`;

    if (subscription.last_sent_key === sentKey) {
      continue;
    }

    dueItems.push({
      subscription,
      duePlaces,
      sentKey,
      hhmm,
      dateKey,
    });
  }

  if (!dueItems.length) {
    return jsonResponse({ ok: true, checked: subscriptions.results?.length || 0, sent: 0 });
  }

  const rows = await fetchAllBikeRows(context.env);
  let sent = 0;
  let failed = 0;

  for (const item of dueItems) {
    const alerts = item.duePlaces.map((place) => buildPlaceAlert(place, rows));
    const title = alerts.length === 1 ? alerts[0].title : "따릉이 레이더 알림";
    const body = alerts.map((alert) => alert.body).join(" / ");

    try {
      await sendFcm(
        context.env,
        item.subscription.fcm_token,
        { title, body },
        {
          dateKey: item.dateKey,
          time: item.hhmm,
          deviceId: item.subscription.device_id,
        },
      );
      await markSent(db, item.subscription.device_id, item.sentKey);
      await logNotification(db, item.subscription.device_id, item.sentKey, "sent", "");
      sent += 1;
    } catch (error) {
      await markError(db, item.subscription.device_id, error.message);
      await logNotification(db, item.subscription.device_id, item.sentKey, "failed", error.message);
      failed += 1;
    }
  }

  return jsonResponse({
    ok: true,
    checked: subscriptions.results?.length || 0,
    due: dueItems.length,
    sent,
    failed,
  });
}

async function markSent(db, deviceId, sentKey) {
  await db
    .prepare(
      `
      UPDATE push_subscriptions
      SET last_sent_key = ?, last_error = NULL, updated_at = ?
      WHERE device_id = ?
      `,
    )
    .bind(sentKey, new Date().toISOString(), deviceId)
    .run();
}

async function markError(db, deviceId, message) {
  await db
    .prepare(
      `
      UPDATE push_subscriptions
      SET last_error = ?, updated_at = ?
      WHERE device_id = ?
      `,
    )
    .bind(message.slice(0, 500), new Date().toISOString(), deviceId)
    .run();
}

async function logNotification(db, deviceId, sentKey, status, message) {
  await db
    .prepare(
      `
      INSERT INTO notification_logs (device_id, sent_key, status, message, created_at)
      VALUES (?, ?, ?, ?, ?)
      `,
    )
    .bind(deviceId, sentKey, status, message.slice(0, 500), new Date().toISOString())
    .run();
}
