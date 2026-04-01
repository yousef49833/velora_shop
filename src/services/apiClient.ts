const API_BASE = 'http://localhost:3100/api';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
  user?: T;
  token?: string;
  requiresOtp?: boolean;
  devOtp?: string;
  message?: string;
};

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem('token');
  const headers = new Headers(init?.headers);

  if (!headers.has('Content-Type') && init?.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  console.log(`API Request: ${init?.method || 'GET'} ${API_BASE}${path}`, { hasToken: !!token, body: init?.body });

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
    });
  } catch (fetchError) {
    console.error(`API Connection Error: ${init?.method || 'GET'} ${API_BASE}${path}`, fetchError);
    throw new ApiError(
      `Cannot connect to server at ${API_BASE}. Make sure the backend is running.`,
      0
    );
  }

  console.log(`API Response: ${response.status} ${response.statusText}`);

  const payload = (await response.json().catch(() => {
    console.error('Failed to parse JSON response');
    return {};
  })) as ApiEnvelope<T>;

  if (!response.ok) {
    console.error('API Error:', payload);
    throw new ApiError(payload.message || 'Request failed', response.status);
  }

  console.log('API Success:', payload);

  // Store token if present in response (for login/register/verify-otp)
  if (payload.token !== undefined) {
    localStorage.setItem('token', payload.token);
  }

  // For auth responses that have both user and token, return the full payload
  // This ensures the token is passed to the caller (e.g., nodeAuthService)
  if (payload.user !== undefined && payload.token !== undefined) {
    return payload as T;
  }

  if (payload.data !== undefined) {
    return payload.data;
  }

  if (payload.user !== undefined) {
    return payload.user;
  }

  return payload as T;
}
