import React, { useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Globe,
  KeyRound,
  Loader2,
  Lock,
  LogIn,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
  Timer,
  UserPlus,
} from 'lucide-react';
import { QUESTION_BANK } from '../data/questionBank';
import { apiLogin, apiRegister } from '../lib/auth';
import type { AuthUser } from '../types';

interface AuthGatePageProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onAuthSuccess: (params: {
    token: string;
    user: AuthUser;
    serverProgress: unknown;
    dbConnected: boolean;
  }) => void;
}

/**
 * Full-screen mandatory Authentication Gate.
 * Users MUST log in or register an account before viewing or studying any questions.
 */
export const AuthGatePage: React.FC<AuthGatePageProps> = ({
  darkMode,
  onToggleDarkMode,
  onAuthSuccess,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await apiLogin(username, password);
        if (!res.ok || !res.token || !res.user) {
          setErrorMsg(res.error || 'Đăng nhập thất bại. Vui lòng kiểm tra lại tài khoản và mật khẩu.');
          setLoading(false);
          return;
        }
        onAuthSuccess({
          token: res.token,
          user: res.user,
          serverProgress: res.progress,
          dbConnected: Boolean(res.dbConnected),
        });
      } else {
        const res = await apiRegister({
          username,
          displayName: displayName.trim() || username.trim(),
          password,
        });
        if (!res.ok || !res.token || !res.user) {
          setErrorMsg(res.error || 'Đăng ký tài khoản thất bại.');
          setLoading(false);
          return;
        }
        onAuthSuccess({
          token: res.token,
          user: res.user,
          serverProgress: res.progress,
          dbConnected: Boolean(res.dbConnected),
        });
      }
    } catch {
      setErrorMsg('Không thể kết nối tới máy chủ xác thực. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Top Bar */}
      <header className="w-full border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center font-mono font-bold text-sm shadow-xs">
              CC
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                Claude Certified Developer – Foundations
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Hệ thống Tự học & Luyện thi Trực tuyến (CCDV-F)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onToggleDarkMode}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            aria-label={darkMode ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Content Grid */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-10">
        <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: Course Value Proposition */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-100 dark:bg-brand-950/80 border border-brand-300 dark:border-brand-800 text-brand-800 dark:text-brand-300 text-xs font-bold">
              <Lock className="w-3.5 h-3.5" />
              <span>Bắt buộc đăng nhập để vào học và làm bài thi</span>
            </div>

            <div className="space-y-3">
              <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100 leading-tight">
                Nền tảng Luyện thi{' '}
                <span className="text-brand-600 dark:text-brand-400">
                  Claude Certified Developer – Foundations
                </span>
              </h2>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
                Vui lòng đăng nhập hoặc tạo tài khoản học viên riêng trước khi truy cập ngân hàng
                110 câu hỏi. Mỗi người học có không gian lưu tiến độ, lịch ôn tập SRS và lịch sử
                phòng thi hoàn toàn độc lập trên hệ thống.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs flex items-start gap-3">
                <BookOpen className="w-5 h-5 text-brand-600 dark:text-brand-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    110 Câu hỏi Thực tế
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Đầy đủ 102 câu chọn 1 và 8 câu chọn nhiều đáp án kèm giải thích vì sao đúng/sai
                    cho từng phương án.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs flex items-start gap-3">
                <Globe className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Hỗ trợ Song ngữ Anh – Việt
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Bật/tắt linh hoạt chế độ tiếng Anh gốc hoặc Song ngữ EN+VI ngay cả trong lúc
                    đang làm bài thi thử.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs flex items-start gap-3">
                <Timer className="w-5 h-5 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Phòng Thi thử & Trợ giúp
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Đồng hồ bấm giờ deadline tuyệt đối, gợi ý tư duy, loại trừ đáp án nhiễu và chấm
                    điểm tập hợp chuẩn xác.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Tiến độ Riêng từng Cá nhân
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Đồng bộ tự động lên MongoDB Cloud theo từng tài khoản, không bị lẫn dữ liệu giữa
                    các học viên.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Login / Register Card */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
              <div className="px-6 py-5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center shrink-0">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {mode === 'login' ? 'Đăng nhập để Bắt đầu Học' : 'Đăng ký Tài khoản Học viên'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Yêu cầu xác thực tài khoản trước khi truy cập nội dung
                  </p>
                </div>
              </div>

              {/* Switch Login / Register */}
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
                    htmlFor="gate-username"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Tên đăng nhập (Username)
                  </label>
                  <input
                    id="gate-username"
                    type="text"
                    required
                    autoFocus
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Nhập username của bạn..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                {mode === 'register' && (
                  <div className="space-y-1.5">
                    <label
                      htmlFor="gate-displayname"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      Họ và tên / Tên hiển thị
                    </label>
                    <input
                      id="gate-displayname"
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
                    htmlFor="gate-password"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Mật khẩu
                  </label>
                  <input
                    id="gate-password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Nhập mật khẩu..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-brand-600 dark:text-brand-400" />
                  <span>
                    Nếu chưa có tài khoản, hãy bấm qua tab <strong>Đăng ký tài khoản mới</strong> để
                    tạo nhanh trong 5 giây và vào học ngay.
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-5 rounded-xl text-sm font-bold bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white shadow-sm flex items-center justify-center gap-2 transition-colors"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang xác thực...</span>
                    </>
                  ) : mode === 'login' ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Đăng nhập & Vào học ngay</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Tạo tài khoản & Vào học ngay</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-4 px-4 sm:px-6 text-center text-xs text-slate-500 dark:text-slate-400">
        Claude Certified Developer – Foundations (110 câu hỏi luyện tập • Revision{' '}
        {QUESTION_BANK.revision}) • Tài liệu tham khảo tự học.
      </footer>
    </div>
  );
};
