import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Award,
  CheckCircle2,
  Clock,
  Database,
  Eye,
  Globe,
  KeyRound,
  Laptop,
  Loader2,
  Monitor,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Shield,
  Smartphone,
  Trash2,
  Users,
  Wifi,
  X,
  XCircle,
} from 'lucide-react';
import { extractBlockText, QUESTIONS, QUESTIONS_BY_ID } from '../data/questionBank';
import {
  AdminOverviewResponse,
  apiAdminManageUser,
  apiFetchAdminOverview,
} from '../lib/auth';
import { calculateSafePercentage, gradeQuestion } from '../lib/scoring';
import type {
  AdminLearnerReport,
  AttemptRecord,
  SessionHistoryItem,
} from '../types';

interface AdminDashboardPageProps {
  token: string;
  onOpenQuestionInStudy: (questionId: string) => void;
}

interface ComputedLearnerMetrics {
  user: AdminLearnerReport;
  answeredUniqueCount: number;
  correctUnassistedLatestCount: number;
  wrongLatestCount: number;
  firstAttemptCorrectCount: number;
  firstAttemptAccuracy: number | null;
  latestAttemptAccuracy: number | null;
  examSessions: SessionHistoryItem[];
  practiceSessions: SessionHistoryItem[];
  bestExamScore: number | null;
  latestExamScore: number | null;
}

interface GlobalSessionEntry {
  username: string;
  displayName: string;
  role: 'admin' | 'user';
  ipAddress?: string;
  deviceSummary?: string;
  session: SessionHistoryItem;
}

function computeLearnerMetrics(user: AdminLearnerReport): ComputedLearnerMetrics {
  const attemptsByQ = new Map<string, AttemptRecord[]>();
  for (const att of user.attempts || []) {
    const list = attemptsByQ.get(att.questionId);
    if (list) list.push(att);
    else attemptsByQ.set(att.questionId, [att]);
  }

  let answeredUniqueCount = 0;
  let correctUnassistedLatestCount = 0;
  let wrongLatestCount = 0;
  let firstAttemptCorrectCount = 0;

  for (const q of QUESTIONS) {
    const qAtts = attemptsByQ.get(q.id) || [];
    if (qAtts.length === 0) continue;
    answeredUniqueCount++;
    const first = qAtts[0];
    const latest = qAtts[qAtts.length - 1];
    if (first.isCorrect && !first.revealedBeforeCheck) firstAttemptCorrectCount++;
    if (latest.isCorrect && !latest.revealedBeforeCheck) {
      correctUnassistedLatestCount++;
    } else {
      wrongLatestCount++;
    }
  }

  const sessions = Array.isArray(user.sessionHistory) ? user.sessionHistory : [];
  const examSessions = sessions.filter((s) => s.mode === 'exam');
  const practiceSessions = sessions.filter((s) => s.mode === 'practice');

  const bestExamScore =
    examSessions.length > 0
      ? Math.max(...examSessions.map((s) => s.scorePercent))
      : null;
  const latestExamScore = examSessions.length > 0 ? examSessions[0].scorePercent : null;

  return {
    user,
    answeredUniqueCount,
    correctUnassistedLatestCount,
    wrongLatestCount,
    firstAttemptCorrectCount,
    firstAttemptAccuracy: calculateSafePercentage(firstAttemptCorrectCount, answeredUniqueCount),
    latestAttemptAccuracy: calculateSafePercentage(
      correctUnassistedLatestCount,
      answeredUniqueCount
    ),
    examSessions,
    practiceSessions,
    bestExamScore,
    latestExamScore,
  };
}

