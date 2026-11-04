import { API_URL } from "../config";
export class ApiError extends Error { status?: number; constructor(message: string, status?: number) { super(message); this.name = "ApiError"; this.status = status; } }
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, headers: { Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}), ...(init.headers || {}) } });
  } catch { throw new ApiError(`Không kết nối được máy chủ ${API_URL}. Kiểm tra IP, Wi-Fi và backend.`); }
  const raw = await response.text(); let payload: any = null;
  try { payload = raw ? JSON.parse(raw) : null; } catch { payload = { message: raw }; }
  if (!response.ok) throw new ApiError(payload?.error || payload?.message || `Yêu cầu thất bại (${response.status})`, response.status);
  return payload as T;
}
export const api = {
  get: <T,>(path: string) => request<T>(path),
  post: <T,>(path: string, body: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body) }),
};
