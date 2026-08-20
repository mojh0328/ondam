/**
 * apiFetch — a thin wrapper around the native fetch() that prepends
 * VITE_API_BASE_URL to bare-path requests (starting with "/").
 *
 * In the web build VITE_API_BASE_URL is empty, so behaviour is identical
 * to a plain fetch() call.  In a Capacitor/mobile build it is set to the
 * deployed API origin (e.g. "https://my-app.repl.co"), allowing the
 * WebView to reach the remote API from its local capacitor:// origin.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export function apiFetch(
  input: string,
  init?: RequestInit,
): Promise<Response> {
  const url = input.startsWith("/") ? `${API_BASE}${input}` : input;
  return fetch(url, init);
}
