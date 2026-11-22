import type { IncomingMessage, ServerResponse } from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { MongoClient, type Db } from 'mongodb';

/**
 * Loads local .env file into process.env if variables are not already populated
 * (e.g. during local dev or tests). No credentials are hardcoded in source code.
 */
function ensureEnvLoaded(): void {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (!fs.existsSync(envPath)) return;
    const content = fs.readFileSync(envPath, 'utf8');
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eqIdx = line.indexOf('=');
      if (eqIdx <= 0) continue;
      const key = line.slice(0, eqIdx).trim();
      let val = line.slice(eqIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  } catch {
    // ignore fs read errors in serverless environments where process.env is injected directly
  }
}

ensureEnvLoaded();

function getEnvConfig() {
  ensureEnvLoaded();
  return {
    mongodbUri: process.env.MONGODB_URI || '',
    dbName: process.env.MONGODB_DB_NAME || 'ccdv_f_study',
    jwtSecret: process.env.JWT_SECRET || 'ccdv-f-default-jwt-secret-change-in-env',
    adminUsername: (process.env.ADMIN_USERNAME || 'trung').trim().toLowerCase(),
    adminPassword: process.env.ADMIN_PASSWORD || '',
    adminDisplayName: process.env.ADMIN_DISPLAY_NAME || 'Thanh Trung (Admin)',
  };
}

export interface UserTelemetryInfo {
  ipAddress: string;
  location: string;
  userAgent: string;
  os: string;
  browser: string;
  deviceType: 'Desktop' | 'Mobile' | 'Tablet';
  screenResolution?: string;
  viewport?: string;
  language?: string;
  timezone?: string;
  cpuCores?: number | null;
  deviceMemoryGb?: number | null;
  currentTab?: string;
  activityStatus?: string;
  currentQuestionId?: string | null;
  liveExamState?: {
    mode: string;
    title: string;
    currentQuestionIndex: number;
    totalQuestions: number;
    answeredCount: number;
    remainingSeconds: number | null;
    startedAt: string;
  } | null;
  lastSeenAt: string;
}

export interface UserDocument {
  username: string;
  displayName: string;
  passwordHash: string;
  role: 'admin' | 'user';
  createdAt: string;
  lastLoginAt: string;
  telemetry?: UserTelemetryInfo;
  ipHistory?: Array<{ ip: string; device: string; seenAt: string }>;
}

export interface UserProgressDocument {
  username: string;
  progress: Record<string, unknown>;
  updatedAt: string;
}

interface GlobalStore {
  __ccdvMongoClient?: MongoClient | null;
  __ccdvMongoDb?: Db | null;
  __ccdvLastDbError?: string | null;
  __ccdvMemoryUsers?: Map<string, UserDocument>;
  __ccdvMemoryProgress?: Map<string, UserProgressDocument>;
}

const g = globalThis as unknown as GlobalStore;
if (!g.__ccdvMemoryUsers) g.__ccdvMemoryUsers = new Map();
if (!g.__ccdvMemoryProgress) g.__ccdvMemoryProgress = new Map();

