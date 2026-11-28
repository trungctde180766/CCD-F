import React, { useMemo, useState } from 'react';
import {
  Bookmark,
  Check,
  CheckCircle2,
  CheckSquare,
  Clock,
  Edit3,
  FolderPlus,
  Grid,
  Layers,
  Play,
  Plus,
  Save,
  Search,
  Shuffle,
  Square,
  Target,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import {
  ALL_DERIVED_TAGS,
  extractBlockText,
  QUESTIONS,
  QUESTIONS_BY_ID,
} from '../data/questionBank';
import { QUESTIONS_VI } from '../lib/bilingualAndRationale';
import type { AggregateStats } from '../lib/stats';
import type { CustomExamPack } from '../types';

type PickerQuickFilter =
  | 'all'
  | 'selected'
  | 'unanswered'
  | 'wrong_latest'
  | 'wrong_ever'
  | 'bookmarked'
  | 'multiple_choice';

export interface CustomPackDraftInput {
  id?: string;
  name: string;
  questionIds: string[];
  durationMinutes: number;
  targetScorePercent: number;
  shuffleQuestions: boolean;
}

interface CustomExamPackBuilderProps {
  packs: CustomExamPack[];
  stats: AggregateStats;
  bookmarks: Record<string, boolean>;
  onSavePack: (draft: CustomPackDraftInput) => CustomExamPack | null;
  onDeletePack: (packId: string) => void;
  onStartExamFromPack: (params: {
    title: string;
    questionIds: string[];
    durationMinutes: number;
    targetScorePercent: number;
    shuffleQuestions: boolean;
  }) => void;
}

export const CustomExamPackBuilder: React.FC<CustomExamPackBuilderProps> = ({
  packs,
  stats,
  bookmarks,
  onSavePack,
  onDeletePack,
  onStartExamFromPack,
}) => {
  const [editingPackId, setEditingPackId] = useState<string | null>(null);
  const [packName, setPackName] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [durationMinutes, setDurationMinutes] = useState<number>(30);
  const [targetScorePercent, setTargetScorePercent] = useState<number>(80);
  const [shuffleQuestions, setShuffleQuestions] = useState<boolean>(true);
  const [durationTouched, setDurationTouched] = useState<boolean>(false);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [quickFilter, setQuickFilter] = useState<PickerQuickFilter>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [rangeStart, setRangeStart] = useState<number>(1);
  const [rangeEnd, setRangeEnd] = useState<number>(30);
  const [showNumberGrid, setShowNumberGrid] = useState<boolean>(true);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const updateSelectedWithAutoDuration = (nextIds: string[]) => {
    const ordered = QUESTIONS.filter((q) => nextIds.includes(q.id)).map((q) => q.id);
    setSelectedIds(ordered);
    if (!durationTouched && ordered.length > 0) {
      setDurationMinutes(Math.max(5, Math.min(180, Math.ceil(ordered.length * 1.5))));
    }
  };

  const toggleQuestion = (qId: string) => {
    const next = selectedSet.has(qId)
      ? selectedIds.filter((id) => id !== qId)
      : [...selectedIds, qId];
    updateSelectedWithAutoDuration(next);
  };

  const filteredQuestions = useMemo(() => {
    const qLower = searchQuery.trim().toLowerCase();

    return QUESTIONS.filter((q) => {
      const qStat = stats.perQuestion[q.id];

      if (quickFilter === 'selected' && !selectedSet.has(q.id)) return false;
      if (quickFilter === 'unanswered' && qStat?.isAnswered) return false;
      if (quickFilter === 'wrong_latest' && !qStat?.isCurrentlyWrong) return false;
      if (quickFilter === 'wrong_ever' && !qStat?.wasEverWrong) return false;
      if (quickFilter === 'bookmarked' && !bookmarks[q.id]) return false;
      if (quickFilter === 'multiple_choice' && q.interaction.type !== 'multiple_choice') {
        return false;
      }

      if (selectedTag !== 'all' && !(q.derivedTags || []).includes(selectedTag)) {
        return false;
      }

      if (qLower) {
        const vi = QUESTIONS_VI[q.id];
        const numStr = String(q.number ?? '');
        const paddedNum = numStr.padStart(3, '0');
        const haystack = [
          q.id,
          q.title,
          `câu ${numStr}`,
          `#${numStr}`,
          `#${paddedNum}`,
          numStr,
          extractBlockText(q.prompt),
          vi?.promptVi || '',
          vi?.memoryKeyword?.cueVi || '',
          vi?.memoryKeyword?.answerKeyword || '',
          ...(q.derivedTags || []),
        ]
          .join(' ')
          .toLowerCase();

        if (!haystack.includes(qLower)) return false;
      }

      return true;
    });
  }, [searchQuery, quickFilter, selectedTag, selectedSet, stats.perQuestion, bookmarks]);

  const handleSelectFiltered = () => {
    const merged = Array.from(new Set([...selectedIds, ...filteredQuestions.map((q) => q.id)]));
    updateSelectedWithAutoDuration(merged);
  };

  const handleDeselectFiltered = () => {
    const removeSet = new Set(filteredQuestions.map((q) => q.id));
    const remaining = selectedIds.filter((id) => !removeSet.has(id));
    updateSelectedWithAutoDuration(remaining);
  };

  const handleAddRange = () => {
    const lo = Math.max(1, Math.min(QUESTIONS.length, Math.min(rangeStart, rangeEnd)));
    const hi = Math.max(1, Math.min(QUESTIONS.length, Math.max(rangeStart, rangeEnd)));
    const rangeIds = QUESTIONS.filter((q) => (q.number ?? 0) >= lo && (q.number ?? 0) <= hi).map(
      (q) => q.id
    );
    const merged = Array.from(new Set([...selectedIds, ...rangeIds]));
    updateSelectedWithAutoDuration(merged);
  };

  const handleLoadPackForEdit = (pack: CustomExamPack) => {
    setEditingPackId(pack.id);
    setPackName(pack.name);
    setSelectedIds([...pack.questionIds]);
    setDurationMinutes(pack.durationMinutes);
    setTargetScorePercent(pack.targetScorePercent);
    setShuffleQuestions(pack.shuffleQuestions);
    setDurationTouched(true);
    setSavedNotice(null);
  };

  const handleResetBuilder = () => {
    setEditingPackId(null);
    setPackName('');
    setSelectedIds([]);
    setDurationMinutes(30);
    setTargetScorePercent(80);
    setShuffleQuestions(true);
    setDurationTouched(false);
    setSavedNotice(null);
  };

  const showNotice = (msg: string) => {
    setSavedNotice(msg);
    window.setTimeout(() => {
      setSavedNotice((cur) => (cur === msg ? null : cur));
    }, 3500);
  };

  const handleSaveOnly = () => {
    if (selectedIds.length === 0) return;
    const saved = onSavePack({
      id: editingPackId || undefined,
      name: packName.trim() || `Gói đề tự chọn #${packs.length + 1} (${selectedIds.length} câu)`,
      questionIds: selectedIds,
      durationMinutes,
      targetScorePercent,
      shuffleQuestions,
    });
    if (saved) {
      setEditingPackId(saved.id);
      setPackName(saved.name);
      showNotice(`Đã lưu gói "${saved.name}" (${saved.questionIds.length} câu hỏi).`);
    }
  };

  const handleSaveAndStart = () => {
    if (selectedIds.length === 0) return;
    const resolvedName =
      packName.trim() || `Gói đề tự chọn #${packs.length + 1} (${selectedIds.length} câu)`;
    const saved = onSavePack({
      id: editingPackId || undefined,
      name: resolvedName,
      questionIds: selectedIds,
      durationMinutes,
      targetScorePercent,
      shuffleQuestions,
    });
    onStartExamFromPack({
      title: saved?.name || resolvedName,
      questionIds: selectedIds,
      durationMinutes,
      targetScorePercent,
      shuffleQuestions,
    });
  };

  const handleStartWithoutSaving = () => {
    if (selectedIds.length === 0) return;
    const resolvedName =
      packName.trim() || `Thi thử tự chọn (${selectedIds.length} câu / ${durationMinutes} phút)`;
    onStartExamFromPack({
      title: resolvedName,
      questionIds: selectedIds,
      durationMinutes,
      targetScorePercent,
      shuffleQuestions,
    });
  };

  const formatQuestionPreviewNumbers = (ids: string[]) => {
    const nums = ids
      .map((id) => QUESTIONS_BY_ID[id]?.number)
      .filter((n): n is number => typeof n === 'number')
      .sort((a, b) => a - b);
    if (nums.length <= 10) {
      return nums.map((n) => `#${n}`).join(', ');
    }
    return `${nums
      .slice(0, 10)
      .map((n) => `#${n}`)
      .join(', ')} ... (+${nums.length - 10} câu)`;
  };

  return (
    <div className="space-y-6">
      {/* Saved Custom Exam Packs */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Gói đề thi thử đã lưu ({packs.length})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Các gói câu hỏi bạn tự chọn sẽ được lưu theo tài khoản để bấm thi lại bất cứ lúc nào.
              </p>
            </div>
          </div>
          {editingPackId && (
            <button
              type="button"
              onClick={handleResetBuilder}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tạo gói mới khác</span>
            </button>
          )}
        </div>

        {packs.length === 0 ? (
          <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 text-xs sm:text-sm text-slate-600 dark:text-slate-400 text-center">
            Chưa có gói đề tự chọn nào. Hãy tích chọn các câu hỏi bạn muốn ở khung bên dưới rồi bấm{' '}
            <strong>Lưu thành gói đề</strong> hoặc <strong>Lưu &amp; Thi thử ngay</strong>!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {packs.map((pack) => {
              const isBeingEdited = editingPackId === pack.id;
              return (
                <div
                  key={pack.id}
                  className={`p-4 rounded-xl border transition-colors flex flex-col justify-between gap-3 ${
                    isBeingEdited
                      ? 'border-brand-500 bg-brand-50/40 dark:bg-brand-950/20'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 leading-snug">
                        {pack.name}
                      </h4>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 shrink-0">
                        {pack.questionIds.length} câu
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-600 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {pack.durationMinutes} phút
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Target className="w-3.5 h-3.5" />
                        Mục tiêu {pack.targetScorePercent}%
                      </span>
                      <span>{pack.shuffleQuestions ? '• Có đảo câu' : '• Giữ thứ tự'}</span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 break-words">
                      Câu: {formatQuestionPreviewNumbers(pack.questionIds)}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-200/70 dark:border-slate-700/60">
                    <button
                      type="button"
                      onClick={() =>
                        onStartExamFromPack({
                          title: pack.name,
                          questionIds: pack.questionIds,
                          durationMinutes: pack.durationMinutes,
                          targetScorePercent: pack.targetScorePercent,
                          shuffleQuestions: pack.shuffleQuestions,
                        })
                      }
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white transition-colors"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Thi ngay</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleLoadPackForEdit(pack)}
                      className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                      title="Chỉnh sửa danh sách câu hỏi và cấu hình gói này"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Sửa</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Xóa gói đề "${pack.name}"?`)) {
                          if (editingPackId === pack.id) {
                            handleResetBuilder();
                          }
                          onDeletePack(pack.id);
                        }
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-semibold border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100"
                      title="Xóa gói đề này"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pack Builder Panel */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-100 dark:bg-brand-950/70 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                {editingPackId
                  ? 'Đang chỉnh sửa gói đề thi thử'
                  : 'Chọn từng câu hỏi để tạo gói thi thử'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Bấm chọn nhanh trên lưới số 1–110 hoặc tìm kiếm &amp; tích từng câu bên dưới, sau đó lưu
                thành gói đề hoặc vào thi thử ngay.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-brand-100 text-brand-800 dark:bg-brand-950/80 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
              Đã chọn: {selectedIds.length} / {QUESTIONS.length} câu
            </span>
            {editingPackId && (
              <button
                type="button"
                onClick={handleResetBuilder}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <X className="w-3.5 h-3.5" />
                <span>Hủy sửa</span>
              </button>
            )}
          </div>
        </div>

        {savedNotice && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 text-xs sm:text-sm font-semibold text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{savedNotice}</span>
          </div>
        )}

        {/* Pack Metadata Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
          <div className="md:col-span-5 space-y-1">
            <label
              htmlFor="custom-pack-name"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Tên gói đề thi thử
            </label>
            <input
              id="custom-pack-name"
              type="text"
              value={packName}
              onChange={(e) => setPackName(e.target.value)}
              placeholder={`VD: Gói ôn câu khó & Batch API (${selectedIds.length || 20} câu)`}
              className="w-full py-2 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="md:col-span-2 space-y-1">
            <label
              htmlFor="custom-pack-duration"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Thời gian (phút)
            </label>
            <input
              id="custom-pack-duration"
              type="number"
              min={1}
              max={240}
              value={durationMinutes}
              onChange={(e) => {
                setDurationTouched(true);
                setDurationMinutes(
                  Math.max(1, Math.min(240, parseInt(e.target.value, 10) || 1))
                );
              }}
              className="w-full py-2 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-mono font-bold"
            />
          </div>

          <div className="md:col-span-2 space-y-1">
            <label
              htmlFor="custom-pack-target"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Mục tiêu (%)
            </label>
            <input
              id="custom-pack-target"
              type="number"
              min={10}
              max={100}
              value={targetScorePercent}
              onChange={(e) =>
                setTargetScorePercent(
                  Math.max(10, Math.min(100, parseInt(e.target.value, 10) || 80))
                )
              }
              className="w-full py-2 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-mono font-bold"
            />
          </div>

          <div className="md:col-span-3 flex items-end pb-1">
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={shuffleQuestions}
                onChange={(e) => setShuffleQuestions(e.target.checked)}
                className="w-4 h-4 text-brand-600 rounded border-slate-300"
              />
              <Shuffle className="w-3.5 h-3.5 text-brand-500" />
              <span>Đảo thứ tự câu khi thi</span>
            </label>
          </div>
        </div>

        {/* Quick Range Picker + Number Grid Toggle */}
        <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                Chọn nhanh khoảng câu:
              </span>
              <input
                type="number"
                aria-label="Từ câu số"
                min={1}
                max={110}
                value={rangeStart}
                onChange={(e) =>
                  setRangeStart(Math.max(1, Math.min(110, parseInt(e.target.value, 10) || 1)))
                }
                className="w-16 py-1 px-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs font-bold"
              />
              <span className="text-slate-500">đến</span>
              <input
                type="number"
                aria-label="Đến câu số"
                min={1}
                max={110}
                value={rangeEnd}
                onChange={(e) =>
                  setRangeEnd(Math.max(1, Math.min(110, parseInt(e.target.value, 10) || 1)))
                }
                className="w-16 py-1 px-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs font-bold"
              />
              <button
                type="button"
                onClick={handleAddRange}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-semibold bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Chọn khoảng</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowNumberGrid((v) => !v)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100"
            >
              <Grid className="w-3.5 h-3.5" />
              <span>{showNumberGrid ? 'Ẩn lưới số 1–110' : 'Hiện lưới số 1–110'}</span>
            </button>
          </div>

          {showNumberGrid && (
            <div className="space-y-2">
              <div className="grid grid-cols-10 sm:grid-cols-11 gap-1.5">
                {QUESTIONS.map((q) => {
                  const isPicked = selectedSet.has(q.id);
                  const qStat = stats.perQuestion[q.id];
                  const isWrong = Boolean(qStat?.isCurrentlyWrong);
                  const isBookmarked = Boolean(bookmarks[q.id]);
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => toggleQuestion(q.id)}
                      title={`Câu ${q.number} (${q.id})${isPicked ? ' — Đã chọn vào gói' : ''}${
                        isWrong ? ' • Đang sai' : ''
                      }${isBookmarked ? ' • Đã đánh dấu' : ''}`}
                      className={`relative h-8 rounded-lg text-xs font-mono font-bold border transition-all ${
                        isPicked
                          ? 'bg-brand-600 text-white border-brand-600 shadow-2xs scale-[1.02]'
                          : isWrong
                          ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900 hover:border-brand-400'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-brand-400'
                      }`}
                    >
                      {q.number}
                      {isBookmarked && (
                        <span
                          className={`absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full ${
                            isPicked ? 'bg-amber-300' : 'bg-amber-500'
                          }`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-brand-600 inline-block" /> Đã chọn vào gói
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-rose-100 border border-rose-300 inline-block" />{' '}
                  Câu đang sai
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Đã đánh dấu
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Search & Filter Controls for Detailed Question Picker */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm theo số câu (VD: 87), nội dung tiếng Việt/Anh, từ khóa (Batch, MCP, HIPAA)..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm"
              />
            </div>

            <select
              aria-label="Lọc theo chủ đề"
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              className="py-2 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm"
            >
              <option value="all">Tất cả chủ đề</option>
              {ALL_DERIVED_TAGS.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Filter Chips + Bulk Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'all', label: `Tất cả (${QUESTIONS.length})` },
                  { id: 'selected', label: `Đã chọn (${selectedIds.length})` },
                  { id: 'unanswered', label: `Chưa làm (${stats.unansweredCount})` },
                  { id: 'wrong_latest', label: `Đang sai (${stats.wrongLatestCount})` },
                  { id: 'wrong_ever', label: `Từng sai (${stats.everWrongCount})` },
                  { id: 'bookmarked', label: `Đánh dấu (${stats.bookmarkedCount})` },
                  { id: 'multiple_choice', label: 'Chọn nhiều (8)' },
                ] as Array<{ id: PickerQuickFilter; label: string }>
              ).map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setQuickFilter(chip.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                    quickFilter === chip.id
                      ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={handleSelectFiltered}
                disabled={filteredQuestions.length === 0}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 disabled:opacity-40"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>Chọn tất cả đang lọc ({filteredQuestions.length})</span>
              </button>
              <button
                type="button"
                onClick={handleDeselectFiltered}
                disabled={filteredQuestions.length === 0}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40"
              >
                <Square className="w-3.5 h-3.5" />
                <span>Bỏ chọn đang lọc</span>
              </button>
              {selectedIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => updateSelectedWithAutoDuration([])}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Xóa hết đã chọn</span>
                </button>
              )}
            </div>
          </div>

          {/* Scrollable Detailed Question List */}
          <div className="max-h-[420px] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-200/80 dark:divide-slate-800">
            {filteredQuestions.length === 0 ? (
              <div className="p-6 text-center text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Không tìm thấy câu hỏi nào khớp với bộ lọc hiện tại.
              </div>
            ) : (
              filteredQuestions.map((q) => {
                const isPicked = selectedSet.has(q.id);
                const qStat = stats.perQuestion[q.id];
                const vi = QUESTIONS_VI[q.id];
                const promptVi = vi?.promptVi || extractBlockText(q.prompt);
                const promptEn = extractBlockText(q.prompt);
                const isMulti = q.interaction.type === 'multiple_choice';

                return (
                  <label
                    key={q.id}
                    className={`flex items-start gap-3 p-3.5 cursor-pointer transition-colors ${
                      isPicked
                        ? 'bg-brand-50/60 dark:bg-brand-950/25'
                        : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isPicked}
                      onChange={() => toggleQuestion(q.id)}
                      aria-label={`Chọn Câu ${q.number} (${q.id})`}
                      className="mt-1 w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 shrink-0"
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-slate-200/80 dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                          Câu {q.number}
                        </span>
                        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          {q.id}
                        </span>
                        {isMulti && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300">
                            Chọn nhiều
                          </span>
                        )}
                        {qStat?.isLatestAttemptCorrectUnassisted && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            <Check className="w-3 h-3" /> Đúng
                          </span>
                        )}
                        {qStat?.isCurrentlyWrong && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                            <XCircle className="w-3 h-3" /> Đang sai
                          </span>
                        )}
                        {bookmarks[q.id] && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                            <Bookmark className="w-3 h-3 fill-current" /> Đánh dấu
                          </span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-slate-900 dark:text-slate-100 line-clamp-2 leading-relaxed">
                        {promptVi}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                        {promptEn}
                      </p>
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>

        {/* Action Bar */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-600 dark:text-slate-400">
            {selectedIds.length > 0 ? (
              <span>
                Sẵn sàng tạo gói{' '}
                <strong className="text-slate-900 dark:text-slate-100">
                  {selectedIds.length} câu
                </strong>{' '}
                • <strong>{durationMinutes} phút</strong> • mục tiêu{' '}
                <strong>{targetScorePercent}%</strong>
              </span>
            ) : (
              <span>Hãy chọn ít nhất 1 câu hỏi ở trên để lưu thành gói hoặc thi thử.</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSaveOnly}
              disabled={selectedIds.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold border border-indigo-300 dark:border-indigo-700 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 disabled:opacity-40 transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>{editingPackId ? 'Cập nhật gói đề' : 'Lưu thành gói đề'}</span>
            </button>

            <button
              type="button"
              onClick={handleStartWithoutSaving}
              disabled={selectedIds.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold border border-slate-300 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 disabled:opacity-40 transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Thi ngay (không lưu)</span>
            </button>

            <button
              type="button"
              onClick={handleSaveAndStart}
              disabled={selectedIds.length === 0}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 text-white shadow-xs transition-colors"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Lưu &amp; Thi thử ngay ({selectedIds.length} câu)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
