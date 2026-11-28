import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Database,
  Download,
  ExternalLink,
  Eye,
  FileJson,
  Info,
  Play,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import { type CourseBundle, extractBlockText } from '../data/questionBank';
import {
  exportBackupPayload,
  StorageStatus,
  validateAndPreviewBackupJson,
} from '../lib/storage';
import type { AggregateStats } from '../lib/stats';
import type { AppProgressState, BackupPayload, BackupPreview } from '../types';
import { BlockRenderer } from '../components/BlockRenderer';

interface LibraryBackupPageProps {
  course: CourseBundle;
  state: AppProgressState;
  stats: AggregateStats;
  storageStatus: StorageStatus;
  onImportBackup: (payload: BackupPayload, mode: 'merge' | 'replace') => void;
  onResetCourseProgress: () => void;
  onOpenQuestionInStudy: (questionId: string) => void;
}

export const LibraryBackupPage: React.FC<LibraryBackupPageProps> = ({
  course,
  state,
  stats,
  storageStatus,
  onImportBackup,
  onResetCourseProgress,
  onOpenQuestionInStudy,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'single_choice' | 'multiple_choice'>('all');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [importToast, setImportToast] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');

  const filteredQuestions = useMemo(() => {
    const qLower = searchQuery.trim().toLowerCase();
    return course.questions.filter((q) => {
      if (typeFilter !== 'all' && q.interaction.type !== typeFilter) return false;
      if (selectedTag !== 'all' && !(q.derivedTags || []).includes(selectedTag)) return false;
      if (!qLower) return true;
      const haystack = [
        q.id,
        q.title,
        `câu ${q.number}`,
        extractBlockText(q.prompt),
        q.interaction.options.map((o) => o.label).join(' '),
        extractBlockText(q.explanation),
        ...(q.derivedTags || []),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(qLower);
    });
  }, [course.questions, searchQuery, selectedTag, typeFilter]);

  const handleExportJson = () => {
    const payload = exportBackupPayload(state);
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-${course.id}-rev${course.bank.revision}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setImportToast(`Đã xuất file sao lưu tiến độ cho ${course.shortCode} (${course.questions.length} câu).`);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportToast(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      const result = validateAndPreviewBackupJson(text, course.id);
      setPreview(result);
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  };

  const handleApplyImport = (mode: 'merge' | 'replace') => {
    if (!preview?.isValid || !preview.payload) return;
    onImportBackup(preview.payload, mode);
    setPreview(null);
    setImportToast(
      mode === 'merge'
        ? `Đã gộp dữ liệu sao lưu vào tiến độ ${course.shortCode} hiện tại.`
        : `Đã khôi phục (thay thế) tiến độ ${course.shortCode} từ file sao lưu.`
    );
  };

  const handleConfirmReset = () => {
    if (resetConfirmText.trim().toUpperCase() !== 'XOA') return;
    onResetCourseProgress();
    setShowResetConfirm(false);
    setResetConfirmText('');
    setImportToast(`Đã xóa toàn bộ tiến độ bộ đề ${course.shortCode}.`);
  };

  return (
    <div className="space-y-6">
      {/* Top 2-Column Grid: Backup/Restore + Source & Dataset Validation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Backup & Restore Card */}
        <section className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <FileJson className="w-5 h-5 text-brand-500" />
                <span>Sao lưu &amp; Khôi phục tiến độ ({course.shortCode})</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Xuất/nhập lịch sử trả lời, chuỗi nhắc ôn SRS, đánh dấu, ghi chú, gói đề tự chọn và
                lịch sử phiên thi của riêng bộ <strong>{course.shortCode}</strong>.
              </p>
            </div>
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${
                storageStatus.available
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
              }`}
            >
              {storageStatus.available ? 'localStorage sẵn sàng' : 'Chỉ lưu tạm RAM'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportJson}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-brand-600 hover:bg-brand-700 text-white shadow-xs transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Xuất sao lưu JSON</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleFileChange}
              className="hidden"
              aria-label="Chọn file JSON sao lưu"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 transition-colors"
            >
              <Upload className="w-4 h-4" />
              <span>Nhập file JSON...</span>
            </button>

            <button
              type="button"
              onClick={() => setShowResetConfirm((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold border border-rose-200 dark:border-rose-900 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Xóa tiến độ bộ này</span>
            </button>
          </div>

          {importToast && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs sm:text-sm font-medium text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{importToast}</span>
            </div>
          )}

          {/* Import Preview / Validation Error */}
          {preview && (
            <div
              className={`p-4 rounded-xl border text-xs sm:text-sm space-y-3 ${
                preview.isValid
                  ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800'
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800'
              }`}
            >
              {preview.isValid && preview.counts ? (
                <>
                  <div className="font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>
                      File sao lưu hợp lệ ({preview.courseId} • Rev {preview.courseRevision})
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-xs text-slate-700 dark:text-slate-300">
                    <div>• Đã xem: {preview.counts.viewedCount} câu</div>
                    <div>• Đã trả lời: {preview.counts.answeredQuestionsCount} câu</div>
                    <div>• Tổng lượt chấm: {preview.counts.totalAttemptsCount}</div>
                    <div>• Phiên thi/luyện: {preview.counts.sessionsCount}</div>
                    <div>• Đánh dấu: {preview.counts.bookmarksCount}</div>
                    <div>• Ghi chú: {preview.counts.notesCount}</div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleApplyImport('merge')}
                      className="px-3.5 py-2 rounded-lg text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white"
                    >
                      Gộp vào tiến độ hiện tại
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyImport('replace')}
                      className="px-3.5 py-2 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      Thay thế hoàn toàn
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreview(null)}
                      className="px-3 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200/60"
                    >
                      Hủy
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-1.5 text-rose-800 dark:text-rose-200">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>File sao lưu không hợp lệ — Dữ liệu hiện tại được giữ nguyên!</span>
                  </div>
                  <ul className="list-disc pl-5 text-xs space-y-0.5">
                    {preview.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => setPreview(null)}
                    className="mt-1 px-3 py-1 rounded-lg text-xs font-semibold bg-rose-100 dark:bg-rose-900/60"
                  >
                    Đóng
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Reset Confirmation */}
          {showResetConfirm && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 space-y-2.5 text-xs">
              <p className="font-bold text-rose-900 dark:text-rose-200">
                Xác nhận xóa toàn bộ tiến độ bộ đề {course.shortCode} (không ảnh hưởng bộ đề kia):
              </p>
              <p className="text-rose-800 dark:text-rose-300">
                Nhập chính xác chữ <code>XOA</code> vào ô dưới để xác nhận xóa:
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={resetConfirmText}
                  onChange={(e) => setResetConfirmText(e.target.value)}
                  placeholder="Nhập XOA"
                  className="px-3 py-1.5 rounded-lg border border-rose-300 dark:border-rose-700 bg-white dark:bg-slate-900 font-mono text-xs"
                />
                <button
                  type="button"
                  disabled={resetConfirmText.trim().toUpperCase() !== 'XOA'}
                  onClick={handleConfirmReset}
                  className="px-3.5 py-1.5 rounded-lg font-bold bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white"
                >
                  Xác nhận xóa
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowResetConfirm(false);
                    setResetConfirmText('');
                  }}
                  className="px-3 py-1.5 rounded-lg font-medium text-slate-600 dark:text-slate-300"
                >
                  Hủy
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Source & Dataset Validation Card */}
        <section className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
              <span>Thông tin Ngân hàng &amp; Kiểm định</span>
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
              {course.validation.isValid
                ? `${course.validation.totalQuestions}/${course.validation.totalQuestions} Hợp lệ`
                : 'Có cảnh báo'}
            </span>
          </div>

          <div className="space-y-1.5 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Khóa học &amp; Phiên bản:</span>
              <strong className="font-mono">
                {course.bank.id} (Rev {course.bank.revision} • Schema {course.bank.schemaVersion})
              </strong>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Cơ cấu câu hỏi:</span>
              <strong>
                {course.validation.totalQuestions} câu ({course.validation.singleChoiceCount} chọn 1 •{' '}
                {course.validation.multipleChoiceCount} chọn nhiều)
              </strong>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">Dải mã câu hỏi:</span>
              <strong className="font-mono">
                {course.questions[0]?.id} → {course.questions[course.questions.length - 1]?.id}
              </strong>
            </div>
            {course.showSourceAttribution && course.bank.extraction && (
              <>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Nguồn tham khảo:</span>
                  <a
                    href={course.bank.extraction.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-brand-600 dark:text-brand-400 hover:underline"
                  >
                    <span>{course.bank.extraction.sourceAuthor}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Ngày thu thập:</span>
                  <strong>
                    {course.bank.extraction.retrievedDate} ({course.bank.extraction.timezone})
                  </strong>
                </div>
              </>
            )}
          </div>

          {course.bank.conversion?.notes && course.bank.conversion.notes.length > 0 && (
            <details className="pt-2 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
              <summary className="cursor-pointer font-semibold text-slate-800 dark:text-slate-200">
                Ghi chú bộ dữ liệu ({course.bank.conversion.notes.length} mục)
              </summary>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                {course.bank.conversion.notes.map((n, idx) => (
                  <li key={idx}>{n}</li>
                ))}
              </ul>
            </details>
          )}
        </section>
      </div>

      {/* Full-Text Searchable Question Library */}
      <section className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Database className="w-5 h-5 text-brand-500" />
              <span>
                Thư viện toàn văn {course.questions.length} câu hỏi ({course.shortCode})
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Tra cứu toàn văn đề bài, các phương án và lời giải. Đáp án mặc định ẩn cho tới khi bạn
              bấm Mở xem đáp án.
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
            Đang hiển thị: <strong>{filteredQuestions.length}</strong> / {course.questions.length} câu
          </span>
        </div>

        {/* Search & Filter Row */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Tìm mã câu (vd: ${course.id}-q014), đề bài, lựa chọn hoặc lời giải...`}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm"
            />
          </div>

          <div className="md:col-span-3">
            <select
              aria-label="Lọc loại câu hỏi"
              value={typeFilter}
              onChange={(e) =>
                setTypeFilter(e.target.value as 'all' | 'single_choice' | 'multiple_choice')
              }
              className="w-full py-2 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm"
            >
              <option value="all">Tất cả ({course.questions.length} câu)</option>
              <option value="single_choice">
                Chọn 1 đáp án ({course.validation.singleChoiceCount})
              </option>
              <option value="multiple_choice">
                Chọn nhiều đáp án ({course.validation.multipleChoiceCount})
              </option>
            </select>
          </div>

          <div className="md:col-span-3">
            <select
              aria-label="Lọc theo nhãn hỗ trợ học tập"
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              className="w-full py-2 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm"
            >
              <option value="all">Tất cả nhãn hỗ trợ học tập</option>
              {course.derivedTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Questions List */}
        {filteredQuestions.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
            Không tìm thấy câu hỏi nào khớp với bộ lọc hiện tại.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredQuestions.map((q) => {
              const isExpanded = Boolean(expandedIds[q.id]);
              const isRevealed = Boolean(revealedIds[q.id]);
              const meta = stats.perQuestion[q.id];
              const isMulti = q.interaction.type === 'multiple_choice';
              const hasCallout = q.explanation.some((b) => b.type === 'callout');

              return (
                <div
                  key={q.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/60 space-y-2.5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded font-mono text-xs font-bold bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                        {q.id}
                      </span>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {q.title}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          isMulti
                            ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-300'
                            : 'bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                        }`}
                      >
                        {isMulti ? 'Chọn nhiều đáp án' : 'Chọn 1 đáp án'}
                      </span>
                      {hasCallout && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                          <Info className="w-3 h-3" />
                          Có ghi chú nguồn
                        </span>
                      )}
                      {meta?.isLatestAttemptCorrectUnassisted && (
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
                          ✓ Đã làm đúng
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedIds((prev) => ({ ...prev, [q.id]: !prev[q.id] }))
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{isExpanded ? 'Thu gọn' : 'Xem chi tiết'}</span>
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenQuestionInStudy(q.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Làm câu này</span>
                      </button>
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 line-clamp-2 break-words">
                    {extractBlockText(q.prompt)}
                  </p>

                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                    <span>Độ khó: {q.difficulty === 'unspecified' ? 'Chưa phân loại' : q.difficulty}</span>
                    <span>•</span>
                    {(q.derivedTags || []).map((t) => (
                      <span
                        key={t}
                        className="px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                      >
                        {t}
                      </span>
                    ))}
                  </div>

                  {isExpanded && (
                    <div className="pt-3 mt-2 border-t border-slate-200 dark:border-slate-800 space-y-3">
                      <BlockRenderer blocks={q.prompt} className="text-sm" />
                      <ul className="space-y-1.5 text-xs sm:text-sm">
                        {q.interaction.options.map((opt) => {
                          const isCorrect =
                            isRevealed && q.interaction.correctOptionIds.includes(opt.id);
                          return (
                            <li
                              key={opt.id}
                              className={`p-2.5 rounded-lg border ${
                                isCorrect
                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 font-semibold text-emerald-900 dark:text-emerald-100'
                                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                              }`}
                            >
                              <strong className="font-mono mr-1.5">{opt.id.toUpperCase()}.</strong>
                              {opt.label}
                            </li>
                          );
                        })}
                      </ul>

                      {!isRevealed ? (
                        <button
                          type="button"
                          onClick={() => setRevealedIds((prev) => ({ ...prev, [q.id]: true }))}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 text-white"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Mở xem đáp án &amp; giải thích</span>
                        </button>
                      ) : (
                        <div className="p-3.5 rounded-xl bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-3">
                          <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                            Đáp án đúng:{' '}
                            <span className="font-mono">
                              {q.interaction.correctOptionIds.map((id) => id.toUpperCase()).join(', ')}
                            </span>
                          </div>
                          <BlockRenderer blocks={q.explanation} className="text-xs sm:text-sm" />
                          {q.optionExplanations && q.optionExplanations.length > 0 && (
                            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                              <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                Giải thích theo từng lựa chọn:
                              </div>
                              {q.optionExplanations.map((oe) => (
                                <div key={oe.optionId} className="text-xs space-y-0.5">
                                  <strong className="font-mono">{oe.optionId.toUpperCase()}:</strong>
                                  <BlockRenderer blocks={oe.content} className="text-xs pl-3" />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
