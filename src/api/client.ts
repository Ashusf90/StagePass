export class ApiClientError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, status: number, code = 'API_ERROR', details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const ACCESS_KEY = 'stagepass_access_token';
const REFRESH_KEY = 'stagepass_refresh_token';

export function getStoredTokens() {
  return {
    accessToken: localStorage.getItem(ACCESS_KEY),
    refreshToken: localStorage.getItem(REFRESH_KEY),
  };
}

export function setStoredTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearStoredTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

let refreshPromise: Promise<string | null> | null = null;

async function attemptTokenRefresh(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const { refreshToken } = getStoredTokens();
    if (!refreshToken) return null;

    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        clearStoredTokens();
        return null;
      }
      const data = await res.json();
      setStoredTokens(data.accessToken, data.refreshToken);
      return data.accessToken as string;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { auth?: boolean; skipRefresh?: boolean } = {}
): Promise<T> {
  const { auth = true, skipRefresh = false, headers = {}, ...rest } = options;
  const reqHeaders = new Headers(headers);

  if (!reqHeaders.has('Content-Type') && rest.body) {
    reqHeaders.set('Content-Type', 'application/json');
  }

  if (auth) {
    const { accessToken } = getStoredTokens();
    if (accessToken) {
      reqHeaders.set('Authorization', `Bearer ${accessToken}`);
    }
  }

  let response = await fetch(path, {
    ...rest,
    headers: reqHeaders,
  });

  if (response.status === 401 && auth && !skipRefresh) {
    const freshToken = await attemptTokenRefresh();
    if (freshToken) {
      reqHeaders.set('Authorization', `Bearer ${freshToken}`);
      response = await fetch(path, {
        ...rest,
        headers: reqHeaders,
      });
    }
  }

  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json')
    ? await response.json()
    : null;

  if (!response.ok) {
    const errObj = body?.error;
    throw new ApiClientError(
      errObj?.message || `Request failed (${response.status})`,
      response.status,
      errObj?.code || 'REQUEST_FAILED',
      errObj?.details
    );
  }

  return body as T;
}
