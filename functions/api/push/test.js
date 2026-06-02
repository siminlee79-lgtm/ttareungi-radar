import {
  authorizePushRequest,
  buildPlaceAlert,
  fetchAllBikeRows,
  getBinding,
  jsonResponse,
  pushCorsHeaders,
  readJson,
  sendFcm,
} from "../_shared/push-utils.js";

export async function onRequestOptions() {
  return new Response(null, { headers: pushCorsHeaders });
}

export async function onRequestPost(context) {
  const auth = authorizePushRequest(context);

  if (!auth.ok) {
    return auth.response;
  }

  const body = (await readJson(context.request)) || {};
  const subscription = body.token ? buildSubscriptionFromBody(body) : await findSubscription(context, body.deviceId);

  if (!subscription?.fcm_token) {
    return jsonResponse({ error: "No FCM token found for test push" }, { status: 404 });
  }

  const places = JSON.parse(subscription.places_json || "[]");
  const place = places[0];
  let notification = {
    title: "따릉이 레이더 테스트",
    body: "서버 푸시 연결 테스트입니다. 이 알림이 보이면 FCM 수신 경로가 살아 있습니다.",
  };

  if (place?.lat && place?.lng && body.includeBikeStatus !== false) {
    const rows = await fetchAllBikeRows(context.env);
    notification = buildPlaceAlert(place, rows);
  }

  const result = await sendFcm(context.env, subscription.fcm_token, notification, {
    type: "manual-test",
    deviceId: subscription.device_id || "manual",
  });

  return jsonResponse({
    ok: true,
    deviceId: subscription.device_id || null,
    notification,
    result,
  });
}

async function findSubscription(context, deviceId) {
  const db = getBinding(context);

  if (!db) {
    throw new Error("Missing D1 binding DB");
  }

  if (deviceId) {
    const row = await db
      .prepare(
        `
        SELECT device_id, fcm_token, places_json
        FROM push_subscriptions
        WHERE device_id = ?
        LIMIT 1
        `,
      )
      .bind(String(deviceId))
      .first();
    return row;
  }

  return db
    .prepare(
      `
      SELECT device_id, fcm_token, places_json
      FROM push_subscriptions
      WHERE enabled = 1 AND fcm_token IS NOT NULL
      ORDER BY last_seen_at DESC
      LIMIT 1
      `,
    )
    .first();
}

function buildSubscriptionFromBody(body) {
  return {
    device_id: body.deviceId || "manual",
    fcm_token: String(body.token),
    places_json: JSON.stringify(Array.isArray(body.places) ? body.places : []),
  };
}
