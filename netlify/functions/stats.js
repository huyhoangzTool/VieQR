import { getStore } from "@netlify/blobs";

const STORE = "vieqr-stats";

const defaultStats = {
  visits: 0,
  qrs: 0,
  modeChanges: 0
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

export default async (request) => {
  try {
    const store = getStore(STORE);

    if (request.method === "GET") {
      const stats = await store.get("stats", { type: "json", consistency: "strong" }) || defaultStats;
      return json(stats);
    }

    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const body = await request.json();
    const action = body?.action;

    if (!["visit", "qr", "mode"].includes(action)) {
      return json({ error: "Invalid action" }, 400);
    }

    const current = await store.get("stats", { type: "json", consistency: "strong" }) || defaultStats;
    const next = {
      visits: Number(current.visits || 0),
      qrs: Number(current.qrs || 0),
      modeChanges: Number(current.modeChanges || 0)
    };

    if (action === "visit") {
      const visitorId = String(body?.visitorId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
      if (!visitorId) return json({ error: "Missing visitorId" }, 400);

      const visitorKey = `visitors/${visitorId}`;
      const already = await store.get(visitorKey, { consistency: "strong" });

      if (!already) {
        await store.set(visitorKey, "1");
        next.visits++;
      }
    }

    if (action === "qr") next.qrs++;
    if (action === "mode") next.modeChanges++;

    await store.setJSON("stats", next);
    return json(next);
  } catch (error) {
    console.error(error);
    return json({ error: "Stats service unavailable" }, 503);
  }
};
