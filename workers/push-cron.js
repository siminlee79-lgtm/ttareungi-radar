export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runPush(env));
  },

  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname !== "/run") {
      return new Response("Not found", { status: 404 });
    }

    return runPush(env);
  },
};

async function runPush(env) {
  if (!env.PUSH_RUN_URL || !env.PUSH_CRON_SECRET) {
    return Response.json({ error: "Missing PUSH_RUN_URL or PUSH_CRON_SECRET" }, { status: 500 });
  }

  const response = await fetch(env.PUSH_RUN_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.PUSH_CRON_SECRET}`,
    },
  });
  const text = await response.text();

  return new Response(text, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("Content-Type") || "application/json",
    },
  });
}
