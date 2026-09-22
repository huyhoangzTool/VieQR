import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB for this simple Function upload endpoint.

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

function safeName(name) {
  return String(name || "file")
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "file";
}

export default async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return json({ error: "Không tìm thấy file." }, 400);
    }

    if (file.size > MAX_BYTES) {
      return json({ error: "File tối đa 5 MB trong phiên bản này." }, 413);
    }

    const id = crypto.randomUUID();
    const name = safeName(file.name);
    const key = `${id}-${name}`;

    const store = getStore("vieqr-uploads");
    const arrayBuffer = await file.arrayBuffer();

    await store.set(key, arrayBuffer, {
      metadata: {
        contentType: file.type || "application/octet-stream",
        originalName: name
      }
    });

    return json({
      ok: true,
      key,
      name,
      url: `${new URL(request.url).origin}/.netlify/functions/file?key=${encodeURIComponent(key)}`
    });
  } catch (error) {
    console.error(error);
    return json({ error: "Upload thất bại." }, 500);
  }
};
