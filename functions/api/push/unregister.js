import { getBinding, jsonResponse, pushCorsHeaders, readJson } from "../_shared/push-utils.js";

export async function onRequestOptions() {
  return new Response(null, { headers: pushCorsHeaders });
}

export async function onRequestPost(context) {
  const db = getBinding(context);

  if (!db) {
    return jsonResponse({ error: "Missing D1 binding DB" }, { status: 500 });
  }

  const body = await readJson(context.request);

  if (!body?.deviceId && !body?.token) {
    return jsonResponse({ error: "deviceId or token is required" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const result = body.deviceId
    ? await db
        .prepare(
          `
          UPDATE push_subscriptions
          SET enabled = 0, updated_at = ?
          WHERE device_id = ?
          `,
        )
        .bind(now, String(body.deviceId))
        .run()
    : await db
        .prepare(
          `
          UPDATE push_subscriptions
          SET enabled = 0, updated_at = ?
          WHERE fcm_token = ?
          `,
        )
        .bind(now, String(body.token))
        .run();

  return jsonResponse({
    ok: true,
    changed: result.meta?.changes || 0,
  });
}