function formatLastSeenAgo(seconds?: number): string {
  if (seconds === undefined || seconds === null) return 'Chưa rõ';
  if (seconds < 15) return 'Vừa tức thì';
  if (seconds < 60) return `${seconds} giây trước`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
}

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({
  token,
  onOpenQuestionInStudy,
}) => {
  const [data, setData] = useState<AdminOverviewResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'learners' | 'sessions' | 'questions'>('learners');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal states
  const [selectedLearner, setSelectedLearner] = useState<ComputedLearnerMetrics | null>(null);
  const [selectedSessionDetail, setSelectedSessionDetail] = useState<GlobalSessionEntry | null>(
    null
  );
  const [showCreateUserModal, setShowCreateUserModal] = useState<boolean>(false);
  const [newUsername, setNewUsername] = useState<string>('');
  const [newDisplayName, setNewDisplayName] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [newRole, setNewRole] = useState<'user' | 'admin'>('user');
  const [actionToast, setActionToast] = useState<string | null>(null);

  // Reset password modal
  const [resetPwdTarget, setResetPwdTarget] = useState<string | null>(null);
  const [resetPwdValue, setResetPwdValue] = useState<string>('');

  const fetchOverview = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setErrorMsg(null);
      try {
        const res = await apiFetchAdminOverview(token);
        if (!res.ok) {
          if (!silent) setErrorMsg(res.error || 'Không thể tải dữ liệu quản trị.');
        } else {
          setData(res);
        }
      } catch {
        if (!silent) setErrorMsg('Lỗi kết nối tới API quản trị.');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    fetchOverview(false);
  }, [fetchOverview]);

  // Live 10-second polling when autoRefresh is enabled
  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(() => {
      fetchOverview(true);
    }, 10000);
    return () => window.clearInterval(id);
  }, [autoRefresh, fetchOverview]);

  const learnerMetrics = useMemo(() => {
    if (!data?.users) return [];
    return data.users
      .map(computeLearnerMetrics)
      .sort((a, b) => {
        const aOnline = a.user.isOnline ? 1 : 0;
        const bOnline = b.user.isOnline ? 1 : 0;
        if (aOnline !== bOnline) return bOnline - aOnline;
        return b.answeredUniqueCount - a.answeredUniqueCount;
      });
  }, [data]);

  const filteredLearners = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return learnerMetrics;
    return learnerMetrics.filter(
      (m) =>
        m.user.username.toLowerCase().includes(q) ||
        m.user.displayName.toLowerCase().includes(q) ||
        (m.user.telemetry?.ipAddress || '').toLowerCase().includes(q) ||
        (m.user.telemetry?.os || '').toLowerCase().includes(q)
    );
  }, [learnerMetrics, searchQuery]);

  const globalSessions = useMemo<GlobalSessionEntry[]>(() => {
    const list: GlobalSessionEntry[] = [];
    for (const m of learnerMetrics) {
      const t = m.user.telemetry;
      const devSummary = t ? `${t.deviceType} • ${t.os} • ${t.browser}` : undefined;
      for (const sess of m.user.sessionHistory || []) {
        list.push({
          username: m.user.username,
          displayName: m.user.displayName,
          role: m.user.role,
          ipAddress: t?.ipAddress,
          deviceSummary: devSummary,
          session: sess,
        });
      }
    }
    return list.sort((a, b) =>
      (b.session.submittedAt || '').localeCompare(a.session.submittedAt || '')
    );
  }, [learnerMetrics]);

  const filteredSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return globalSessions;
    return globalSessions.filter(
      (g) =>
        g.username.toLowerCase().includes(q) ||
        g.displayName.toLowerCase().includes(q) ||
        g.session.title.toLowerCase().includes(q) ||
        (g.ipAddress || '').toLowerCase().includes(q)
    );
  }, [globalSessions, searchQuery]);

  const questionAnalytics = useMemo(() => {
    const map = new Map<
      string,
      { totalAttempts: number; wrongAttempts: number; uniqueUsersAttempted: Set<string> }
    >();
    for (const q of QUESTIONS) {
      map.set(q.id, { totalAttempts: 0, wrongAttempts: 0, uniqueUsersAttempted: new Set() });
    }
    for (const m of learnerMetrics) {
      for (const att of m.user.attempts || []) {
        const entry = map.get(att.questionId);
        if (!entry) continue;
        entry.totalAttempts++;
        entry.uniqueUsersAttempted.add(m.user.username);
        if (!att.isCorrect || att.revealedBeforeCheck) {
          entry.wrongAttempts++;
        }
      }
    }

    return QUESTIONS.map((q) => {
      const stat = map.get(q.id)!;
      const wrongRate = calculateSafePercentage(stat.wrongAttempts, stat.totalAttempts);
      return {
        question: q,
        totalAttempts: stat.totalAttempts,
        wrongAttempts: stat.wrongAttempts,
        uniqueUsersCount: stat.uniqueUsersAttempted.size,
        wrongRatePercent: wrongRate,
      };
    })
      .filter((x) => x.totalAttempts > 0)
      .sort((a, b) => (b.wrongRatePercent || 0) - (a.wrongRatePercent || 0));
  }, [learnerMetrics]);

  const totalLearners = learnerMetrics.length;
  const onlineNowCount = learnerMetrics.filter((m) => m.user.isOnline).length;
  const takingExamRightNowCount = learnerMetrics.filter(
    (m) => m.user.activeSession && m.user.activeSession.status === 'in_progress'
  ).length;
  const totalExamsCount = globalSessions.filter((s) => s.session.mode === 'exam').length;
  const totalPracticesCount = globalSessions.filter((s) => s.session.mode === 'practice').length;
  const totalAttemptsAllUsers = learnerMetrics.reduce(
    (acc, m) => acc + (m.user.attempts?.length || 0),
    0
  );

  const avgExamScore = useMemo(() => {
    const exams = globalSessions.filter((s) => s.session.mode === 'exam');
    if (exams.length === 0) return null;
    const sum = exams.reduce((acc, e) => acc + e.session.scorePercent, 0);
    return Math.round((sum / exams.length) * 10) / 10;
  }, [globalSessions]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiAdminManageUser(token, {
      action: 'create_user',
      username: newUsername,
      displayName: newDisplayName,
      password: newPassword,
      role: newRole,
    });
    if (!res.ok) {
      alert(res.error || 'Không thể tạo tài khoản.');
      return;
    }
    setActionToast(res.message || 'Đã tạo tài khoản thành công.');
    setShowCreateUserModal(false);
    setNewUsername('');
    setNewDisplayName('');
    setNewPassword('');
    fetchOverview(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPwdTarget) return;
    const res = await apiAdminManageUser(token, {
      action: 'reset_password',
      username: resetPwdTarget,
      newPassword: resetPwdValue,
    });
    if (!res.ok) {
      alert(res.error || 'Không thể đặt lại mật khẩu.');
      return;
    }
    setActionToast(res.message || 'Đã đổi mật khẩu.');
    setResetPwdTarget(null);
    setResetPwdValue('');
  };

  const handleDeleteUser = async (username: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa tài khoản "${username}" và toàn bộ dữ liệu?`)) {
      return;
    }
    const res = await apiAdminManageUser(token, {
      action: 'delete_user',
      username,
    });
    if (!res.ok) {
      alert(res.error || 'Không thể xóa tài khoản.');
      return;
    }
    setActionToast(res.message || 'Đã xóa tài khoản.');
    setSelectedLearner(null);
    fetchOverview(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Admin Hero Banner */}
      <section className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white border border-indigo-800/50 shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 border border-indigo-400/30 text-indigo-200">
                <Shield className="w-3.5 h-3.5" />
                <span>Admin Control Center • Giám sát Thời gian thực</span>
              </span>

              {data && (
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                    data.dbConnected
                      ? 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-200'
                      : 'bg-amber-500/20 border border-amber-400/40 text-amber-200'
                  }`}
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>
                    {data.dbConnected
                      ? `MongoDB Atlas Connected (${data.dbCluster})`
                      : 'Chế độ Fallback (Kiểm tra MONGODB_URI / Network Access 0.0.0.0/0)'}
                  </span>
                </span>
              )}
            </div>

            <h2 className="text-2xl font-bold">
              Giám sát Người dùng, Địa chỉ IP, Thiết bị & Phòng thi Trực tuyến
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl">
              Theo dõi trực tiếp ai đang Online, đăng nhập từ máy nào, địa chỉ IP nào, đang làm câu
              hỏi hay đề thi thử nào và xem toàn bộ bài làm chi tiết của từng người.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setAutoRefresh((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold border transition-colors ${
                autoRefresh
                  ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                  : 'bg-white/10 border-white/15 text-slate-300'
              }`}
            >
              <Radio className={`w-3.5 h-3.5 ${autoRefresh ? 'animate-ping text-emerald-400' : ''}`} />
              <span>{autoRefresh ? 'Live Auto-Refresh (10s)' : 'Tự động cập nhật: Tắt'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowCreateUserModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-brand-600 hover:bg-brand-500 text-white shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Tạo tài khoản</span>
            </button>

            <button
              type="button"
              onClick={() => fetchOverview(false)}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Làm mới</span>
            </button>
          </div>
        </div>

        {data?.dbError && (
          <div className="mt-4 p-3 rounded-xl bg-amber-500/20 border border-amber-400/40 text-xs text-amber-100 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-300" />
            <div>
              <strong>Lưu ý kết nối MongoDB Atlas:</strong> {data.dbError}. Hãy đảm bảo đã cấu hình{' '}
              <code className="font-mono font-bold">MONGODB_URI</code> trong Environment Variables
              của Vercel và mở IP <code className="font-mono font-bold">0.0.0.0/0</code> trong
              Network Access của Atlas.
            </div>
          </div>
        )}
      </section>

      {actionToast && (
        <div
          role="status"
          className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs sm:text-sm text-emerald-900 dark:text-emerald-200 flex items-center justify-between"
        >
          <span>✓ {actionToast}</span>
          <button
            type="button"
            onClick={() => setActionToast(null)}
            className="text-emerald-700 hover:text-emerald-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* System KPI Summary Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500">
            <span>Người dùng & Trực tuyến</span>
            <Users className="w-4 h-4 text-brand-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2.5">
            <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">
              {totalLearners}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              {onlineNowCount} đang Online
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Đang trong phiên thi/luyện dở: <strong>{takingExamRightNowCount}</strong> người
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500">
            <span>Tổng đề Thi thử đã nộp</span>
            <Award className="w-4 h-4 text-purple-500" />
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">
            {totalExamsCount}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Điểm TB Thi thử:{' '}
            <strong className="text-emerald-600 dark:text-emerald-400">
              {avgExamScore !== null ? `${avgExamScore}%` : 'Chưa có'}
            </strong>
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500">
            <span>Phiên Luyện tập hoàn tất</span>
            <Activity className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">
            {totalPracticesCount}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Tổng số phiên (Thi + Luyện): <strong>{globalSessions.length}</strong>
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500">
            <span>Tổng lượt chấm toàn hệ thống</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">
            {totalAttemptsAllUsers}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Số câu đã có người làm: <strong>{questionAnalytics.length}</strong> / 110 câu
          </p>
        </div>
      </section>

      {/* Sub-navigation & Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('learners')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors ${
              activeTab === 'learners'
                ? 'bg-brand-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            1. Người dùng, Máy, IP & Trạng thái Thi ({learnerMetrics.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sessions')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors ${
              activeTab === 'sessions'
                ? 'bg-brand-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            2. Nhật ký Ai Thi Cái Gì ({globalSessions.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('questions')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors ${
              activeTab === 'questions'
                ? 'bg-brand-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            3. Thống kê Câu hay sai ({questionAnalytics.length})
          </button>
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên, username, địa chỉ IP, hệ điều hành..."
            className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {loading && !data ? (
        <div className="p-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-2">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-brand-500" />
          <p className="text-sm text-slate-500">Đang tải dữ liệu giám sát từ MongoDB Atlas...</p>
        </div>
      ) : errorMsg ? (
        <div className="p-8 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-center text-rose-800 dark:text-rose-200 space-y-3">
          <p className="font-bold">{errorMsg}</p>
          <button
            type="button"
            onClick={() => fetchOverview(false)}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 text-white"
          >
            Thử lại
          </button>
        </div>
      ) : activeTab === 'learners' ? (
        /* TAB 1: LEARNERS, DEVICE, IP, ONLINE PRESENCE & EXAM STATUS */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                  <th className="py-3.5 px-4">Người dùng & Trạng thái</th>
                  <th className="py-3.5 px-4">Địa chỉ IP & Vị trí</th>
                  <th className="py-3.5 px-4">Thông tin Máy & Trình duyệt</th>
                  <th className="py-3.5 px-4">Hoạt động / Thi cử hiện tại</th>
                  <th className="py-3.5 px-4">Tiến độ học (110 câu)</th>
                  <th className="py-3.5 px-4">Kết quả Thi thử</th>
                  <th className="py-3.5 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredLearners.map((m) => {
                  const pctCovered = Math.round((m.answeredUniqueCount / 110) * 100);
                  const t = m.user.telemetry;
                  const inProgress =
                    m.user.activeSession && m.user.activeSession.status === 'in_progress'
                      ? m.user.activeSession
                      : null;

                  return (
                    <tr
                      key={m.user.username}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                    >
                      {/* User & Online Status */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                          <span>{m.user.displayName}</span>
                          {m.user.role === 'admin' && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                              ADMIN
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-mono text-slate-500">@{m.user.username}</div>
                        <div className="mt-1">
                          {m.user.isOnline ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                              <span>Đang Online</span>
                            </span>
                          ) : m.user.isRecentlyActive ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300">
                              <span className="w-2 h-2 rounded-full bg-amber-500" />
                              <span>Vừa hoạt động ({formatLastSeenAgo(m.user.secondsSinceLastSeen)})</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                              <span className="w-2 h-2 rounded-full bg-slate-400" />
                              <span>Offline ({formatLastSeenAgo(m.user.secondsSinceLastSeen)})</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* IP Address & Location */}
                      <td className="py-3.5 px-4">
                        {t?.ipAddress ? (
                          <div className="space-y-0.5">
                            <div className="inline-flex items-center gap-1.5 font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                              <Wifi className="w-3 h-3 text-brand-500" />
                              <span>{t.ipAddress}</span>
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-1">
                              <Globe className="w-3 h-3" />
                              <span>{t.location || 'Trực tuyến'}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Chưa ghi nhận IP</span>
                        )}
                      </td>

                      {/* Device, OS, Browser & Hardware */}
                      <td className="py-3.5 px-4">
                        {t ? (
                          <div className="space-y-0.5">
                            <div className="font-semibold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                              {t.deviceType === 'Mobile' ? (
                                <Smartphone className="w-3.5 h-3.5 text-brand-500" />
                              ) : (
                                <Laptop className="w-3.5 h-3.5 text-brand-500" />
                              )}
                              <span>
                                {t.os} • {t.browser}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {t.deviceType}
                              {t.screenResolution ? ` • Màn hình ${t.screenResolution}` : ''}
                              {t.cpuCores ? ` • ${t.cpuCores} nhân CPU` : ''}
                            </div>
                            {t.timezone && (
                              <div className="text-[10px] text-slate-400">
                                Múi giờ máy: {t.timezone} ({t.language || 'vi'})
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Chưa có thông tin máy</span>
                        )}
                      </td>

                      {/* Current Activity / Live Exam Status */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1 max-w-[230px]">
                          {t?.activityStatus && (
                            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                              {t.activityStatus}
                            </div>
                          )}
                          {inProgress ? (
                            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-200">
                              <div className="font-bold flex items-center gap-1">
                                <Clock className="w-3 h-3 text-amber-600" />
                                <span>Đang làm: {inProgress.title}</span>
                              </div>
                              <div>
                                Đang ở câu:{' '}
                                <code className="font-mono font-bold">
                                  {inProgress.currentQuestionId}
                                </code>{' '}
                                • Đã chọn {Object.keys(inProgress.selections || {}).length}/
                                {inProgress.questionOrder.length} câu
                              </div>
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-400">
                              Không có đề thi đang làm dở
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Study Progress */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold">
                          {m.answeredUniqueCount} / 110 câu ({pctCovered}%)
                        </div>
                        <div className="w-28 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden mt-1">
                          <div
                            style={{ width: `${pctCovered}%` }}
                            className="h-full bg-brand-600"
                          />
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Đúng gần nhất:{' '}
                          <strong className="text-emerald-600 dark:text-emerald-400">
                            {m.latestAttemptAccuracy !== null ? `${m.latestAttemptAccuracy}%` : '—'}
                          </strong>{' '}
                          • Tổng {m.user.attempts.length} lượt
                        </div>
                      </td>

                      {/* Exam Results */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold">{m.examSessions.length} đề thi thử</div>
                        {m.bestExamScore !== null ? (
                          <div className="text-xs text-slate-600 dark:text-slate-300">
                            Cao nhất:{' '}
                            <strong className="text-purple-600 dark:text-purple-400">
                              {m.bestExamScore}%
                            </strong>{' '}
                            • Gần nhất: <strong>{m.latestExamScore}%</strong>
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-400">
                            + {m.practiceSessions.length} phiên luyện tập
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedLearner(m)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Chi tiết</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setResetPwdTarget(m.user.username);
                              setResetPwdValue('');
                            }}
                            title="Đặt lại mật khẩu"
                            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>

                          {m.user.username !== 'trung' && (
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(m.user.username)}
                              title="Xóa tài khoản"
                              className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900/50 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'sessions' ? (
        /* TAB 2: GLOBAL EXAM & PRACTICE FEED ("AI THI CÁI GÌ") */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          {filteredSessions.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              Chưa có bài thi thử hoặc phiên luyện tập nào được nộp.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                    <th className="py-3.5 px-4">Thời gian nộp</th>
                    <th className="py-3.5 px-4">Người thi & IP/Máy</th>
                    <th className="py-3.5 px-4">Loại bài & Tên phiên</th>
                    <th className="py-3.5 px-4">Kết quả câu</th>
                    <th className="py-3.5 px-4">Điểm số</th>
                    <th className="py-3.5 px-4">Trạng thái</th>
                    <th className="py-3.5 px-4">Thời lượng</th>
                    <th className="py-3.5 px-4 text-right">Xem bài làm</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredSessions.map((entry) => {
                    const s = entry.session;
                    const isExam = s.mode === 'exam';
                    const mins = Math.floor((s.durationSeconds || 0) / 60);
                    const secs = (s.durationSeconds || 0) % 60;

                    return (
                      <tr
                        key={`${entry.username}_${s.id}`}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                      >
                        <td className="py-3 px-4 whitespace-nowrap text-xs text-slate-500">
                          {new Date(s.submittedAt).toLocaleString('vi-VN')}
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 dark:text-slate-100">
                            {entry.displayName} (@{entry.username})
                          </div>
                          {entry.ipAddress && (
                            <div className="text-[11px] font-mono text-slate-500">
                              IP: {entry.ipAddress} • {entry.deviceSummary}
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                isExam
                                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300'
                                  : 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300'
                              }`}
                            >
                              {isExam ? 'Thi thử' : 'Luyện tập'}
                            </span>
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                              {s.title}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Nguồn lọc: {s.filterLabel}
                          </div>
                        </td>

                        <td className="py-3 px-4 font-semibold">
                          Đúng {s.correctCount} / {s.totalQuestions} câu
                          <div className="text-[11px] font-normal text-slate-500">
                            Đã chọn: {s.answeredCount}/{s.totalQuestions}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`text-base font-bold ${
                              s.passed === false
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {s.scorePercent}%
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          {s.targetScorePercent !== null ? (
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                s.passed
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300'
                              }`}
                            >
                              {s.passed ? (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              ) : (
                                <XCircle className="w-3.5 h-3.5" />
                              )}
                              <span>
                                {s.passed ? 'ĐẠT' : 'CHƯA ĐẠT'} ({s.targetScorePercent}%)
                              </span>
                            </span>
                          ) : (
                            <span className="text-xs text-slate-500">Hoàn thành</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">
                          {mins}p {secs}s
                        </td>

                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedSessionDetail(entry)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:opacity-90"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Xem từng câu</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* TAB 3: HARDEST QUESTIONS ANALYTICS */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          {questionAnalytics.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              Chưa có lượt trả lời câu hỏi nào trên hệ thống.
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {questionAnalytics.slice(0, 40).map((item) => (
                <div
                  key={item.question.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                >
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded font-mono text-xs font-bold bg-slate-200 dark:bg-slate-800">
                        {item.question.id}
                      </span>
                      <span className="font-bold text-sm">{item.question.title}</span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300">
                        Tỷ lệ sai: {item.wrongRatePercent}% ({item.wrongAttempts}/
                        {item.totalAttempts} lượt)
                      </span>
                      <span className="text-xs text-slate-500">
                        • {item.uniqueUsersCount} học viên đã làm
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 line-clamp-2">
                      {extractBlockText(item.question.prompt)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenQuestionInStudy(item.question.id)}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white shrink-0"
                  >
                    Mở xem câu này
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: Learner Detailed Profile, Device/IP History & Exam History */}
      {selectedLearner && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-4xl max-h-[88vh] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                  Hồ sơ & Thiết bị học viên: {selectedLearner.user.displayName} (@
                  {selectedLearner.user.username})
                </h3>
                <p className="text-xs text-slate-500">
                  Đã trả lời {selectedLearner.answeredUniqueCount}/110 câu • Đúng gần nhất:{' '}
                  {selectedLearner.latestAttemptAccuracy ?? 0}% • Tổng{' '}
                  {selectedLearner.user.sessionHistory.length} phiên thi/luyện tập
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLearner(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {/* Device, Network & IP History Card */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Monitor className="w-4 h-4 text-brand-500" />
                  <span>Thông tin Máy, Mạng, Địa chỉ IP & Trạng thái hiện tại</span>
                </h4>
                {selectedLearner.user.telemetry ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500">Địa chỉ IP hiện tại:</span>{' '}
                      <strong className="font-mono">
                        {selectedLearner.user.telemetry.ipAddress}
                      </strong>{' '}
                      ({selectedLearner.user.telemetry.location})
                    </div>
                    <div>
                      <span className="text-slate-500">Hệ điều hành & Máy:</span>{' '}
                      <strong>
                        {selectedLearner.user.telemetry.deviceType} •{' '}
                        {selectedLearner.user.telemetry.os}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Trình duyệt:</span>{' '}
                      <strong>{selectedLearner.user.telemetry.browser}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Độ phân giải màn hình:</span>{' '}
                      <strong>
                        {selectedLearner.user.telemetry.screenResolution || '—'} (Viewport:{' '}
                        {selectedLearner.user.telemetry.viewport || '—'})
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Cấu hình phần cứng:</span>{' '}
                      <strong>
                        {selectedLearner.user.telemetry.cpuCores
                          ? `${selectedLearner.user.telemetry.cpuCores} nhân CPU`
                          : '—'}
                        {selectedLearner.user.telemetry.deviceMemoryGb
                          ? ` • ~${selectedLearner.user.telemetry.deviceMemoryGb} GB RAM`
                          : ''}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Hoạt động vừa ghi nhận:</span>{' '}
                      <strong className="text-brand-600 dark:text-brand-400">
                        {selectedLearner.user.telemetry.activityStatus}
                      </strong>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">Chưa có bản ghi thiết bị.</p>
                )}

                {selectedLearner.user.ipHistory && selectedLearner.user.ipHistory.length > 0 && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700 text-xs">
                    <div className="font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Lịch sử các IP & thiết bị từng đăng nhập:
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedLearner.user.ipHistory.map((h, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-[11px]"
                        >
                          {h.ip} ({h.device}) • {new Date(h.seenAt).toLocaleString('vi-VN')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Learner's Exam & Practice Sessions */}
              <div>
                <h4 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3">
                  Các đề Thi thử & Luyện tập đã nộp ({selectedLearner.user.sessionHistory.length})
                </h4>
                {selectedLearner.user.sessionHistory.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    Học viên này chưa nộp phiên Thi thử hoặc Luyện tập nào.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {selectedLearner.user.sessionHistory.map((sess) => (
                      <div
                        key={sess.id}
                        className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                sess.mode === 'exam'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {sess.mode === 'exam' ? 'Thi thử' : 'Luyện tập'}
                            </span>
                            <span className="font-bold text-xs sm:text-sm">{sess.title}</span>
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            Nộp lúc: {new Date(sess.submittedAt).toLocaleString('vi-VN')} • Đúng{' '}
                            {sess.correctCount}/{sess.totalQuestions} câu ({sess.scorePercent}%)
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setSelectedSessionDetail({
                              username: selectedLearner.user.username,
                              displayName: selectedLearner.user.displayName,
                              role: selectedLearner.user.role,
                              session: sess,
                            })
                          }
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-brand-600 text-white"
                        >
                          Xem bài làm chi tiết
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Learner's Recent Individual Question Attempts */}
              <div>
                <h4 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3">
                  25 lượt trả lời câu hỏi gần nhất (Tổng {selectedLearner.user.attempts.length} lượt)
                </h4>
                {selectedLearner.user.attempts.length === 0 ? (
                  <p className="text-xs text-slate-500">Chưa có lượt trả lời nào.</p>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                          <th className="py-2 px-3">Thời gian</th>
                          <th className="py-2 px-3">Mã câu</th>
                          <th className="py-2 px-3">Chế độ</th>
                          <th className="py-2 px-3">Đã chọn</th>
                          <th className="py-2 px-3">Đáp án đúng</th>
                          <th className="py-2 px-3">Kết quả</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {[...selectedLearner.user.attempts]
                          .reverse()
                          .slice(0, 25)
                          .map((att) => (
                            <tr key={att.id}>
                              <td className="py-2 px-3 text-slate-500">
                                {new Date(att.answeredAt).toLocaleString('vi-VN')}
                              </td>
                              <td className="py-2 px-3 font-mono font-bold">{att.questionId}</td>
                              <td className="py-2 px-3">{att.mode}</td>
                              <td className="py-2 px-3 font-mono">
                                {att.selectedOptionIds.map((x) => x.toUpperCase()).join(', ') ||
                                  '(Trống)'}
                              </td>
                              <td className="py-2 px-3 font-mono">
                                {att.correctOptionIds.map((x) => x.toUpperCase()).join(', ')}
                              </td>
                              <td className="py-2 px-3">
                                {att.isCorrect && !att.revealedBeforeCheck ? (
                                  <span className="text-emerald-600 font-bold">✓ Đúng</span>
                                ) : (
                                  <span className="text-rose-600 font-bold">✗ Sai</span>
                                )}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Detailed Question-by-Question Inspection of an Exam/Practice Session */}
      {selectedSessionDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-4xl max-h-[90vh] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                  Chi tiết bài làm: {selectedSessionDetail.displayName} (@
                  {selectedSessionDetail.username})
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedSessionDetail.session.title} • Điểm:{' '}
                  <strong>{selectedSessionDetail.session.scorePercent}%</strong> (Đúng{' '}
                  {selectedSessionDetail.session.correctCount}/
                  {selectedSessionDetail.session.totalQuestions} câu) • Nộp lúc:{' '}
                  {new Date(selectedSessionDetail.session.submittedAt).toLocaleString('vi-VN')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSessionDetail(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-3">
              {(selectedSessionDetail.session.questionOrder || []).map((qId, idx) => {
                const q = QUESTIONS_BY_ID[qId];
                if (!q) return null;
                const selected = selectedSessionDetail.session.selections?.[qId] || [];
                const grade = gradeQuestion(q, selected);

                return (
                  <div
                    key={qId}
                    className={`p-4 rounded-xl border text-xs sm:text-sm ${
                      grade.isCorrect
                        ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50'
                        : 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800">
                          Câu {idx + 1} ({q.id})
                        </span>
                        {grade.isCorrect ? (
                          <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                            ✓ Đúng
                          </span>
                        ) : (
                          <span className="text-rose-700 dark:text-rose-400 font-bold">
                            ✗ Sai {grade.isUnanswered ? '(Bỏ trống)' : ''}
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-xs">
                        Học viên chọn:{' '}
                        <strong>
                          {selected.length > 0
                            ? selected.map((x) => x.toUpperCase()).join(', ')
                            : '—'}
                        </strong>{' '}
                        | Đáp án nguồn:{' '}
                        <strong className="text-emerald-700 dark:text-emerald-400">
                          {q.interaction.correctOptionIds.map((x) => x.toUpperCase()).join(', ')}
                        </strong>
                      </div>
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 line-clamp-2">
                      {extractBlockText(q.prompt)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Create New Learner Account */}
      {showCreateUserModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleCreateUser}
            className="w-full max-w-md p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Tạo tài khoản học viên mới</h3>
              <button
                type="button"
                onClick={() => setShowCreateUserModal(false)}
                className="text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold">Username (3–30 ký tự)</label>
              <input
                type="text"
                required
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="vd: hocvien01"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold">Tên hiển thị</label>
              <input
                type="text"
                required
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                placeholder="vd: Trần Minh Hoàng"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold">Mật khẩu khởi tạo</label>
              <input
                type="text"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Ít nhất 4 ký tự"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold">Vai trò</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as 'user' | 'admin')}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
              >
                <option value="user">Học viên (user)</option>
                <option value="admin">Quản trị viên (admin)</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateUserModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-xs font-bold bg-brand-600 text-white"
              >
                Tạo tài khoản
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 4: Reset Password */}
      {resetPwdTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleResetPassword}
            className="w-full max-w-sm p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4"
          >
            <h3 className="text-base font-bold">
              Đặt lại mật khẩu cho @{resetPwdTarget}
            </h3>
            <input
              type="text"
              required
              value={resetPwdValue}
              onChange={(e) => setResetPwdValue(e.target.value)}
              placeholder="Nhập mật khẩu mới (tối thiểu 4 ký tự)"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setResetPwdTarget(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-xs font-bold bg-brand-600 text-white"
              >
                Lưu mật khẩu mới
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
