import { extractBlockText } from '../data/questionBank';
import questionsViJson from '../data/questions.vi.json';
import type { ContentBlock, Question, QuestionOption } from '../types';

export type LanguageDisplayMode = 'en' | 'bilingual' | 'vi';

export interface MemoryKeywordHook {
  cueVi: string;
  answerKeyword: string;
  roteFormula: string;
}

export interface QuestionVietnameseTranslation {
  promptVi: string;
  optionsVi: Record<string, string>;
  explanationVi: string;
  optionRationalesVi: Record<string, string>;
  memoryKeyword?: MemoryKeywordHook;
}

export const QUESTIONS_VI: Record<string, QuestionVietnameseTranslation> =
  questionsViJson as Record<string, QuestionVietnameseTranslation>;

export function hasVietnameseTranslation(questionId: string): boolean {
  return Boolean(QUESTIONS_VI[questionId]);
}

const LANG_MODE_STORAGE_KEY = 'ccdv_f_lang_mode_v1';

export function loadLanguageDisplayMode(): LanguageDisplayMode {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return 'bilingual';
    const saved = window.localStorage.getItem(LANG_MODE_STORAGE_KEY);
    if (saved === 'en' || saved === 'bilingual' || saved === 'vi') return saved;
    return 'bilingual';
  } catch {
    return 'bilingual';
  }
}

export function saveLanguageDisplayMode(mode: LanguageDisplayMode): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(LANG_MODE_STORAGE_KEY, mode);
  } catch {
    // ignore
  }
}

/**
 * Returns the complete, fluent Vietnamese translation of a question's prompt.
 */
export function getVietnamesePromptSummary(question: Question): string {
  const entry = QUESTIONS_VI[question.id];
  const isMulti = question.interaction.type === 'multiple_choice';
  const prefix = isMulti
    ? '[Câu hỏi chọn NHIỀU đáp án] '
    : '[Câu hỏi chọn 1 đáp án] ';

  if (entry?.promptVi) {
    return `${prefix}${entry.promptVi}`;
  }
  return `${prefix}${extractBlockText(question.prompt)}`;
}

/**
 * Returns the complete, fluent Vietnamese translation of a specific option.
 */
export function getVietnameseOptionTranslation(
  option: QuestionOption,
  questionId?: string
): string {
  if (questionId) {
    const entry = QUESTIONS_VI[questionId];
    if (entry?.optionsVi?.[option.id]) {
      return entry.optionsVi[option.id];
    }
  }
  return option.label;
}

/**
 * Returns the complete, fluent Vietnamese translation of a question's overall explanation.
 */
export function getVietnameseExplanation(question: Question): string {
  const entry = QUESTIONS_VI[question.id];
  if (entry?.explanationVi) {
    return entry.explanationVi;
  }
  return extractBlockText(question.explanation);
}

/**
 * Returns the easy-to-memorize rote-learning keyword hook ("Keyword học vẹt")
 * linking the question cue directly to the key answer phrase.
 */
export function getMemoryKeywordHook(question: Question): MemoryKeywordHook {
  const entry = QUESTIONS_VI[question.id];
  if (entry?.memoryKeyword) {
    return entry.memoryKeyword;
  }
  const correctIds = question.interaction.correctOptionIds
    .map((id) => id.toUpperCase())
    .join(', ');
  return {
    cueVi: question.title,
    answerKeyword: `Đáp án ${correctIds}`,
    roteFormula: `Nhớ trọng tâm đáp án ${correctIds}.`,
  };
}

/**
 * Fallback helper kept for compatibility.
 */
export function translateTechnicalEnglishToVietnamese(englishText: string): string {
  return englishText;
}

export interface PerOptionDetailedRationale {
  optionId: string;
  optionLabel: string;
  isCorrect: boolean;
  hasSourceOptionExplanation: boolean;
  sourceBlocks: ContentBlock[] | null;
  englishReason: string;
  vietnameseReason: string;
  flawCategoryVi: string;
}

