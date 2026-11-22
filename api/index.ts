import type { IncomingMessage, ServerResponse } from 'node:http';
import crypto from 'node:crypto';
import { MongoClient, type Db } from 'mongodb';

const DEFAULT_MONGODB_URI =
  'mongodb+srv://thanhtrung9ctv_db_user:PLpeQ8ZI6LvLzcqo@cluster0.9wawqci.mongodb.net/ccdv_f_study?retryWrites=true&w=majority&appName=Cluster0';

const MONGODB_URI = process.env.MONGODB_URI || DEFAULT_MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB_NAME || 'ccdv_f_study';
const JWT_SECRET = process.env.JWT_SECRET || 'ccdv-f-secret-key-trung-admin-2026';

const ADMIN_USERNAME = 'trung';
const ADMIN_PASSWORD = 'concatre';
const ADMIN_DISPLAY_NAME = 'Thanh Trung (Admin)';

export interface UserDocument {
  username: string;
  displayName: string;
  passwordHash: string;
  role: 'admin' | 'user';
  createdAt: string;
  lastLoginAt: string;
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
  const fullPayload: TokenPayload = {
    ...payload,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
  };
  const data = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifyToken(token: string | undefined | null): TokenPayload | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
  if (sig !== expectedSig) return null;
  try {
    const parsed = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as TokenPayload;
    if (!parsed.exp || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function ensureMemoryAdminSeeded() {
  const memUsers = g.__ccdvMemoryUsers!;
  if (!memUsers.has(ADMIN_USERNAME)) {
    const now = new Date().toISOString();
    memUsers.set(ADMIN_USERNAME, {
      username: ADMIN_USERNAME,
      displayName: ADMIN_DISPLAY_NAME,
      passwordHash: hashPassword(ADMIN_PASSWORD),
      role: 'admin',
      createdAt: now,
      lastLoginAt: now,
    });
  }
}

async function getDatabase(): Promise<{ db: Db | null; dbConnected: boolean; dbError: string | null }> {
  ensureMemoryAdminSeeded();
  try {
    if (g.__ccdvMongoDb && g.__ccdvMongoClient) {
      return { db: g.__ccdvMongoDb, dbConnected: true, dbError: null };
    }
    const client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 6000,
      connectTimeoutMS: 6000,
    });
    await client.connect();
    const db = client.db(DB_NAME);

    // Ensure indexes & seed admin account "trung" / "concatre"
    const usersCol = db.collection<UserDocument>('users');
    await usersCol.createIndex({ username: 1 }, { unique: true });
    await db.collection<UserProgressDocument>('user_progress').createIndex({ username: 1 }, { unique: true });

    const existingAdmin = await usersCol.findOne({ username: ADMIN_USERNAME });
    const now = new Date().toISOString();
    if (!existingAdmin) {
      await usersCol.insertOne({
        username: ADMIN_USERNAME,
        displayName: ADMIN_DISPLAY_NAME,
        passwordHash: hashPassword(ADMIN_PASSWORD),
        role: 'admin',
        createdAt: now,
        lastLoginAt: now,
      });
    } else if (existingAdmin.role !== 'admin' || !verifyPassword(ADMIN_PASSWORD, existingAdmin.passwordHash)) {
      await usersCol.updateOne(
        { username: ADMIN_USERNAME },
        {
          $set: {
            role: 'admin',
            passwordHash: hashPassword(ADMIN_PASSWORD),
            displayName: existingAdmin.displayName || ADMIN_DISPLAY_NAME,
          },
        }
      );
    }

    g.__ccdvMongoClient = client;
    g.__ccdvMongoDb = db;
    g.__ccdvLastDbError = null;
    return { db, dbConnected: true, dbError: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Không thể kết nối MongoDB Atlas';
    g.__ccdvLastDbError = msg;
    g.__ccdvMongoClient = null;
    g.__ccdvMongoDb = null;
    return { db: null, dbConnected: false, dbError: msg };
  }
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  // If body already parsed by Vercel/Express
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

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const urlObj = new URL(req.url || '/api', 'http://localhost');
  const pathname = urlObj.pathname.replace(/\/+$/, '');
  const method = (req.method || 'GET').toUpperCase();

  if (method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const { db, dbConnected, dbError } = await getDatabase();

  // 1. POST /api/auth/login
  if (pathname === '/api/auth/login' && method === 'POST') {
    const body = await readJsonBody(req);
    const rawUsername = String(body.username || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!rawUsername || !password) {
      return sendJson(res, 400, {
        ok: false,
        error: 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.',
      });
    }

    let user = await findUser(db, rawUsername);

    // Guarantee admin account trung / concatre works
    if (rawUsername === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      const now = new Date().toISOString();
      user = {
        username: ADMIN_USERNAME,
        displayName: user?.displayName || ADMIN_DISPLAY_NAME,
        passwordHash: hashPassword(ADMIN_PASSWORD),
        role: 'admin',
        createdAt: user?.createdAt || now,
        lastLoginAt: now,
      };
      await saveUser(db, user);
    } else {
      if (!user || !verifyPassword(password, user.passwordHash)) {
        return sendJson(res, 401, {
          ok: false,
          error: 'Sai tên đăng nhập hoặc mật khẩu.',
        });
      }
      user.lastLoginAt = new Date().toISOString();
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
    if (rawUsername === ADMIN_USERNAME) {
      return sendJson(res, 400, {
        ok: false,
        error: 'Tài khoản "trung" đã được cấp riêng cho Admin. Vui lòng chuyển sang tab Đăng nhập.',
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
    const newUser: UserDocument = {
      username: rawUsername,
      displayName,
      passwordHash: hashPassword(password),
      role: 'user',
      createdAt: now,
      lastLoginAt: now,
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

  // 4. GET or PUT/POST /api/progress
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

  // 5. GET /api/admin/overview
  if (pathname === '/api/admin/overview' && method === 'GET') {
    const tokenPayload = verifyToken(getBearerToken(req));
    if (!tokenPayload || tokenPayload.role !== 'admin') {
      return sendJson(res, 403, {
        ok: false,
        error: 'Chỉ tài khoản Admin (trung) mới có quyền truy cập trang quản trị.',
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

      return {
        username: u.username,
        displayName: u.displayName,
        role: u.role,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt,
        updatedAt: typeof prog.updatedAt === 'string' ? prog.updatedAt : u.lastLoginAt,
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
      dbCluster: 'cluster0.9wawqci.mongodb.net',
      dbName: DB_NAME,
      dbError,
      users: usersReport,
    });
  }

  // 6. POST /api/admin/users (Admin actions: create user, reset password, delete user, reset progress)
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
      if (targetUsername === ADMIN_USERNAME) {
        return sendJson(res, 400, {
          ok: false,
          error: 'Không thể xóa tài khoản Admin gốc (trung).',
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
