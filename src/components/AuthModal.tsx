import React, { useState } from 'react';
import {
  AlertCircle,
  KeyRound,
  Loader2,
  LogIn,
  ShieldCheck,
  UserPlus,
  X,
} from 'lucide-react';
import { apiLogin, apiRegister } from '../lib/auth';
import type { AppProgressState, AuthUser } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (params: {
    token: string;
    user: AuthUser;
    serverProgress: unknown;
    serverProgressByCourse?: Record<string, unknown>;
    dbConnected: boolean;
  }) => void;
  currentGuestProgress?: AppProgressState;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await apiLogin(username, password);
        if (!res.ok || !res.token || !res.user) {
          setErrorMsg(res.error || 'Đăng nhập thất bại.');
          setLoading(false);
          return;
        }
        onAuthSuccess({
          token: res.token,
          user: res.user,
          serverProgress: res.progress,
          dbConnected: Boolean(res.dbConnected),
        });
        onClose();
      } else {
        const res = await apiRegister({
          username,
          displayName: displayName.trim() || username.trim(),
          password,
        });
        if (!res.ok || !res.token || !res.user) {
          setErrorMsg(res.error || 'Đăng ký thất bại.');
          setLoading(false);
          return;
        }
        onAuthSuccess({
          token: res.token,
          user: res.user,
          serverProgress: res.progress,
          dbConnected: Boolean(res.dbConnected),
        });
        onClose();
      }
    } catch {
      setErrorMsg('Không thể kết nối tới máy chủ xác thực. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-600 text-white flex items-center justify-center">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="auth-modal-title"
                className="text-base font-bold text-slate-900 dark:text-slate-100"
              >
                {mode === 'login' ? 'Đăng nhập tài khoản học tập' : 'Tạo tài khoản học viên mới'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Đồng bộ tiến độ riêng & lịch sử thi trên MongoDB Cloud
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            aria-label="Đóng cửa sổ đăng nhập"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switch Tabs */}
        <div className="grid grid-cols-2 p-1.5 mx-6 mt-5 rounded-xl bg-slate-100 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setErrorMsg(null);
            }}
            className={`py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
              mode === 'login'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Đăng nhập</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setErrorMsg(null);
            }}
            className={`py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
              mode === 'register'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Đăng ký tài khoản mới</span>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200 flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label
              htmlFor="auth-username"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Tên đăng nhập (Username)
            </label>
            <input
              id="auth-username"
              type="text"
              required
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ví dụ: nam_dev (hoặc trung cho Admin)"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {mode === 'register' && (
            <div className="space-y-1.5">
              <label
                htmlFor="auth-displayname"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Họ và tên / Tên hiển thị
              </label>
              <input
                id="auth-displayname"
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ví dụ: Nguyễn Văn Nam"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label
              htmlFor="auth-password"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Mật khẩu
            </label>
            <input
              id="auth-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" />
            <span>
              Mỗi tài khoản có không gian học tập, lịch ôn SRS, câu đánh dấu, ghi chú và lịch sử đề
              thi thử riêng biệt trên MongoDB. Admin có thể theo dõi bảng tổng hợp của tất cả học
              viên.
            </span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-5 rounded-xl text-sm font-bold bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white shadow-sm flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang xử lý...</span>
              </>
            ) : mode === 'login' ? (
              <>
                <LogIn className="w-4 h-4" />
                <span>Đăng nhập ngay</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>Đăng ký & Bắt đầu học</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
