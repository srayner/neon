// Server-only: reads NTFY_TOKEN. Never import this from a client component.

const SEND_TIMEOUT_MS = 10_000;

interface NtfyConfig {
  url: string;
  topic: string;
  token: string;
}

function readEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

/** What the browser may see: no token, only whether one is set. */
export function getNtfyPublicSettings() {
  const url = readEnv("NTFY_URL");
  const topic = readEnv("NTFY_TOPIC");
  const tokenSet = readEnv("NTFY_TOKEN") !== null;
  return {
    url,
    topic,
    tokenSet,
    configured: url !== null && topic !== null && tokenSet,
  };
}

function getNtfyConfig(): NtfyConfig | null {
  const url = readEnv("NTFY_URL");
  const topic = readEnv("NTFY_TOPIC");
  const token = readEnv("NTFY_TOKEN");
  if (!url || !topic || !token) return null;
  return { url: url.replace(/\/+$/, ""), topic, token };
}

export type SendResult = { ok: true } | { ok: false; error: string };

export async function sendNtfyAlert(
  title: string,
  message: string
): Promise<SendResult> {
  const config = getNtfyConfig();
  if (!config) {
    return { ok: false, error: "ntfy is not configured." };
  }

  const target = `${config.url}/${encodeURIComponent(config.topic)}`;

  let res: Response;
  try {
    res = await fetch(target, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        Title: title,
      },
      body: message,
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      return {
        ok: false,
        error: `The ntfy server at ${config.url} did not respond within ${SEND_TIMEOUT_MS / 1000} seconds.`,
      };
    }
    const cause =
      err instanceof Error && err.cause instanceof Error
        ? err.cause.message
        : err instanceof Error
          ? err.message
          : String(err);
    return {
      ok: false,
      error: `Could not reach the ntfy server at ${config.url} (${cause}).`,
    };
  }

  if (res.ok) return { ok: true };

  if (res.status === 401 || res.status === 403) {
    return {
      ok: false,
      error: `ntfy rejected the access token (HTTP ${res.status}). Check NTFY_TOKEN and that the token's user may write to topic "${config.topic}".`,
    };
  }

  // ntfy errors are JSON like {"code":40401,"http":404,"error":"..."}
  const body = await res.text().catch(() => "");
  let detail = body.trim().slice(0, 200);
  try {
    const parsed = JSON.parse(body);
    if (typeof parsed?.error === "string") detail = parsed.error;
  } catch {
    // not JSON (e.g. a proxy error page); keep the trimmed text
  }
  return {
    ok: false,
    error: `ntfy returned HTTP ${res.status}${detail ? `: ${detail}` : ""}.`,
  };
}