export function hashPassword(password: string, salt?: string): string {
  const s = salt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, s, 64).toString('hex');
  return `${s}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, key] = (storedHash || '').split(':');
  if (!salt || !key) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(key, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

export interface TokenPayload {
  username: string;
  displayName: string;
  role: 'admin' | 'user';
  exp: number;
}

export function signToken(payload: Omit<TokenPayload, 'exp'>): string {
  const { jwtSecret } = getEnvConfig();
  const fullPayload: TokenPayload = {
    ...payload,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
  };
  const data = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const sig = crypto.createHmac('sha256', jwtSecret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifyToken(token: string | undefined | null): TokenPayload | null {
  if (!token) return null;
  const { jwtSecret } = getEnvConfig();
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', jwtSecret).update(data).digest('base64url');
  if (sig !== expectedSig) return null;
  try {
    const parsed = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as TokenPayload;
    if (!parsed.exp || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function parseUserAgentInfo(uaRaw: string): {
  os: string;
  browser: string;
  deviceType: 'Desktop' | 'Mobile' | 'Tablet';
} {
  const ua = uaRaw || '';
  let os = 'Unknown OS';
  if (/Windows NT 10\.0/i.test(ua)) os = 'Windows 10/11';
  else if (/Windows NT/i.test(ua)) os = 'Windows';
  else if (/Android/i.test(ua)) {
    const m = ua.match(/Android\s+([0-9.]+)/i);
    os = m ? `Android ${m[1]}` : 'Android';
  } else if (/iPhone|iPad|iPod/i.test(ua)) {
    os = 'iOS / iPadOS';
  } else if (/Mac OS X/i.test(ua)) {
    os = 'macOS';
  } else if (/Linux/i.test(ua)) {
    os = 'Linux';
  }

  let browser = 'Browser';
  if (/Edg\/([0-9.]+)/i.test(ua)) {
    browser = `Edge ${ua.match(/Edg\/([0-9.]+)/i)?.[1]?.split('.')[0] || ''}`.trim();
  } else if (/OPR\/([0-9.]+)/i.test(ua)) {
    browser = `Opera ${ua.match(/OPR\/([0-9.]+)/i)?.[1]?.split('.')[0] || ''}`.trim();
  } else if (/Chrome\/([0-9.]+)/i.test(ua)) {
    browser = `Chrome ${ua.match(/Chrome\/([0-9.]+)/i)?.[1]?.split('.')[0] || ''}`.trim();
  } else if (/Firefox\/([0-9.]+)/i.test(ua)) {
    browser = `Firefox ${ua.match(/Firefox\/([0-9.]+)/i)?.[1]?.split('.')[0] || ''}`.trim();
  } else if (/Version\/([0-9.]+).*Safari/i.test(ua)) {
    browser = `Safari ${ua.match(/Version\/([0-9.]+)/i)?.[1]?.split('.')[0] || ''}`.trim();
  }

  let deviceType: 'Desktop' | 'Mobile' | 'Tablet' = 'Desktop';
  if (/iPad|Tablet/i.test(ua)) deviceType = 'Tablet';
  else if (/Mobile|iPhone|Android/i.test(ua)) deviceType = 'Mobile';

  return { os, browser, deviceType };
}

export function extractRequestNetworkInfo(req: IncomingMessage): {
  ipAddress: string;
  location: string;
  userAgent: string;
  os: string;
  browser: string;
  deviceType: 'Desktop' | 'Mobile' | 'Tablet';
} {
  const forwarded = req.headers['x-forwarded-for'];
  const realIp = req.headers['x-real-ip'];
  const cfIp = req.headers['cf-connecting-ip'];

  let rawIp = '';
  if (typeof forwarded === 'string' && forwarded.trim()) {
    rawIp = forwarded.split(',')[0].trim();
  } else if (Array.isArray(forwarded) && forwarded.length > 0) {
    rawIp = forwarded[0].split(',')[0].trim();
  } else if (typeof cfIp === 'string' && cfIp.trim()) {
    rawIp = cfIp.trim();
  } else if (typeof realIp === 'string' && realIp.trim()) {
    rawIp = realIp.trim();
  } else {
    rawIp = req.socket?.remoteAddress || '127.0.0.1';
  }

  if (rawIp === '::1' || rawIp === '::ffff:127.0.0.1') {
    rawIp = '127.0.0.1 (Local)';
  } else if (rawIp.startsWith('::ffff:')) {
    rawIp = rawIp.slice(7);
  }

  const city = req.headers['x-vercel-ip-city']
    ? decodeURIComponent(String(req.headers['x-vercel-ip-city']))
    : '';
  const country = req.headers['x-vercel-ip-country']
    ? String(req.headers['x-vercel-ip-country'])
    : '';
  const location =
    city && country
      ? `${city}, ${country}`
      : country
      ? country
      : rawIp.includes('127.0.0.1')
      ? 'Máy cục bộ (Localhost)'
      : 'Trực tuyến';

  const userAgent = String(req.headers['user-agent'] || '');
  const { os, browser, deviceType } = parseUserAgentInfo(userAgent);

  return {
    ipAddress: rawIp,
    location,
    userAgent,
    os,
    browser,
    deviceType,
  };
}

function ensureMemoryAdminSeeded() {
  const { adminUsername, adminPassword, adminDisplayName } = getEnvConfig();
  if (!adminUsername || !adminPassword) return;
  const memUsers = g.__ccdvMemoryUsers!;
  if (!memUsers.has(adminUsername)) {
    const now = new Date().toISOString();
    memUsers.set(adminUsername, {
      username: adminUsername,
      displayName: adminDisplayName,
      passwordHash: hashPassword(adminPassword),
      role: 'admin',
      createdAt: now,
      lastLoginAt: now,
    });
  }
}

async function getDatabase(): Promise<{
  db: Db | null;
  dbConnected: boolean;
  dbError: string | null;
  dbCluster: string;
}> {
  ensureMemoryAdminSeeded();
  const { mongodbUri, dbName, adminUsername, adminPassword, adminDisplayName } = getEnvConfig();

  const clusterMatch = mongodbUri.match(/@([^/?]+)/);
  const dbCluster = clusterMatch ? clusterMatch[1] : 'MongoDB Atlas';

  if (!mongodbUri) {
    return {
      db: null,
      dbConnected: false,
      dbError: 'Chưa cấu hình biến môi trường MONGODB_URI trong .env hoặc Vercel Environment Variables.',
      dbCluster,
    };
  }

  try {
    if (g.__ccdvMongoDb && g.__ccdvMongoClient) {
      return { db: g.__ccdvMongoDb, dbConnected: true, dbError: null, dbCluster };
    }
    const client = new MongoClient(mongodbUri, {
      serverSelectionTimeoutMS: 6000,
      connectTimeoutMS: 6000,
    });
    await client.connect();
    const db = client.db(dbName);

    const usersCol = db.collection<UserDocument>('users');
    await usersCol.createIndex({ username: 1 }, { unique: true });
    await db.collection<UserProgressDocument>('user_progress').createIndex({ username: 1 }, { unique: true });

    if (adminUsername && adminPassword) {
      const existingAdmin = await usersCol.findOne({ username: adminUsername });
      const now = new Date().toISOString();
      if (!existingAdmin) {
        await usersCol.insertOne({
          username: adminUsername,
          displayName: adminDisplayName,
          passwordHash: hashPassword(adminPassword),
          role: 'admin',
          createdAt: now,
          lastLoginAt: now,
        });
      } else if (
        existingAdmin.role !== 'admin' ||
        !verifyPassword(adminPassword, existingAdmin.passwordHash)
      ) {
        await usersCol.updateOne(
          { username: adminUsername },
          {
            $set: {
              role: 'admin',
              passwordHash: hashPassword(adminPassword),
              displayName: existingAdmin.displayName || adminDisplayName,
            },
          }
        );
      }
    }

    g.__ccdvMongoClient = client;
    g.__ccdvMongoDb = db;
    g.__ccdvLastDbError = null;
    return { db, dbConnected: true, dbError: null, dbCluster };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Không thể kết nối MongoDB Atlas';
    g.__ccdvLastDbError = msg;
    g.__ccdvMongoClient = null;
    g.__ccdvMongoDb = null;
    return { db: null, dbConnected: false, dbError: msg, dbCluster };
  }
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const maybeReq = req as IncomingMessage & { body?: unknown };
  if (maybeReq.body && typeof maybeReq.body === 'object') {
    return maybeReq.body as Record<string, unknown>;
  }
  if (typeof maybeReq.body === 'string' && maybeReq.body.trim()) {
    try {
      return JSON.parse(maybeReq.body);
    } catch {
      return {};
    }
  }

  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

function sendJson(res: ServerResponse, statusCode: number, data: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

function getBearerToken(req: IncomingMessage): string | null {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) {
    return auth.slice(7).trim();
  }
  return null;
}

async function findUser(db: Db | null, username: string): Promise<UserDocument | null> {
  const clean = username.trim().toLowerCase();
  if (db) {
    const doc = await db.collection<UserDocument>('users').findOne({ username: clean });
    if (doc) g.__ccdvMemoryUsers!.set(clean, doc);
    return doc;
  }
  return g.__ccdvMemoryUsers!.get(clean) || null;
}

async function saveUser(db: Db | null, user: UserDocument): Promise<void> {
  const clean = user.username.trim().toLowerCase();
  const normalized = { ...user, username: clean };
  g.__ccdvMemoryUsers!.set(clean, normalized);
  if (db) {
    await db
      .collection<UserDocument>('users')
      .updateOne({ username: clean }, { $set: normalized }, { upsert: true });
  }
}

async function getUserProgress(db: Db | null, username: string): Promise<Record<string, unknown> | null> {
  const clean = username.trim().toLowerCase();
  if (db) {
    const doc = await db.collection<UserProgressDocument>('user_progress').findOne({ username: clean });
    if (doc) {
      g.__ccdvMemoryProgress!.set(clean, doc);
      return doc.progress;
    }
    return null;
  }
  return g.__ccdvMemoryProgress!.get(clean)?.progress || null;
}

async function saveUserProgress(
  db: Db | null,
  username: string,
  progress: Record<string, unknown>
): Promise<string> {
  const clean = username.trim().toLowerCase();
  const updatedAt = new Date().toISOString();
  const doc: UserProgressDocument = {
    username: clean,
    progress: {
      ...progress,
      updatedAt,
    },
    updatedAt,
  };
  g.__ccdvMemoryProgress!.set(clean, doc);
  if (db) {
    await db
      .collection<UserProgressDocument>('user_progress')
      .updateOne({ username: clean }, { $set: doc }, { upsert: true });
  }
  return updatedAt;
}

function buildUpdatedTelemetry(
  req: IncomingMessage,
  existing: UserTelemetryInfo | undefined,
  clientPayload?: Record<string, unknown>
): UserTelemetryInfo {
  const net = extractRequestNetworkInfo(req);
  const now = new Date().toISOString();

  return {
    ipAddress: net.ipAddress,
    location: net.location,
    userAgent: net.userAgent,
    os: net.os,
    browser: net.browser,
    deviceType: net.deviceType,
    screenResolution:
      typeof clientPayload?.screenResolution === 'string'
        ? clientPayload.screenResolution
        : existing?.screenResolution,
    viewport:
      typeof clientPayload?.viewport === 'string' ? clientPayload.viewport : existing?.viewport,
    language:
      typeof clientPayload?.language === 'string' ? clientPayload.language : existing?.language,
    timezone:
      typeof clientPayload?.timezone === 'string' ? clientPayload.timezone : existing?.timezone,
    cpuCores:
      typeof clientPayload?.cpuCores === 'number' ? clientPayload.cpuCores : existing?.cpuCores,
    deviceMemoryGb:
      typeof clientPayload?.deviceMemoryGb === 'number'
        ? clientPayload.deviceMemoryGb
        : existing?.deviceMemoryGb,
    currentTab:
      typeof clientPayload?.currentTab === 'string'
        ? clientPayload.currentTab
        : existing?.currentTab || 'overview',
    activityStatus:
      typeof clientPayload?.activityStatus === 'string'
        ? clientPayload.activityStatus
        : existing?.activityStatus || 'Đang truy cập hệ thống',
    currentQuestionId:
      typeof clientPayload?.currentQuestionId === 'string'
        ? clientPayload.currentQuestionId
        : null,
    liveExamState:
      clientPayload?.liveExamState && typeof clientPayload.liveExamState === 'object'
        ? (clientPayload.liveExamState as UserTelemetryInfo['liveExamState'])
        : null,
    lastSeenAt: now,
  };
}

function appendIpHistory(
  existing: Array<{ ip: string; device: string; seenAt: string }> | undefined,
  telemetry: UserTelemetryInfo
): Array<{ ip: string; device: string; seenAt: string }> {
  const list = Array.isArray(existing) ? [...existing] : [];
  const deviceLabel = `${telemetry.deviceType} • ${telemetry.os} • ${telemetry.browser}`;
  const filtered = list.filter((x) => !(x.ip === telemetry.ipAddress && x.device === deviceLabel));
  filtered.unshift({
    ip: telemetry.ipAddress,
    device: deviceLabel,
    seenAt: telemetry.lastSeenAt,
  });
  return filtered.slice(0, 15);
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const urlObj = new URL(req.url || '/api', 'http://localhost');
  const routeParam = urlObj.searchParams.get('route');
  const rawPathname = routeParam
    ? `/api/${routeParam.replace(/^\/+/, '')}`
    : urlObj.pathname;
  const pathname = rawPathname.replace(/\/+$/, '');
  const method = (req.method || 'GET').toUpperCase();

  if (method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const { adminUsername, adminPassword, adminDisplayName, dbName } = getEnvConfig();
  const { db, dbConnected, dbError, dbCluster } = await getDatabase();

  // 0. GET /api/health (Quick status check for Vercel & MongoDB env setup)
  if (pathname === '/api/health' && method === 'GET') {
    return sendJson(res, 200, {
      ok: true,
      dbConnected,
      dbCluster,
      dbName,
      hasAdminPasswordConfigured: Boolean(adminPassword),
      dbError,
    });
  }

  // 1. POST /api/auth/login
  if (pathname === '/api/auth/login' && method === 'POST') {
    const body = await readJsonBody(req);
    const rawUsername = String(body.username || '').trim().toLowerCase();
    const password = String(body.password || '');
    const clientTelemetry =
      body.telemetry && typeof body.telemetry === 'object'
        ? (body.telemetry as Record<string, unknown>)
        : undefined;

    if (!rawUsername || !password) {
      return sendJson(res, 400, {
        ok: false,
        error: 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.',
      });
    }

    if (rawUsername === adminUsername && !adminPassword && !db) {
      return sendJson(res, 500, {
        ok: false,
        error:
          'Chưa cấu hình biến môi trường ADMIN_PASSWORD và MONGODB_URI trên Vercel. Vui lòng thêm biến môi trường trong Vercel Project Settings -> Environment Variables rồi Redeploy.',
      });
    }

    let user = await findUser(db, rawUsername);

    if (adminUsername && adminPassword && rawUsername === adminUsername && password === adminPassword) {
      const now = new Date().toISOString();
      const telemetry = buildUpdatedTelemetry(req, user?.telemetry, clientTelemetry);
      user = {
        username: adminUsername,
        displayName: user?.displayName || adminDisplayName,
        passwordHash: hashPassword(adminPassword),
        role: 'admin',
        createdAt: user?.createdAt || now,
        lastLoginAt: now,
        telemetry,
        ipHistory: appendIpHistory(user?.ipHistory, telemetry),
      };
      await saveUser(db, user);
    } else {
      if (!user || !verifyPassword(password, user.passwordHash)) {
        return sendJson(res, 401, {
          ok: false,
          error: 'Sai tên đăng nhập hoặc mật khẩu.',
        });
      }
      const now = new Date().toISOString();
      const telemetry = buildUpdatedTelemetry(req, user.telemetry, clientTelemetry);
      user.lastLoginAt = now;
      user.telemetry = telemetry;
      user.ipHistory = appendIpHistory(user.ipHistory, telemetry);
      await saveUser(db, user);
    }

    const progress = await getUserProgress(db, user.username);
    const token = signToken({
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    });

    return sendJson(res, 200, {
      ok: true,
      token,
      user: {
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
      },
      progress,
      dbConnected,
      dbError,
    });
  }

  // 2. POST /api/auth/register
  if (pathname === '/api/auth/register' && method === 'POST') {
    const body = await readJsonBody(req);
    const rawUsername = String(body.username || '').trim().toLowerCase();
    const displayName = String(body.displayName || '').trim() || rawUsername;
    const password = String(body.password || '');
    const clientTelemetry =
      body.telemetry && typeof body.telemetry === 'object'
        ? (body.telemetry as Record<string, unknown>)
        : undefined;
    const initialProgress =
      body.initialProgress && typeof body.initialProgress === 'object'
        ? (body.initialProgress as Record<string, unknown>)
        : null;

    if (!/^[a-z0-9_.-]{3,30}$/.test(rawUsername)) {
      return sendJson(res, 400, {
        ok: false,
        error: 'Tên đăng nhập phải từ 3–30 ký tự (chỉ gồm chữ thường, số, dấu gạch dưới, gạch ngang hoặc dấu chấm).',
      });
    }
    if (adminUsername && rawUsername === adminUsername) {
      return sendJson(res, 400, {
        ok: false,
        error: `Tài khoản "${adminUsername}" đã được cấp riêng cho Admin. Vui lòng chuyển sang tab Đăng nhập.`,
      });
    }
    if (password.length < 4) {
      return sendJson(res, 400, {
        ok: false,
        error: 'Mật khẩu phải có ít nhất 4 ký tự.',
      });
    }

    const existing = await findUser(db, rawUsername);
    if (existing) {
      return sendJson(res, 409, {
        ok: false,
        error: `Tên đăng nhập "${rawUsername}" đã tồn tại. Vui lòng chọn tên khác hoặc đăng nhập.`,
      });
    }

    const now = new Date().toISOString();
    const telemetry = buildUpdatedTelemetry(req, undefined, clientTelemetry);
    const newUser: UserDocument = {
      username: rawUsername,
      displayName,
      passwordHash: hashPassword(password),
      role: 'user',
      createdAt: now,
      lastLoginAt: now,
      telemetry,
      ipHistory: appendIpHistory([], telemetry),
    };

    await saveUser(db, newUser);
    if (initialProgress) {
      await saveUserProgress(db, rawUsername, initialProgress);
    }

    const token = signToken({
      username: newUser.username,
      displayName: newUser.displayName,
      role: newUser.role,
    });

    return sendJson(res, 201, {
      ok: true,
      token,
      user: {
        username: newUser.username,
        displayName: newUser.displayName,
        role: newUser.role,
        createdAt: newUser.createdAt,
        lastLoginAt: newUser.lastLoginAt,
      },
      progress: initialProgress,
      dbConnected,
      dbError,
    });
  }

  // 3. GET /api/auth/me
  if (pathname === '/api/auth/me' && method === 'GET') {
    const tokenPayload = verifyToken(getBearerToken(req));
    if (!tokenPayload) {
      return sendJson(res, 401, { ok: false, error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' });
    }
    const user = await findUser(db, tokenPayload.username);
    if (!user) {
      return sendJson(res, 401, { ok: false, error: 'Không tìm thấy tài khoản.' });
    }
    const telemetry = buildUpdatedTelemetry(req, user.telemetry);
    user.telemetry = telemetry;
    user.ipHistory = appendIpHistory(user.ipHistory, telemetry);
    await saveUser(db, user);

    const progress = await getUserProgress(db, user.username);
    return sendJson(res, 200, {
      ok: true,
      user: {
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
      },
      progress,
      dbConnected,
      dbError,
    });
  }

  // 4. POST /api/telemetry/heartbeat (Real-time user presence, device, IP & live exam status)
  if (pathname === '/api/telemetry/heartbeat' && method === 'POST') {
    const tokenPayload = verifyToken(getBearerToken(req));
    if (!tokenPayload) {
      return sendJson(res, 401, { ok: false, error: 'Chưa đăng nhập.' });
    }
    const user = await findUser(db, tokenPayload.username);
    if (!user) {
      return sendJson(res, 404, { ok: false, error: 'Không tìm thấy user.' });
    }
    const body = await readJsonBody(req);
    const telemetry = buildUpdatedTelemetry(req, user.telemetry, body);
    user.telemetry = telemetry;
    user.ipHistory = appendIpHistory(user.ipHistory, telemetry);
    await saveUser(db, user);

    return sendJson(res, 200, {
      ok: true,
      lastSeenAt: telemetry.lastSeenAt,
      ipAddress: telemetry.ipAddress,
      dbConnected,
    });
  }

  // 5. GET or PUT/POST /api/progress
  if (pathname === '/api/progress') {
    const tokenPayload = verifyToken(getBearerToken(req));
    if (!tokenPayload) {
      return sendJson(res, 401, { ok: false, error: 'Chưa đăng nhập.' });
    }

    if (method === 'GET') {
      const progress = await getUserProgress(db, tokenPayload.username);
      return sendJson(res, 200, {
        ok: true,
        progress,
        dbConnected,
        dbError,
      });
    }

    if (method === 'PUT' || method === 'POST') {
      const body = await readJsonBody(req);
      const progress = body.progress;
      if (!progress || typeof progress !== 'object') {
        return sendJson(res, 400, { ok: false, error: 'Dữ liệu tiến độ không hợp lệ.' });
      }
      const user = await findUser(db, tokenPayload.username);
      if (user) {
        const clientTelemetry =
          body.telemetry && typeof body.telemetry === 'object'
            ? (body.telemetry as Record<string, unknown>)
            : undefined;
        const telemetry = buildUpdatedTelemetry(req, user.telemetry, clientTelemetry);
        user.telemetry = telemetry;
        user.ipHistory = appendIpHistory(user.ipHistory, telemetry);
        await saveUser(db, user);
      }

      const updatedAt = await saveUserProgress(
        db,
        tokenPayload.username,
        progress as Record<string, unknown>
      );
      return sendJson(res, 200, {
        ok: true,
        updatedAt,
        dbConnected,
        dbError,
      });
    }
  }

  // 6. GET /api/admin/overview
  if (pathname === '/api/admin/overview' && method === 'GET') {
    const tokenPayload = verifyToken(getBearerToken(req));
    if (!tokenPayload || tokenPayload.role !== 'admin') {
      return sendJson(res, 403, {
        ok: false,
        error: 'Chỉ tài khoản Admin mới có quyền truy cập trang quản trị.',
      });
    }

    let allUsers: UserDocument[] = [];
    let allProgressDocs: UserProgressDocument[] = [];

    if (db) {
      allUsers = await db.collection<UserDocument>('users').find({}).toArray();
      allProgressDocs = await db.collection<UserProgressDocument>('user_progress').find({}).toArray();
    } else {
      allUsers = Array.from(g.__ccdvMemoryUsers!.values());
      allProgressDocs = Array.from(g.__ccdvMemoryProgress!.values());
    }

    const progressByUser = new Map<string, Record<string, unknown>>();
    for (const doc of allProgressDocs) {
      progressByUser.set(doc.username, doc.progress || {});
    }

    const nowMs = Date.now();

    const usersReport = allUsers.map((u) => {
      const prog = progressByUser.get(u.username) || {};
      const attempts = Array.isArray(prog.attempts) ? prog.attempts : [];
      const viewedQuestions =
        prog.viewedQuestions && typeof prog.viewedQuestions === 'object'
          ? Object.keys(prog.viewedQuestions)
          : [];
      const bookmarks =
        prog.bookmarks && typeof prog.bookmarks === 'object'
          ? Object.keys(prog.bookmarks).filter((k) => (prog.bookmarks as Record<string, boolean>)[k])
          : [];
      const notes =
        prog.notes && typeof prog.notes === 'object'
          ? Object.keys(prog.notes).filter((k) =>
              String((prog.notes as Record<string, string>)[k] || '').trim()
            )
          : [];
      const sessionHistory = Array.isArray(prog.sessionHistory) ? prog.sessionHistory : [];
      const activeSession =
        prog.activeSession && typeof prog.activeSession === 'object' ? prog.activeSession : null;

      const lastSeenIso = u.telemetry?.lastSeenAt || (typeof prog.updatedAt === 'string' ? prog.updatedAt : u.lastLoginAt);
      const diffSeconds = Math.max(0, Math.floor((nowMs - new Date(lastSeenIso).getTime()) / 1000));
      const isOnline = diffSeconds <= 45;
      const isRecentlyActive = diffSeconds <= 300;

      return {
        username: u.username,
        displayName: u.displayName,
        role: u.role,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt,
        updatedAt: lastSeenIso,
        isOnline,
        isRecentlyActive,
        secondsSinceLastSeen: diffSeconds,
        telemetry: u.telemetry || null,
        ipHistory: u.ipHistory || [],
        viewedCount: viewedQuestions.length,
        bookmarksCount: bookmarks.length,
        notesCount: notes.length,
        attempts,
        sessionHistory,
        activeSession,
      };
    });

    return sendJson(res, 200, {
      ok: true,
      dbConnected,
      dbCluster,
      dbName,
      dbError,
      users: usersReport,
    });
  }

  // 7. POST /api/admin/users
  if (pathname === '/api/admin/users' && method === 'POST') {
    const tokenPayload = verifyToken(getBearerToken(req));
    if (!tokenPayload || tokenPayload.role !== 'admin') {
      return sendJson(res, 403, {
        ok: false,
        error: 'Chỉ Admin mới có quyền quản lý người dùng.',
      });
    }

    const body = await readJsonBody(req);
    const action = String(body.action || '');
    const targetUsername = String(body.username || '').trim().toLowerCase();

    if (!targetUsername) {
      return sendJson(res, 400, { ok: false, error: 'Thiếu username cần thao tác.' });
    }

    if (action === 'create_user') {
      const displayName = String(body.displayName || '').trim() || targetUsername;
      const password = String(body.password || '');
      const role = body.role === 'admin' ? 'admin' : 'user';

      if (!/^[a-z0-9_.-]{3,30}$/.test(targetUsername)) {
        return sendJson(res, 400, {
          ok: false,
          error: 'Username phải từ 3–30 ký tự (chữ thường, số, _, -, .).',
        });
      }
      if (password.length < 4) {
        return sendJson(res, 400, { ok: false, error: 'Mật khẩu phải từ 4 ký tự trở lên.' });
      }
      const existing = await findUser(db, targetUsername);
      if (existing) {
        return sendJson(res, 409, { ok: false, error: 'Username này đã tồn tại.' });
      }
      const now = new Date().toISOString();
      await saveUser(db, {
        username: targetUsername,
        displayName,
        passwordHash: hashPassword(password),
        role,
        createdAt: now,
        lastLoginAt: now,
      });
      return sendJson(res, 201, { ok: true, message: `Đã tạo tài khoản ${targetUsername}.` });
    }

    if (action === 'reset_password') {
      const newPassword = String(body.newPassword || '');
      if (newPassword.length < 4) {
        return sendJson(res, 400, { ok: false, error: 'Mật khẩu mới phải từ 4 ký tự trở lên.' });
      }
      const existing = await findUser(db, targetUsername);
      if (!existing) {
        return sendJson(res, 404, { ok: false, error: 'Không tìm thấy tài khoản.' });
      }
      existing.passwordHash = hashPassword(newPassword);
      await saveUser(db, existing);
      return sendJson(res, 200, {
        ok: true,
        message: `Đã đặt lại mật khẩu cho tài khoản ${targetUsername}.`,
      });
    }

    if (action === 'reset_progress') {
      g.__ccdvMemoryProgress!.delete(targetUsername);
      if (db) {
        await db.collection('user_progress').deleteOne({ username: targetUsername });
      }
      return sendJson(res, 200, {
        ok: true,
        message: `Đã xóa tiến độ học tập của ${targetUsername}.`,
      });
    }

    if (action === 'delete_user') {
      if (adminUsername && targetUsername === adminUsername) {
        return sendJson(res, 400, {
          ok: false,
          error: `Không thể xóa tài khoản Admin gốc (${adminUsername}).`,
        });
      }
      g.__ccdvMemoryUsers!.delete(targetUsername);
      g.__ccdvMemoryProgress!.delete(targetUsername);
      if (db) {
        await db.collection('users').deleteOne({ username: targetUsername });
        await db.collection('user_progress').deleteOne({ username: targetUsername });
      }
      return sendJson(res, 200, {
        ok: true,
        message: `Đã xóa tài khoản ${targetUsername}.`,
      });
    }

    return sendJson(res, 400, { ok: false, error: 'Action không hợp lệ.' });
  }

  return sendJson(res, 404, { ok: false, error: `Endpoint không tồn tại: ${method} ${pathname}` });
}
