import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bookmark,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Database,
  Download,
  ExternalLink,
  Eye,
  FileJson,
  HardDrive,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  ALL_DERIVED_TAGS,
  DATASET_VALIDATION,
  extractBlockText,
  QUESTION_BANK,
  QUESTIONS,
} from '../data/questionBank';
import {
  exportBackupPayload,
  StorageStatus,
  validateAndPreviewBackupJson,
} from '../lib/storage';
import { AggregateStats, filterQuestions } from '../lib/stats';
import type {
  AppProgressState,
  BackupPayload,
  BackupPreview,
  QuestionFilterType,
} from '../types';
import { BlockRenderer } from '../components/BlockRenderer';

interface LibraryBackupPageProps {
  state: AppProgressState;
  stats: AggregateStats;
  storageStatus: StorageStatus;
  onOpenQuestionInStudy: (questionId: string) => void;
  onImportBackup: (payload: BackupPayload, mode: 'replace' | 'merge') => void;
  onResetAllProgress: () => void;
}

export const LibraryBackupPage: React.FC<LibraryBackupPageProps> = ({
  state,
  stats,
  storageStatus,
  onOpenQuestionInStudy,
  onImportBackup,
  onResetAllProgress,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<QuestionFilterType>('all');
  const [derivedTag, setDerivedTag] = useState<string>('all');
  const [expandedQuestionIds, setExpandedQuestionIds] = useState<Record<string, boolean>>({});

  // Backup import state
  const [importPreview, setImportPreview] = useState<BackupPreview | null>(null);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Reset confirmation state
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const [resetConfirmText, setResetConfirmText] = useState<string>('');

  const filteredQuestions = useMemo(
    () =>
      filterQuestions(QUESTIONS, stats, {
        filterType,
        derivedTag,
        searchQuery,
      }),
    [stats, filterType, derivedTag, searchQuery]
  );

  const handleExportJson = () => {
    const payload = exportBackupPayload(state);
    const jsonString = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const datePart = payload.exportedAt.slice(0, 10);
    a.href = url;
    a.download = `ccdv-f-progress-backup-${datePart}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportSuccessMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const preview = validateAndPreviewBackupJson(text);
      setImportPreview(preview);
    } catch {
      setImportPreview({
        isValid: false,
        errors: ['Không thể đọc file đã chọn. Tiến độ hiện tại vẫn an toàn.'],
      });
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleConfirmImport = (mode: 'replace' | 'merge') => {
    if (!importPreview?.isValid || !importPreview.payload) return;
    onImportBackup(importPreview.payload, mode);
    setImportPreview(null);
    setImportSuccessMsg(
      mode === 'replace'
        ? 'Đã khôi phục và thay thế toàn bộ dữ liệu tiến độ từ file sao lưu.'
        : 'Đã gộp dữ liệu từ file sao lưu vào tiến độ hiện tại thành công.'
    );
  };

  const toggleExpandQuestion = (qId: string) => {
    setExpandedQuestionIds((prev) => ({
      ...prev,
      [qId]: !prev[qId],
    }));
  };

  return (
    <div className="space-y-8">
      {/* Section 1: Backup, Restore & Dataset Integrity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Backup & Restore Panel */}
        <section className="lg:col-span-7 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <FileJson className="w-5 h-5 text-brand-500" />
                <span>Sao lưu & Khôi phục tiến độ (JSON)</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                Xuất/nhập toàn bộ lịch sử trả lời, chuỗi nhắc ôn SRS, câu đánh dấu, ghi chú cá nhân
                và lịch sử phiên thi thử.
              </p>
            </div>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                storageStatus.available
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>{storageStatus.available ? 'localStorage Sẵn sàng' : 'Lưu tạm RAM'}</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleExportJson}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-brand-600 hover:bg-brand-700 text-white shadow-xs transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Xuất bản sao lưu JSON</span>
            </button>

            <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 cursor-pointer transition-colors">
              <Upload className="w-4 h-4" />
              <span>Chọn file JSON để nhập...</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                onChange={handleFileChange}
                className="sr-only"
                aria-label="Chọn file sao lưu JSON để nhập"
              />
            </label>

            <button
              type="button"
              onClick={() => {
                setShowResetModal(true);
                setResetConfirmText('');
              }}
              className="ml-auto inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Xóa tiến độ</span>
            </button>
          </div>

          {/* Import Success Alert */}
          {importSuccessMsg && (
            <div
              role="status"
              className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs sm:text-sm text-emerald-900 dark:text-emerald-200 flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{importSuccessMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setImportSuccessMsg(null)}
                className="text-emerald-700 hover:text-emerald-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Import Validation & Preview Card */}
          {importPreview && (
            <div
              role="region"
              aria-label="Xem trước dữ liệu nhập"
              className={`p-4 rounded-xl border space-y-3 ${
                importPreview.isValid
                  ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800'
                  : 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800'
              }`}
            >
              {!importPreview.isValid ? (
                <div className="space-y-2 text-xs sm:text-sm text-rose-900 dark:text-rose-200">
                  <div className="font-bold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>File sao lưu không hợp lệ — Dữ liệu hiện tại được giữ nguyên</span>
                  </div>
                  <ul className="list-disc pl-5 space-y-1">
                    {importPreview.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => setImportPreview(null)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-700"
                  >
                    Đóng thông báo
                  </button>
                </div>
              ) : (
                <div className="space-y-3 text-xs sm:text-sm text-slate-800 dark:text-slate-200">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-blue-900 dark:text-blue-200 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-blue-600" />
                      <span>File sao lưu hợp lệ — Xem trước số bản ghi trước khi nhập</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setImportPreview(null)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-blue-100 dark:border-blue-900 text-xs">
                    <div>
                      <span className="text-slate-500">Ngân hàng:</span>{' '}
                      <strong className="font-mono">
                        {importPreview.courseId} (rev {importPreview.courseRevision})
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Số câu đã làm:</span>{' '}
                      <strong>{importPreview.counts?.answeredQuestionsCount} câu</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Tổng lượt chấm:</span>{' '}
                      <strong>{importPreview.counts?.totalAttemptsCount} lượt</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Câu đánh dấu:</span>{' '}
                      <strong>{importPreview.counts?.bookmarksCount}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Ghi chú:</span>{' '}
                      <strong>{importPreview.counts?.notesCount}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Lịch sử phiên:</span>{' '}
                      <strong>{importPreview.counts?.sessionsCount} phiên</strong>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={() => handleConfirmImport('merge')}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white"
                    >
                      Gộp với tiến độ hiện tại (Merge)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleConfirmImport('replace')}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-900"
                    >
                      Thay thế toàn bộ tiến độ hiện tại (Replace)
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Right: Source Metadata & Dataset Integrity Audit */}
        <section className="lg:col-span-5 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
              <span>Thông tin Nguồn & Kiểm định Dữ liệu</span>
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
              {DATASET_VALIDATION.isValid ? '110/110 Hợp lệ' : 'Có lỗi'}
            </span>
          </div>

          <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1.5">
            <div className="flex justify-between">
              <span>Mã khóa học & Phiên bản:</span>
              <strong className="font-mono text-slate-900 dark:text-slate-100">
                {QUESTION_BANK.id} (Revision {QUESTION_BANK.revision} • Schema{' '}
                {QUESTION_BANK.schemaVersion})
              </strong>
            </div>
            <div className="flex justify-between">
              <span>Nguồn trích xuất:</span>
              <a
                href={QUESTION_BANK.extraction.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-600 dark:text-brand-400 underline inline-flex items-center gap-1"
              >
                <span>T-Study ({QUESTION_BANK.extraction.sourceAuthor})</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="flex justify-between">
              <span>Ngày thu thập:</span>
              <strong>
                {QUESTION_BANK.extraction.retrievedDate} ({QUESTION_BANK.extraction.timezone})
              </strong>
            </div>
            <div className="flex justify-between">
              <span>Cơ cấu câu hỏi:</span>
              <strong>
                {DATASET_VALIDATION.totalQuestions} câu ({DATASET_VALIDATION.singleChoiceCount} chọn
                1 • {DATASET_VALIDATION.multipleChoiceCount} chọn nhiều)
              </strong>
            </div>
            <div className="flex justify-between">
              <span>8 câu chọn nhiều đáp án:</span>
              <strong className="font-mono">
                {DATASET_VALIDATION.multipleChoiceQuestions
                  .map((m) => `${m.id.replace('ccdv-f-', '')}(${m.correctOptionIds.map((c) => c.toUpperCase()).join(',')})`)
                  .join('; ')}
              </strong>
            </div>
          </div>

          <details className="text-xs text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-3">
            <summary className="font-semibold cursor-pointer text-slate-800 dark:text-slate-200">
              Ghi chú chuyển đổi từ dữ liệu gốc ({QUESTION_BANK.conversion.notes.length} mục)
            </summary>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              {QUESTION_BANK.conversion.notes.map((n, idx) => (
                <li key={idx}>{n}</li>
              ))}
            </ul>
          </details>
        </section>
      </div>

      {/* Section 2: Full-Text Searchable 110-Question Library */}
      <section className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Database className="w-5 h-5 text-brand-500" />
              <span>Thư viện toàn văn 110 câu hỏi (ccdv-f-q001 đến ccdv-f-q110)</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Tra cứu toàn văn đề bài, các phương án, lời giải và ghi chú nguồn. Mặc định ẩn đáp án
              trên từng thẻ cho đến khi bạn bấm Mở xem lời giải.
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            Đang hiển thị: <strong>{filteredQuestions.length}</strong> / 110 câu
          </span>
        </div>

        {/* Search & Filters */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm toàn văn trong 110 câu hỏi, lựa chọn, giải thích..."
              aria-label="Tìm kiếm toàn văn thư viện"
              className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="md:col-span-3">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as QuestionFilterType)}
              aria-label="Lọc thư viện theo trạng thái"
              className="w-full py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
            >
              <option value="all">Tất cả 110 câu hỏi</option>
              <option value="unanswered">Chưa làm ({stats.unansweredCount})</option>
              <option value="answered">Đã làm ({stats.answeredCount})</option>
              <option value="wrong_latest">Đang sai ({stats.wrongLatestCount})</option>
              <option value="bookmarked">Đã đánh dấu ({stats.bookmarkedCount})</option>
              <option value="multiple_choice">Câu chọn nhiều đáp án (8)</option>
              <option value="has_note">Có ghi chú cá nhân ({stats.notesCount})</option>
            </select>
          </div>

          <div className="md:col-span-3">
            <select
              value={derivedTag}
              onChange={(e) => setDerivedTag(e.target.value)}
              aria-label="Lọc thư viện theo nhãn học tập"
              className="w-full py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
            >
              <option value="all">Tất cả nhãn hỗ trợ học tập</option>
              {ALL_DERIVED_TAGS.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Library Items List */}
        {filteredQuestions.length === 0 ? (
          <div className="py-12 text-center text-slate-500 space-y-2">
            <p className="text-sm font-semibold">Không tìm thấy câu hỏi nào khớp với từ khóa</p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setFilterType('all');
                setDerivedTag('all');
              }}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-brand-600 text-white"
            >
              Xóa bộ lọc
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {filteredQuestions.map((q) => {
              const meta = stats.perQuestion[q.id];
              const isExpanded = Boolean(expandedQuestionIds[q.id]);
              const isMulti = q.interaction.type === 'multiple_choice';

              return (
                <div key={q.id} className="py-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 rounded font-mono text-xs font-bold bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                          {q.id}
                        </span>
                        <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                          {q.title}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                            isMulti
                              ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-300'
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {isMulti ? 'Chọn nhiều đáp án' : 'Chọn 1 đáp án'}
                        </span>

                        {meta?.isAnswered ? (
                          meta.isLatestAttemptCorrectUnassisted ? (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
                              ✓ Đã làm đúng
                            </span>
                          ) : meta.isLatestAttemptAssisted ? (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300">
                              Đã xem lời giải
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300">
                              ✗ Đang sai
                            </span>
                          )
                        ) : meta?.isViewed ? (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                            Đã xem (chưa làm)
                          </span>
                        ) : null}

                        {meta?.isBookmarked && (
                          <Bookmark className="w-3.5 h-3.5 text-brand-600 fill-current" />
                        )}
                      </div>

                      <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed break-words">
                        {extractBlockText(q.prompt)}
                      </p>

                      <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] text-slate-500">
                        <span>Nguồn: {q.source?.name || 'T-Study'}</span>
                        <span>•</span>
                        <span>Độ khó: Chưa phân loại</span>
                        {(q.derivedTags || []).map((t) => (
                          <span
                            key={t}
                            className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleExpandQuestion(q.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{isExpanded ? 'Ẩn chi tiết' : 'Xem lựa chọn & giải'}</span>
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenQuestionInStudy(q.id)}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white"
                      >
                        Làm câu này
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-3 text-xs sm:text-sm">
                      <div className="space-y-1.5">
                        {q.interaction.options.map((opt) => {
                          const isCorrect = q.interaction.correctOptionIds.includes(opt.id);
                          return (
                            <div
                              key={opt.id}
                              className={`p-2.5 rounded-lg border ${
                                isCorrect
                                  ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 font-medium'
                                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                              }`}
                            >
                              <span className="font-mono font-bold mr-2">
                                {opt.id.toUpperCase()}.
                              </span>
                              <span>{opt.label}</span>
                            </div>
                          );
                        })}
                      </div>

                      <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                        <div className="font-bold text-xs uppercase text-slate-500 mb-1.5">
                          Đáp án nguồn:{' '}
                          <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                            {q.interaction.correctOptionIds.map((x) => x.toUpperCase()).join(', ')}
                          </span>
                        </div>
                        <BlockRenderer blocks={q.explanation} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Explicit Confirmation Modal for Resetting All Progress */}
      {showResetModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-modal-title"
        >
          <div className="w-full max-w-md p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3
                  id="reset-modal-title"
                  className="text-base font-bold text-slate-900 dark:text-slate-100"
                >
                  Xác nhận xóa toàn bộ tiến độ học tập?
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Hành động này sẽ xóa toàn bộ {stats.totalAttemptsCount} lượt trả lời,{' '}
                  {stats.bookmarkedCount} đánh dấu, {stats.notesCount} ghi chú và{' '}
                  {state.sessionHistory.length} lịch sử phiên. Hãy xuất file JSON sao lưu trước nếu
                  cần.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="confirm-reset-input"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Nhập chữ <code className="font-mono font-bold text-rose-600">XOA</code> để xác nhận:
              </label>
              <input
                id="confirm-reset-input"
                type="text"
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                placeholder="Nhập XOA"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-mono"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-medium border border-slate-200 dark:border-slate-700"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={resetConfirmText.trim().toUpperCase() !== 'XOA'}
                onClick={() => {
                  onResetAllProgress();
                  setShowResetModal(false);
                }}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 text-white"
              >
                Xác nhận xóa sạch tiến độ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
