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

  // Turning alerts off removes the row outright rather than flipping a flag.
  // The row holds the coordinates of the user's home and workplace, and there
  // was no other path that ever erased them — leaving them behind after the
  // user opted out is not something we can justify.
  const result = body.deviceId
    ? await db
        .prepare(`DELETE FROM push_subscriptions WHERE device_id = ?`)
        .bind(String(body.deviceId))
        .run()
    : await db
        .prepare(`DELETE FROM push_subscriptions WHERE fcm_token = ?`)
        .bind(String(body.token))
        .run();

  return jsonResponse({
    ok: true,
    deleted: result.meta?.changes || 0,
  });
}
