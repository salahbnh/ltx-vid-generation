// src/app/api/generate/route.ts
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Mode = "text-to-video" | "image-to-video";

type GenerateBody = {
  mode?: Mode;
  prompt?: string;
  image_uri?: string;
  model?: string;
  duration?: number;
  resolution?: string;
  fps?: number;
  camera_motion?:
    | "dolly_in"
    | "dolly_out"
    | "dolly_left"
    | "dolly_right"
    | "jib_up"
    | "jib_down"
    | "static"
    | "focus_shift";
  generate_audio?: boolean;
};

const API_BASE = process.env.LTX_API_BASE || "https://api.ltx.video";
const API_KEY = process.env.LTX_API_KEY || "";

export async function POST(req: NextRequest) {
  console.log("[LTX] Incoming request");

  if (!API_KEY) {
    return Response.json(
      {
        error:
          "Missing LTX_API_KEY. Create .env.local in the project root, then restart the dev server.",
      },
      { status: 500 }
    );
  }

  let body: GenerateBody;

  try {
    body = (await req.json()) as GenerateBody;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const mode: Mode = body.mode ?? "text-to-video";
  const prompt = (body.prompt ?? "").trim();
  const model =
    body.model ??
    (mode === "image-to-video" ? "ltx-2-3-fast" : "ltx-2-3-pro");
  const duration = body.duration ?? 6;
  const resolution = body.resolution ?? "1920x1080";
  const fps = body.fps ?? 24;
  const camera_motion = body.camera_motion ?? "focus_shift";
  const generate_audio = body.generate_audio ?? false;

  if (!prompt) {
    return Response.json({ error: "Prompt is required." }, { status: 400 });
  }

  if (mode === "image-to-video" && !body.image_uri) {
    return Response.json(
      { error: "image_uri is required for image-to-video." },
      { status: 400 }
    );
  }

  const endpoint =
    mode === "image-to-video" ? "/v1/image-to-video" : "/v1/text-to-video";

  const payload: Record<string, unknown> = {
    prompt,
    model,
    duration,
    resolution,
    fps,
    camera_motion,
    generate_audio,
  };

  if (mode === "image-to-video") {
    payload.image_uri = body.image_uri;
  }

  console.log("[LTX] Preparing request", {
    endpoint,
    model,
    duration,
    resolution,
    fps,
    camera_motion,
    generate_audio,
    mode,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180_000);

  try {
    const upstream = await fetch(`${API_BASE}${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const requestId = upstream.headers.get("x-request-id") ?? "unknown";

    console.log("[LTX] Upstream response", {
      status: upstream.status,
      requestId,
      contentType: upstream.headers.get("content-type"),
    });

    if (!upstream.ok) {
      const errorText = await upstream.text();
      console.error("[LTX] Upstream error:", errorText);

      return Response.json(
        {
          error: "LTX request failed.",
          upstreamStatus: upstream.status,
          upstreamError: errorText.slice(0, 2000),
          requestId,
        },
        { status: upstream.status }
      );
    }

    const headers = new Headers();
    headers.set("Content-Type", upstream.headers.get("content-type") || "video/mp4");
    headers.set("Cache-Control", "no-store");
    headers.set("X-LTX-Request-Id", requestId);
    headers.set("X-LTX-Upstream-Status", String(upstream.status));

    return new Response(upstream.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    clearTimeout(timeout);

    console.error("[LTX] Exception:", error);

    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      {
        error: message,
        hint:
          "Check your API key, model name, duration, resolution, and whether the LTX service is currently reachable.",
      },
      { status: 500 }
    );
  }
}