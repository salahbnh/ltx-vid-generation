// src/app/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type Mode = "text-to-video" | "image-to-video";
type CameraMotion =
  | "dolly_in"
  | "dolly_out"
  | "dolly_left"
  | "dolly_right"
  | "jib_up"
  | "jib_down"
  | "static"
  | "focus_shift";

const MODEL_OPTIONS = [
  { value: "ltx-2-3-fast", label: "ltx-2-3-fast — faster / cheaper" },
  { value: "ltx-2-3-pro", label: "ltx-2-3-pro — best quality" },
  { value: "ltx-2-fast", label: "ltx-2-fast — older fast model" },
  { value: "ltx-2-pro", label: "ltx-2-pro — older pro model" },
];

const RESOLUTION_OPTIONS = [
  "1920x1080",
  "2560x1440",
  "3840x2160",
  "1080x1920",
  "1440x2560",
  "2160x3840",
];

const CAMERA_MOTION_OPTIONS: CameraMotion[] = [
  "static",
  "focus_shift",
  "dolly_in",
  "dolly_out",
  "dolly_left",
  "dolly_right",
  "jib_up",
  "jib_down",
];

const DEFAULT_PROMPT =
  "A cinematic futuristic aerial view of a vast megacity at sunset, fully original, no recognizable landmarks, towering glass skyscrapers, glowing traffic streams, reflective rooftops, warm amber and rose-gold sky, subtle teal and violet reflections, premium tech-brand aesthetic, smooth elegant motion, clean composition, no text, no watermark.";

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        resolve(result);
      } else {
        reject(new Error("Could not read the image file."));
      }
    };

    reader.onerror = () => {
      reject(new Error("Failed to read the image file."));
    };

    reader.readAsDataURL(file);
  });
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("image-to-video");
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [model, setModel] = useState("ltx-2-3-pro");
  const [resolution, setResolution] = useState("1920x1080");
  const [duration, setDuration] = useState(6);
  const [fps, setFps] = useState(24);
  const [cameraMotion, setCameraMotion] =
    useState<CameraMotion>("focus_shift");
  const [generateAudio, setGenerateAudio] = useState(false);

  const [imageFile, setImageFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>("Idle");
  const [error, setError] = useState<string>("");
  const [requestId, setRequestId] = useState<string>("");
  const [upstreamStatus, setUpstreamStatus] = useState<string>("");
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [videoSize, setVideoSize] = useState<number>(0);
  const [logs, setLogs] = useState<string[]>([
    "Ready. Choose a mode and press Generate.",
  ]);

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  const heroHint = useMemo(() => {
    if (mode === "image-to-video") {
      return "Best for smooth website hero motion. Upload a clean still image first, then animate it.";
    }

    return "Use this when you want LTX to generate the scene from text only.";
  }, [mode]);

  function pushLog(message: string) {
    setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()} — ${message}`]);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setStatus("Preparing request...");
    setRequestId("");
    setUpstreamStatus("");
    setLogs(["Starting generation..."]);

    try {
      let imageUri: string | undefined;

      if (mode === "image-to-video") {
        if (!imageFile) {
          throw new Error("Please upload an image for image-to-video mode.");
        }

        if (imageFile.size > 5 * 1024 * 1024) {
          throw new Error(
            "Your image is too large for a safe Colab/browser upload. Keep it below 5 MB."
          );
        }

        setStatus("Reading image...");
        pushLog(`Image selected: ${imageFile.name} (${formatBytes(imageFile.size)})`);
        imageUri = await fileToDataUrl(imageFile);
        pushLog("Image converted to data URI.");
      }

      const payload = {
        mode,
        prompt,
        image_uri: imageUri,
        model,
        duration,
        resolution,
        fps,
        camera_motion: cameraMotion,
        generate_audio: generateAudio,
      };

      pushLog(`Sending request to /api/generate with model ${model}`);
      setStatus("Generating video...");

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const ltxRequestId = res.headers.get("x-ltx-request-id") || "";
      const ltxUpstreamStatus = res.headers.get("x-ltx-upstream-status") || "";

      if (ltxRequestId) setRequestId(ltxRequestId);
      if (ltxUpstreamStatus) setUpstreamStatus(ltxUpstreamStatus);

      if (!res.ok) {
        const contentType = res.headers.get("content-type") || "";
        let errorMessage = "Request failed.";

        if (contentType.includes("application/json")) {
          const data = await res.json();
          errorMessage =
            data?.error ||
            data?.upstreamError ||
            "The server returned an error.";
        } else {
          errorMessage = await res.text();
        }

        throw new Error(
          `${errorMessage} (HTTP ${res.status}${ltxRequestId ? `, request ${ltxRequestId}` : ""})`
        );
      }

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);

      if (videoUrl) URL.revokeObjectURL(videoUrl);

      setVideoUrl(objectUrl);
      setVideoSize(blob.size);
      setStatus("Video ready");
      pushLog(`Video received: ${formatBytes(blob.size)}`);
      pushLog("Preview object URL created successfully.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      setStatus("Failed");
      pushLog(`Error: ${message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-3">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 shadow-lg shadow-cyan-950/10 backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-cyan-400" />
            LTX motion banner studio
          </div>

          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Generate cinematic motion design videos for your hero banner.
          </h1>

          <p className="max-w-3xl text-base leading-7 text-slate-300">
            Use the API through a secure Next.js route, keep the key on the
            server, and preview the result right inside your app.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-3xl border border-white/10 bg-white/6 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl">
            <div className="mb-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setMode("image-to-video")}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  mode === "image-to-video"
                    ? "bg-cyan-400 text-slate-950"
                    : "bg-white/5 text-slate-300 hover:bg-white/10"
                }`}
              >
                Image → video
              </button>
              <button
                type="button"
                onClick={() => setMode("text-to-video")}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  mode === "text-to-video"
                    ? "bg-cyan-400 text-slate-950"
                    : "bg-white/5 text-slate-300 hover:bg-white/10"
                }`}
              >
                Text → video
              </button>
            </div>

            <div className="mb-6 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4">
              <p className="text-sm text-cyan-100">{heroHint}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-200">
                  Prompt
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={7}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20"
                  placeholder="Describe your scene..."
                />
              </div>

              {mode === "image-to-video" && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-200">
                    Reference image
                  </label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                    className="block w-full cursor-pointer rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-300 file:mr-4 file:rounded-full file:border-0 file:bg-cyan-400 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-950 hover:file:bg-cyan-300"
                  />
                  <p className="mt-2 text-xs text-slate-400">
                    Keep it clean and close to the final banner composition.
                  </p>
                  {imageFile && (
                    <p className="mt-2 text-xs text-cyan-200">
                      Selected: {imageFile.name} ({formatBytes(imageFile.size)})
                    </p>
                  )}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-200">
                    Model
                  </label>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20"
                  >
                    {MODEL_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-200">
                    Resolution
                  </label>
                  <select
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20"
                  >
                    {RESOLUTION_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-200">
                    Duration (seconds)
                  </label>
                  <input
                    type="number"
                    min={3}
                    max={20}
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-200">
                    FPS
                  </label>
                  <input
                    type="number"
                    min={12}
                    max={30}
                    value={fps}
                    onChange={(e) => setFps(Number(e.target.value))}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-200">
                    Camera motion
                  </label>
                  <select
                    value={cameraMotion}
                    onChange={(e) => setCameraMotion(e.target.value as CameraMotion)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20"
                  >
                    {CAMERA_MOTION_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3">
                  <input
                    id="generateAudio"
                    type="checkbox"
                    checked={generateAudio}
                    onChange={(e) => setGenerateAudio(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-cyan-400 focus:ring-cyan-400"
                  />
                  <label htmlFor="generateAudio" className="text-sm text-slate-200">
                    Generate audio
                  </label>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-full bg-cyan-400 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Generating..." : "Generate video"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPrompt(DEFAULT_PROMPT);
                    setMode("image-to-video");
                    setModel("ltx-2-3-pro");
                    setResolution("1920x1080");
                    setDuration(6);
                    setFps(24);
                    setCameraMotion("focus_shift");
                    setGenerateAudio(false);
                    setError("");
                    setStatus("Idle");
                    setLogs(["Reset to defaults."]);
                    pushLog("Defaults restored.");
                  }}
                  className="rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
                >
                  Reset
                </button>
              </div>
            </form>

            <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-slate-200">Debug log</h2>
                <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300">
                  {status}
                </span>
              </div>

              <div className="max-h-56 overflow-auto rounded-xl bg-black/20 p-3 font-mono text-xs leading-6 text-slate-300">
                {logs.map((line, index) => (
                  <div key={`${line}-${index}`}>{line}</div>
                ))}
              </div>

              {(requestId || upstreamStatus) && (
                <div className="mt-4 grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
                  {requestId && (
                    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                      LTX request id: <span className="text-cyan-200">{requestId}</span>
                    </div>
                  )}
                  {upstreamStatus && (
                    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                      Upstream status:{" "}
                      <span className="text-cyan-200">{upstreamStatus}</span>
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  {error}
                </div>
              )}
            </div>
          </section>

          <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-950/60 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl">
            <div className="mb-6 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Preview</h2>
                <p className="mt-1 text-sm text-slate-400">
                  The returned MP4 appears here after generation.
                </p>
              </div>
              {videoUrl && (
                <a
                  href={videoUrl}
                  download="ltx-banner.mp4"
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10"
                >
                  Download
                </a>
              )}
            </div>

            <div className="relative min-h-[520px] overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-500/10 via-slate-950 to-fuchsia-500/10">
              {!videoUrl ? (
                <div className="flex min-h-[520px] items-center justify-center p-8 text-center">
                  <div className="max-w-md">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5 text-2xl">
                      ✦
                    </div>
                    <h3 className="text-xl font-semibold">
                      Your video preview will appear here
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-slate-400">
                      Use a calm camera motion first. For a website banner,
                      subtle movement usually looks much better than strong side
                      drift.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4">
                  <video
                    className="h-[520px] w-full rounded-2xl object-cover"
                    src={videoUrl}
                    controls
                    autoPlay
                    muted
                    loop
                    playsInline
                  />
                  <div className="mt-4 grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
                    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                      Size received: <span className="text-cyan-200">{formatBytes(videoSize)}</span>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                      Output: <span className="text-cyan-200">MP4</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
              <p className="font-medium text-slate-100">Good first test settings</p>
              <p className="mt-2 leading-6">
                For debugging, start with <span className="text-cyan-200">ltx-2-3-fast</span>,
                duration <span className="text-cyan-200">4–6s</span>, resolution{" "}
                <span className="text-cyan-200">1920x1080</span>, and
                camera motion <span className="text-cyan-200">focus_shift</span> or{" "}
                <span className="text-cyan-200">static</span>.
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}