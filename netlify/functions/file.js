import { getStore } from "@netlify/blobs";

function safeDownloadName(name) {
  return String(name || "download")
    .replace(/["\r\n]/g, "")
    .slice(0, 160);
}

export default async (request, context) => {
  if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });

  const key = new URL(request.url).searchParams.get("key");
  if (!key) return new Response("Missing file key", { status: 400 });

  try {
    const store = getStore("vieqr-uploads");
    const entry = await store.getWithMetadata(key, { type: "arrayBuffer" });

    if (!entry) return new Response("File not found", { status: 404 });

    const contentType = entry.metadata?.contentType || "application/octet-stream";
    const originalName = safeDownloadName(entry.metadata?.originalName || "download");

    return new Response(entry.data, {
      headers: {
        "content-type": contentType,
        "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(originalName)}`,
        "cache-control": "public, max-age=31536000, immutable"
      }
    });
  } catch (error) {
    console.error(error);
    return new Response("Unable to read file", { status: 500 });
  }
};
