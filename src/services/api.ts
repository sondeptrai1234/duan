import { getApiUrl } from "../config";

export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const baseUrl = getApiUrl();
  let response: Response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 65000);
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers || {}),
      },
    });
  } catch (error: any) {
    const reason =
      error?.name === "AbortError"
        ? "Máy chủ phản hồi quá lâu. Thử lại sau."
        : `Không kết nối được máy chủ ${baseUrl}. Kiểm tra IP, Wi-Fi và backend.`;
    throw new ApiError(reason);
  } finally {
    clearTimeout(timeout);
  }
  const raw = await response.text();
  let payload: any = null;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    payload = { message: raw };
  }
  if (!response.ok)
    throw new ApiError(
      payload?.error || payload?.message || `Yêu cầu thất bại (${response.status})`,
      response.status
    );
  return payload as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  checkHealth: async (targetUrl?: string): Promise<{ ok: boolean; pingMs: number; data?: any; error?: string }> => {
    const url = (targetUrl || getApiUrl()).replace(/\/$/, "");
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${url}/api/health`, { signal: controller.signal });
      clearTimeout(timeout);
      const pingMs = Date.now() - start;
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, pingMs, data };
    } catch (err: any) {
      return {
        ok: false,
        pingMs: Date.now() - start,
        error: err.name === "AbortError" ? "Hết thời gian chờ (Timeout > 5s)" : (err.message || "Không thể kết nối"),
      };
    }
  },
};
