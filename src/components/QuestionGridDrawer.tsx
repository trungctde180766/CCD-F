import React from 'react';
import { Bookmark, Check, Eye, Flag, Grid, X } from 'lucide-react';
import type { QuestionProgressMeta } from '../lib/stats';

export interface QuestionGridItem {
  id: string;
  number: number;
  label: string;
  status: 'unanswered' | 'answered_pending' | 'correct' | 'wrong' | 'revealed' | 'viewed';
  isBookmarked?: boolean;
  isFlagged?: boolean;
}

interface QuestionGridDrawerProps {
  items: QuestionGridItem[];
  currentQuestionId: string;
  onSelectQuestion: (questionId: string) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  title?: string;
}

export function buildGridItemsForStudy(
  questionIds: string[],
  perQuestion: Record<string, QuestionProgressMeta>
): QuestionGridItem[] {
  return questionIds.map((id, idx) => {
    const meta = perQuestion[id];
    const numMatch = id.match(/q(\d+)$/);
    const num = numMatch ? parseInt(numMatch[1], 10) : idx + 1;

    let status: QuestionGridItem['status'] = 'unanswered';
    if (meta?.isAnswered) {
      if (meta.isLatestAttemptCorrectUnassisted) {
        status = 'correct';
      } else if (meta.isLatestAttemptAssisted) {
        status = 'revealed';
      } else {
        status = 'wrong';
      }
    } else if (meta?.isViewed) {
      status = 'viewed';
    }

    return {
      id,
      number: num,
      label: `${num}`,
      status,
      isBookmarked: meta?.isBookmarked,
    };
  });
}

export const QuestionGridDrawer: React.FC<QuestionGridDrawerProps> = ({
  items,
  currentQuestionId,
  onSelectQuestion,
  isOpenMobile,
  onCloseMobile,
  title = 'Bảng điều hướng câu hỏi',
}) => {
  const renderGridContent = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <Grid className="w-3.5 h-3.5 text-brand-500" />
          <span>{title} ({items.length})</span>
        </h3>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-600 dark:text-slate-400">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-emerald-100 dark:bg-emerald-900/70 border border-emerald-400 inline-block" />
          <span>Đúng tự lực</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-rose-100 dark:bg-rose-900/70 border border-rose-400 inline-block" />
          <span>Sai / Cần ôn</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-blue-100 dark:bg-blue-900/70 border border-blue-400 inline-block" />
          <span>Đã chọn / Đã xem</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 inline-block" />
          <span>Chưa làm</span>
        </div>
      </div>

      {/* Number Grid */}
      <div className="grid grid-cols-5 sm:grid-cols-6 lg:grid-cols-5 gap-1.5 max-h-[60vh] overflow-y-auto pr-1">
        {items.map((item) => {
          const isCurrent = item.id === currentQuestionId;
          let colorClass =
            'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700';

          if (item.status === 'correct') {
            colorClass =
              'bg-emerald-100/90 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800';
          } else if (item.status === 'wrong') {
            colorClass =
              'bg-rose-100/90 dark:bg-rose-950/80 text-rose-900 dark:text-rose-200 border-rose-300 dark:border-rose-800';
          } else if (item.status === 'revealed') {
            colorClass =
              'bg-amber-100/90 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-800';
          } else if (item.status === 'answered_pending' || item.status === 'viewed') {
            colorClass =
              'bg-blue-100/90 dark:bg-blue-950/80 text-blue-900 dark:text-blue-200 border-blue-300 dark:border-blue-800';
          }

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectQuestion(item.id);
                onCloseMobile();
              }}
              aria-current={isCurrent ? 'step' : undefined}
              title={`Câu ${item.number} (${item.id})`}
              className={`relative h-9 rounded-lg border text-xs font-mono font-semibold flex items-center justify-center transition-all focus:outline-none focus:ring-2 focus:ring-brand-500 ${colorClass} ${
                isCurrent ? 'ring-2 ring-brand-600 dark:ring-brand-400 font-bold scale-105 z-10' : ''
              }`}
            >
              <span>{item.label}</span>
              {/* Non-color status indicators */}
              {item.status === 'correct' && (
                <Check className="w-2.5 h-2.5 absolute bottom-0.5 right-0.5 text-emerald-700 dark:text-emerald-300" />
              )}
              {item.status === 'wrong' && (
                <X className="w-2.5 h-2.5 absolute bottom-0.5 right-0.5 text-rose-700 dark:text-rose-300" />
              )}
              {item.status === 'revealed' && (
                <Eye className="w-2.5 h-2.5 absolute bottom-0.5 right-0.5 text-amber-700 dark:text-amber-300" />
              )}
              {item.isFlagged && (
                <Flag className="w-2.5 h-2.5 absolute top-0.5 right-0.5 text-amber-600 fill-current" />
              )}
              {!item.isFlagged && item.isBookmarked && (
                <Bookmark className="w-2.5 h-2.5 absolute top-0.5 right-0.5 text-brand-600 fill-current" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar Panel */}
      <aside className="hidden lg:block w-72 shrink-0">
        <div className="sticky top-20 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          {renderGridContent()}
        </div>
      </aside>

      {/* Mobile Drawer Overlay */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex justify-end bg-slate-950/60 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <div className="w-80 max-w-[85vw] bg-white dark:bg-slate-900 h-full p-5 overflow-y-auto shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200 dark:border-slate-800">
                <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Điều hướng nhanh
                </span>
                <button
                  type="button"
                  onClick={onCloseMobile}
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                  aria-label="Đóng bảng câu hỏi"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              {renderGridContent()}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