/**
 * Returns complete per-option rationales ("Vì sao phương án này ĐÚNG / Vì sao phương án này SAI")
 * in both English and complete fluent Vietnamese for EVERY single option (A, B, C, D, E, F)
 * across ALL 110 questions in the bank.
 */
export function getCompletePerOptionRationales(question: Question): PerOptionDetailedRationale[] {
  const sourceMap = new Map(
    (question.optionExplanations || []).map((oe) => [oe.optionId, oe.content])
  );
  const viEntry = QUESTIONS_VI[question.id];

  const rawExpParagraphs = question.explanation
    .filter((b) => b.type === 'paragraph')
    .map((b) => (b as { type: 'paragraph'; text: string }).text);

  const coreExplanationEn =
    rawExpParagraphs.length > 1
      ? rawExpParagraphs.slice(1).join('\n\n')
      : rawExpParagraphs.join('\n\n');

  const correctIdsUpper = question.interaction.correctOptionIds
    .map((id) => id.toUpperCase())
    .join(', ');

  return question.interaction.options.map((opt) => {
    const isCorrect = question.interaction.correctOptionIds.includes(opt.id);
    const sourceBlocks = sourceMap.get(opt.id) || null;
    const hasSourceOptionExplanation = Boolean(sourceBlocks && sourceBlocks.length > 0);
    const viRationale = viEntry?.optionRationalesVi?.[opt.id];

    const englishReason = hasSourceOptionExplanation && sourceBlocks
      ? extractBlockText(sourceBlocks)
      : isCorrect
      ? `Correct (${opt.id.toUpperCase()}): ${coreExplanationEn}`
      : `Incorrect. This option does not satisfy the technical requirement as well as ${correctIdsUpper}.`;

    const vietnameseReason = viRationale
      ? viRationale
      : isCorrect
      ? `Đúng: Phương án ${opt.id.toUpperCase()} đáp ứng chính xác yêu cầu kỹ thuật của câu hỏi.`
      : `Sai: Phương án ${opt.id.toUpperCase()} không thỏa mãn yêu cầu kỹ thuật của bài toán như đáp án ${correctIdsUpper}.`;

    return {
      optionId: opt.id,
      optionLabel: opt.label,
      isCorrect,
      hasSourceOptionExplanation,
      sourceBlocks,
      englishReason,
      vietnameseReason,
      flawCategoryVi: isCorrect
        ? 'Đáp án đúng'
        : 'Phương án nhiễu / Không chính xác',
    };
  });
}

export interface SmartExamHint {
  topicFocusVi: string;
  keyClues: string[];
  guidingPrincipleVi: string;
}

/**
 * Generates a helpful, non-spoiler Smart Hint during Mock Exam or Study mode.
 */
