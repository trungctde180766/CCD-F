import React from 'react';
import {
  AlertTriangle,
  BookOpen,
  CalendarClock,
  Cloud,
  Clock,
  Database,
  LayoutDashboard,
  LogIn,
  LogOut,
  Moon,
  Play,
  Shield,
  Sun,
  Target,
  Timer,
  User,
} from 'lucide-react';
import { QUESTION_BANK } from '../data/questionBank';
import type { ActiveSession, AuthUser, NavigationTab } from '../types';
import type { StorageStatus } from '../lib/storage';

interface LayoutProps {
  activeTab: NavigationTab;
  onSelectTab: (tab: NavigationTab) => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  dueCount: number;
  wrongLatestCount: number;
  activeSession: ActiveSession | null;
  onResumeActiveSession: () => void;
  storageStatus: StorageStatus;
  authUser: AuthUser | null;
  cloudSynced: boolean;
  onOpenAuthModal: () => void;
  onLogout: () => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({
  activeTab,
  onSelectTab,
  darkMode,
  onToggleDarkMode,
  dueCount,
  wrongLatestCount,
  activeSession,
  onResumeActiveSession,
  storageStatus,
  authUser,
  cloudSynced,
  onOpenAuthModal,
  onLogout,
  children,
}) => {
  const navItems: Array<{
    id: NavigationTab;
    label: string;
    icon: React.ReactNode;
    badge?: number;
    badgeColor?: string;
  }> = [
    {
      id: 'overview',
      label: 'Tổng quan',
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: 'study',
      label: 'Học từng câu',
      icon: <BookOpen className="w-4 h-4" />,
    },
    {
      id: 'practice',
      label: 'Luyện tập',
      icon: <Target className="w-4 h-4" />,
    },
    {
      id: 'exam',
      label: 'Thi thử',
      icon: <Timer className="w-4 h-4" />,
    },
    {
      id: 'review',
      label: 'Ôn câu sai & Nhắc ôn',
      icon: <CalendarClock className="w-4 h-4" />,
      badge: dueCount > 0 ? dueCount : wrongLatestCount > 0 ? wrongLatestCount : undefined,
      badgeColor:
        dueCount > 0
          ? 'bg-brand-600 text-white'
          : 'bg-rose-100 text-rose-800 dark:bg-rose-900/70 dark:text-rose-200',
    },
    {
      id: 'library',
      label: 'Thư viện & Sao lưu',
      icon: <Database className="w-4 h-4" />,
    },
  ];

  if (authUser?.role === 'admin') {
    navItems.push({
      id: 'admin',
      label: 'Admin Dashboard',
      icon: <Shield className="w-4 h-4" />,
    });
  }

  const hasInProgressSession =
    activeSession && activeSession.status === 'in_progress';

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="h-16 flex items-center justify-between gap-3">
            {/* Brand Title */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center font-mono font-bold text-sm shadow-xs shrink-0">
                CC
              </div>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                  Claude Certified Developer – Foundations
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  110 câu thực tế (102 chọn 1 • 8 chọn nhiều) • Revision {QUESTION_BANK.revision}
                </p>
              </div>
            </div>

            {/* Right Controls: Active Session + Auth Profile + Theme Toggle */}
            <div className="flex items-center gap-2">
              {hasInProgressSession && (
                <button
                  type="button"
                  onClick={onResumeActiveSession}
                  className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-100 hover:bg-amber-200 text-amber-900 dark:bg-amber-950/80 dark:hover:bg-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800 transition-colors"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>
                    Tiếp tục phiên ({activeSession.mode === 'exam' ? 'Thi thử' : 'Luyện tập'})
                  </span>
                </button>
              )}

              {authUser ? (
                <div className="flex items-center gap-2 pl-2.5 pr-1.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-1.5 text-xs">
                    <User className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 shrink-0" />
                    <span className="font-bold text-slate-900 dark:text-slate-100 max-w-[130px] truncate">
                      {authUser.displayName}
                    </span>
                    {authUser.role === 'admin' && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-600 text-white">
                        ADMIN
                      </span>
                    )}
                    <span
                      title={
                        cloudSynced
                          ? 'Tiến độ của bạn đang đồng bộ trực tiếp lên MongoDB Cloud'
                          : 'Đang lưu cục bộ'
                      }
                      className={`hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        cloudSynced
                          ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-950'
                          : 'text-slate-500'
                      }`}
                    >
                      <Cloud className="w-3 h-3" />
                      <span>Cloud</span>
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={onLogout}
                    title="Đăng xuất tài khoản"
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Thoát</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onOpenAuthModal}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white shadow-xs transition-colors"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Đăng nhập / Đăng ký</span>
                </button>
              )}

              <button
                type="button"
                onClick={onToggleDarkMode}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500"
                aria-label={darkMode ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
                title={darkMode ? 'Giao diện sáng' : 'Giao diện tối'}
              >
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav
            aria-label="Điều hướng chính"
            className="flex items-center gap-1 overflow-x-auto pb-2 -mb-px scrollbar-none"
          >
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              const isAdminTab = item.id === 'admin';
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                    isActive
                      ? isAdminTab
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-brand-600 text-white shadow-xs'
                      : isAdminTab
                      ? 'text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[11px] font-bold ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : item.badgeColor || 'bg-slate-200 text-slate-800'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Storage Warning Banner if localStorage has issues */}
      {(!storageStatus.available || storageStatus.error) && (
        <div
          role="alert"
          className="bg-amber-50 dark:bg-amber-950/60 border-b border-amber-200 dark:border-amber-800 px-4 py-2.5 text-xs sm:text-sm text-amber-900 dark:text-amber-200"
        >
          <div className="max-w-7xl mx-auto flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>{storageStatus.error}</span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {children}
      </main>

      {/* Footer with Required Attribution & Disclaimers */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div className="space-y-1 max-w-3xl">
            <p className="font-semibold text-slate-700 dark:text-slate-300">
              Nguồn dữ liệu: {QUESTION_BANK.extraction.sourceAuthor} (
              <a
                href={QUESTION_BANK.extraction.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-600 dark:text-brand-400 underline hover:text-brand-700"
              >
                {QUESTION_BANK.extraction.sourceUrl}
              </a>
              ) • Ngày thu thập: {QUESTION_BANK.extraction.retrievedDate} (Revision{' '}
              {QUESTION_BANK.revision})
            </p>
            <p>
              <strong>Lưu ý miễn trừ trách nhiệm:</strong> Đây là tài liệu luyện tập tham khảo phục vụ
              mục đích tự học cá nhân và nhóm học tập. Các câu hỏi, đáp án và lời giải được giữ nguyên
              theo nguồn T-Study, chưa được thẩm định độc lập và <strong>không phải</strong> sản phẩm
              chính thức của Anthropic hay ngân hàng đề thi thật.
            </p>
          </div>
          <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 shrink-0">
            <Clock className="w-3.5 h-3.5" />
            <span>Múi giờ lịch ôn: Asia/Ho_Chi_Minh</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
