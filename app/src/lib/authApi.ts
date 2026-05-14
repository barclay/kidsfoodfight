import { getApiBaseUrl } from './apiBaseUrl';

export type TokenResponse = {
  access_token: string;
  token_type: string;
};

export type RegisterPayload = {
  email: string;
  password: string;
  display_name: string;
  timezone: string;
  team_name?: string;
  invite_code?: string;
};

function parseErrorDetail(raw: unknown): string {
  if (typeof raw !== 'object' || raw === null || !('detail' in raw)) {
    return 'Something went wrong. Try again.';
  }
  const detail = (raw as { detail: unknown }).detail;
  if (typeof detail === 'string') {
    if (detail === 'REGISTER_USER_ALREADY_EXISTS') {
      return 'An account with this email already exists.';
    }
    return detail;
  }
  if (typeof detail === 'object' && detail !== null) {
    const o = detail as { code?: unknown; reason?: unknown };
    if (typeof o.reason === 'string') {
      return o.reason;
    }
  }
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === 'object' && item !== null && 'msg' in item) {
          return String((item as { msg: unknown }).msg);
        }
        return JSON.stringify(item);
      })
      .join(' ');
  }
  return 'Something went wrong. Try again.';
}

/**
 * fastapi-users JWT login: OAuth2 password flow; `username` must be the account email.
 */
export async function loginWithEmailPassword(
  email: string,
  password: string,
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    username: email.trim(),
    password,
  });

  const response = await fetch(`${getApiBaseUrl()}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  const json: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(parseErrorDetail(json));
  }

  if (
    typeof json !== 'object' ||
    json === null ||
    typeof (json as TokenResponse).access_token !== 'string'
  ) {
    throw new Error('Unexpected response from server.');
  }

  return json as TokenResponse;
}

/**
 * ``POST /auth/register`` (JSON body). Caller should sign in afterward to obtain a JWT.
 */
export async function registerUser(payload: RegisterPayload): Promise<void> {
  const body: Record<string, string> = {
    email: payload.email.trim(),
    password: payload.password,
    display_name: payload.display_name.trim(),
    timezone: payload.timezone,
  };
  if (payload.invite_code !== undefined && payload.invite_code.trim() !== '') {
    body.invite_code = payload.invite_code.trim();
  }
  if (payload.team_name !== undefined && payload.team_name.trim() !== '') {
    body.team_name = payload.team_name.trim();
  }

  const response = await fetch(`${getApiBaseUrl()}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const json: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(parseErrorDetail(json));
  }
}
