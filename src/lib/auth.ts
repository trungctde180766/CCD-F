import type {
  AdminLearnerReport,
  AppProgressState,
  AuthUser,
} from '../types';
import {
  applyBackupImport,
  exportBackupPayload,
  sanitizeProgressState,
} from './storage';

const AUTH_TOKEN_KEY = 'ccdv_f_auth_token_v1';
const AUTH_USER_KEY = 'ccdv_f_auth_user_v1';

export interface StoredAuthSession {
  token: string;
  user: AuthUser;
}

export function loadStoredAuthSession(): StoredAuthSession | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const token = window.localStorage.getItem(AUTH_TOKEN_KEY);
    const rawUser = window.localStorage.getItem(AUTH_USER_KEY);
    if (!token || !rawUser) return null;
    const user = JSON.parse(rawUser) as AuthUser;
    if (!user || typeof user.username !== 'string') return null;
    return { token, user };
  } catch {
    return null;
  }
}

export function saveStoredAuthSession(session: StoredAuthSession | null): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (!session) {
      window.localStorage.removeItem(AUTH_TOKEN_KEY);
      window.localStorage.removeItem(AUTH_USER_KEY);
    } else {
      window.localStorage.setItem(AUTH_TOKEN_KEY, session.token);
      window.localStorage.setItem(AUTH_USER_KEY, JSON.stringify(session.user));
    }
  } catch {
    // ignore storage errors
  }
}

/**
 * Merges a user's local progress and server progress so no attempts/exams are ever lost
 * across devices while remaining strictly isolated per user account.
 */
export function reconcileUserProgress(
  localUserState: AppProgressState,
  serverRawProgress: unknown
): AppProgressState {
  if (!serverRawProgress || typeof serverRawProgress !== 'object') {
    return localUserState;
  }
  const serverState = sanitizeProgressState(serverRawProgress);
  const serverBackup = exportBackupPayload(serverState);
  return applyBackupImport(localUserState, serverBackup, 'merge');
}

export interface AuthApiResponse {
  ok: boolean;
  error?: string;
  token?: string;
  user?: AuthUser;
  progress?: unknown;
  dbConnected?: boolean;
  dbError?: string | null;
}

export async function apiLogin(username: string, password: string): Promise<AuthApiResponse> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return (await res.json()) as AuthApiResponse;
}

export async function apiRegister(params: {
  username: string;
  displayName: string;
  password: string;
  initialProgress?: AppProgressState;
}): Promise<AuthApiResponse> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return (await res.json()) as AuthApiResponse;
}

export async function apiFetchMe(token: string): Promise<AuthApiResponse> {
  const res = await fetch('/api/auth/me', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return (await res.json()) as AuthApiResponse;
}

export async function apiSyncProgress(
  token: string,
  progress: AppProgressState
): Promise<{ ok: boolean; updatedAt?: string; dbConnected?: boolean; error?: string }> {
  const res = await fetch('/api/progress', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ progress }),
  });
  return await res.json();
}

export interface AdminOverviewResponse {
  ok: boolean;
  error?: string;
  dbConnected: boolean;
  dbCluster: string;
  dbName: string;
  dbError: string | null;
  users: AdminLearnerReport[];
}

export async function apiFetchAdminOverview(token: string): Promise<AdminOverviewResponse> {
  const res = await fetch('/api/admin/overview', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return (await res.json()) as AdminOverviewResponse;
}

export async function apiAdminManageUser(
  token: string,
  payload: {
    action: 'create_user' | 'reset_password' | 'delete_user' | 'reset_progress';
    username: string;
    displayName?: string;
    password?: string;
    newPassword?: string;
    role?: 'admin' | 'user';
  }
): Promise<{ ok: boolean; message?: string; error?: string }> {
  const res = await fetch('/api/admin/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  return await res.json();
}