export function getExamSmartHint(question: Question): SmartExamHint {
  const promptText = extractBlockText(question.prompt);
  const tags = question.derivedTags || ['Application Integration'];
  const topicFocusVi = tags.join(' • ');

  const backtickMatches = Array.from(promptText.matchAll(/`([^`]+)`/g)).map((m) => m[1]);
  const keywordCandidates = [
    'content policy',
    'API keys',
    'secrets manager',
    'custom tool',
    'built-in tool',
    'MCP server',
    'Message Batches API',
    'Claude Code',
    'Agent SDK',
    'system prompt',
    'permissions.deny',
    'settings.json',
    'settings.local.json',
    'claude --resume',
    'prompt injection',
    'context window',
    'streaming',
    'latency',
    'temperature',
    'orchestrator',
  ].filter((kw) =>
    new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(promptText)
  );

  const keyClues = Array.from(new Set([...backtickMatches, ...keywordCandidates])).slice(0, 6);

  let guidingPrincipleVi =
    'Hãy ưu tiên giải pháp đảm bảo tính tất định (deterministic), cô lập phạm vi ảnh hưởng (isolation), tận dụng công cụ tích hợp sẵn (built-in tools) khi đủ đáp ứng và chẩn đoán đúng nguyên nhân gốc rễ từ log/trace trước khi thay đổi kiến trúc.';

  if (tags.includes('Security, Safety & Permissions')) {
    guidingPrincipleVi =
      'Nguyên tắc Bảo mật & An toàn: System prompt không thể thay thế kiểm soát tất định (deterministic filtering/guardrails). Khóa API phải tách biệt theo từng môi trường. Quy tắc phân quyền (`permissions.deny`) ở phạm vi dự án không thể bị vượt qua bởi `allow` cục bộ.';
  } else if (tags.includes('Tools & MCP Servers')) {
    guidingPrincipleVi =
      'Nguyên tắc Công cụ & MCP: Ưu tiên dùng Built-in Tools (`Read`, `Edit`, `Bash`, `Grep`...) cho tác vụ cục bộ. Dùng Custom Tool qua In-process MCP Server khi cần gọi dịch vụ nội bộ, và dùng MCP Server độc lập khi cần chia sẻ tool cho nhiều ứng dụng.';
  } else if (tags.includes('Models, Cost & Batches API')) {
    guidingPrincipleVi =
      'Nguyên tắc Model & Batches API: Message Batches API phù hợp cho tác vụ bất đồng bộ số lượng lớn (tối đa 100.000 requests hoặc 256 MB, xử lý trong 24h, tải kết quả trong 29 ngày, không hỗ trợ stream). Sonnet cân bằng tốc độ và trí tuệ; Haiku tối ưu tốc độ/chi phí; Opus cho tác vụ phức tạp dài hạn.';
  } else if (tags.includes('Claude Code & CLI')) {
    guidingPrincipleVi =
      'Nguyên tắc Claude Code: Chú ý thứ tự ưu tiên cấu hình (Managed/Enterprise > CLI args > `.claude/settings.local.json` > `.claude/settings.json` > `~/.claude/settings.json`), cơ chế gộp quyền (`deny` luôn thắng `allow`), và cơ chế fallback model khi `--resume` gặp model đã ngừng hoạt động.';
  } else if (tags.includes('Output Verification & Evaluation')) {
    guidingPrincipleVi =
      'Nguyên tắc Kiểm chứng Đầu ra (Associate): Luôn đối chiếu số liệu, trích dẫn và khẳng định của Claude với tài liệu nguồn gốc; ưu tiên sửa sai tận gốc thay vì chỉ gắn disclaimer chung chung.';
  } else if (tags.includes('Data Handling & Privacy') || tags.includes('Responsible Use & Governance')) {
    guidingPrincipleVi =
      'Nguyên tắc Dữ liệu & Sử dụng có trách nhiệm (Associate): Bảo vệ thông tin mật/PII trước khi chia sẻ, giữ con người kiểm duyệt (human-in-the-loop) cho quyết định rủi ro cao, và tuân thủ chính sách tổ chức trước khi tự động hóa.';
  } else if (tags.includes('Projects & Context Management') || tags.includes('Skills, Connectors & Artifacts')) {
    guidingPrincipleVi =
      'Nguyên tắc Projects / Skills / Connectors (Associate): Dùng Projects để giữ tri thức & chỉ dẫn dùng chung ổn định; dùng Skills cho quy trình tái sử dụng; dùng Connectors khi cần kết nối dữ liệu sống từ công cụ ngoài; tách rõ tài liệu nguồn bằng cấu trúc rõ ràng.';
  } else if (tags.includes('Code Execution & Data Analysis')) {
    guidingPrincipleVi =
      'Nguyên tắc Code Execution & Phân tích dữ liệu (Associate): Ưu tiên chạy mã tính toán xác thực (thay vì ước lượng bằng chữ) cho bảng tính/CSV/biểu đồ và kiểm tra lại công thức, đơn vị cũng như giả định đầu vào.';
  }

  return {
    topicFocusVi,
    keyClues:
      keyClues.length > 0
        ? keyClues
        : ['Yêu cầu kỹ thuật cốt lõi trong câu hỏi cuối đề bài', 'So sánh tính khả thi & bảo trì'],
    guidingPrincipleVi,
  };
}
