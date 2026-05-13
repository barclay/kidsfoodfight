const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';

export type TokenResponse = {
  access_token: string;
  token_type: string;
};

function parseErrorDetail(raw: unknown): string {
  if (typeof raw !== 'object' || raw === null || !('detail' in raw)) {
    return 'Something went wrong. Try again.';
  }
  const detail = (raw as { detail: unknown }).detail;
  if (typeof detail === 'string') {
    return detail;
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

  const response = await fetch(`${API_BASE_URL}/auth/login`, {
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
