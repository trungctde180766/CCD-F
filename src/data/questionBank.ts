import rawBankJson from './questions.json';
import type {
  ContentBlock,
  DatasetValidationReport,
  Question,
  QuestionBankRoot,
} from '../types';

const FLIGHT_REF_REGEX = /^\$[0-9a-fA-F]+$/;

export function hasUnresolvedFlightReference(q: Question): boolean {
  const checkBlocks = (blocks: ContentBlock[]) => {
    for (const b of blocks || []) {
      if ((b.type === 'paragraph' || b.type === 'heading') && FLIGHT_REF_REGEX.test(b.text.trim())) {
        return true;
      }
      if (b.type === 'list') {
        for (const item of b.items || []) {
          if (typeof item === 'string' && FLIGHT_REF_REGEX.test(item.trim())) {
            return true;
          }
        }
      }
    }
    return false;
  };

  if (checkBlocks(q.prompt) || checkBlocks(q.explanation)) return true;
  for (const opt of q.interaction?.options || []) {
    if (FLIGHT_REF_REGEX.test((opt.label || '').trim())) return true;
  }
  for (const oe of q.optionExplanations || []) {
    if (checkBlocks(oe.content)) return true;
  }
  return false;
}

export const DERIVED_TAG_RULES: Array<{ tag: string; keywords: RegExp }> = [
  {
    tag: 'Claude Code & CLI',
    keywords: /\b(claude code|CLAUDE\.md|\.claude|settings\.json|settings\.local\.json|slash command|hook|hooks|subagent|--resume|worktree)\b/i,
  },
  {
    tag: 'Agent SDK & Workflows',
    keywords: /\b(agent sdk|ClaudeAgentOptions|canUseTool|dontAsk|allowed_tools|orchestrator|sub-agent|multi-agent|handoff|workflow|Strands)\b/i,
  },
  {
    tag: 'Tools & MCP Servers',
    keywords: /\b(MCP|Model Context Protocol|tool_use|tool_choice|custom tool|built-in tool|create_sdk_mcp_server|createSdkMcpServer|WebFetch)\b/i,
  },
  {
    tag: 'Prompt & Context Engineering',
    keywords: /\b(system prompt|few-shot|chain-of-thought|XML tag|context window|prompt caching|cache_control|prefill|structured output)\b/i,
  },
  {
    tag: 'Security, Safety & Permissions',
    keywords: /\b(content policy|prompt injection|API key|secrets manager|permission|permissions\.deny|guardrail|output filtering|PII|sandbox)\b/i,
  },
  {
    tag: 'Models, Cost & Batches API',
    keywords: /\b(Message Batches|batch|latency|token cost|Haiku|Sonnet|Opus|rate limit|streaming|stream|extended thinking)\b/i,
  },
  {
    tag: 'Evaluation & Testing',
    keywords: /\b(eval|evaluation|benchmark|test suite|regression|grading|rubric|metric|empirical)\b/i,
  },
];

export function extractBlockText(blocks: ContentBlock[]): string {
  if (!Array.isArray(blocks)) return '';
  const parts: string[] = [];
  for (const b of blocks) {
    if (!b || typeof b !== 'object') continue;
    if (b.type === 'paragraph' || b.type === 'heading') {
      if (typeof b.text === 'string') parts.push(b.text);
    } else if (b.type === 'list' && Array.isArray(b.items)) {
      for (const item of b.items) {
        if (typeof item === 'string') parts.push(item);
      }
    }
  }
  return parts.join('\n');
}

export function extractQuestionFullText(q: Question): string {
  const promptText = extractBlockText(q.prompt);
  const optionsText = q.interaction.options.map((o) => `${o.id.toUpperCase()}. ${o.label}`).join('\n');
  const explanationText = extractBlockText(q.explanation);
  const optExpText = (q.optionExplanations || [])
    .map((oe) => `${oe.optionId.toUpperCase()}: ${extractBlockText(oe.content)}`)
    .join('\n');
  return `${q.id} ${q.title}\n${promptText}\n${optionsText}\n${explanationText}\n${optExpText}`;
}

export function deriveStudyTags(q: Question): string[] {
  const searchCorpus = `${extractBlockText(q.prompt)}\n${q.interaction.options.map((o) => o.label).join('\n')}\n${extractBlockText(q.explanation)}`;
  const matched: string[] = [];
  for (const rule of DERIVED_TAG_RULES) {
    if (rule.keywords.test(searchCorpus)) {
      matched.push(rule.tag);
    }
  }
  if (matched.length === 0) {
    matched.push('Application Integration');
  }
  return matched;
}

export function deriveQuestionSourceNotes(q: Question): string[] {
  const notes: string[] = [];
  if (q.review?.notes?.length) {
    notes.push(...q.review.notes);
  }
  if (q.review?.status && q.review.status !== 'ready') {
    notes.push(`Trạng thái review từ nguồn: ${q.review.status}`);
  }
  if (q.id === 'ccdv-f-q004' || q.id === 'ccdv-f-q019') {
    notes.push(
      'Ghi chú từ nguồn: Lời giải câu này có trích dẫn tài liệu OpenAI; nội dung và đáp án được giữ nguyên văn theo nguồn T-Study.'
    );
  }
  if (q.id === 'ccdv-f-q054' || q.id === 'ccdv-f-q055' || q.id === 'ccdv-f-q056') {
    notes.push(
      'Ghi chú từ nguồn: Câu 54–56 là câu hỏi mẫu minh họa (illustrative sample questions), giữ nguyên đáp án và lời giải gốc.'
    );
  }
  return notes;
}

export function validateQuestionBank(bank: QuestionBankRoot): DatasetValidationReport {
  const errors: string[] = [];

  if (!bank || typeof bank !== 'object') {
    return {
      isValid: false,
      errors: ['Root dataset không phải là một object hợp lệ.'],
      totalQuestions: 0,
      uniqueIdsCount: 0,
      singleChoiceCount: 0,
      multipleChoiceCount: 0,
      multipleChoiceQuestions: [],
      unresolvedReferencesCount: 0,
    };
  }

  for (const key of [
    'schemaVersion',
    'id',
    'revision',
    'title',
    'topics',
    'contexts',
    'questions',
    'sources',
    'conversion',
    'extraction',
  ] as const) {
    if (!(key in bank)) {
      errors.push(`Thiếu trường bắt buộc ở root: ${key}`);
    }
  }

  const questions = Array.isArray(bank.questions) ? bank.questions : [];
  if (questions.length !== 110) {
    errors.push(`Số lượng câu hỏi phải đúng 110 câu, nhưng nhận được ${questions.length}.`);
  }

  const seenIds = new Set<string>();
  let singleChoiceCount = 0;
  let multipleChoiceCount = 0;
  let unresolvedReferencesCount = 0;
  const multipleChoiceQuestions: Array<{ id: string; correctOptionIds: string[] }> = [];

  questions.forEach((q, idx) => {
    const expectedId = `ccdv-f-q${String(idx + 1).padStart(3, '0')}`;
    if (q.id !== expectedId) {
      errors.push(`Thứ tự hoặc mã câu tại vị trí ${idx + 1} không khớp: mong đợi ${expectedId}, nhận được ${q.id}`);
    }
    if (seenIds.has(q.id)) {
      errors.push(`Trùng mã câu hỏi: ${q.id}`);
    }
    seenIds.add(q.id);

    if (!Array.isArray(q.prompt) || q.prompt.length === 0 || !extractBlockText(q.prompt).trim()) {
      errors.push(`Câu ${q.id} có prompt rỗng.`);
    }
    if (!Array.isArray(q.explanation) || q.explanation.length === 0 || !extractBlockText(q.explanation).trim()) {
      errors.push(`Câu ${q.id} có explanation rỗng.`);
    }

    const optIds = new Set<string>();
    const options = q.interaction?.options || [];
    if (options.length < 2) {
      errors.push(`Câu ${q.id} có ít hơn 2 lựa chọn.`);
    }
    for (const opt of options) {
      if (!opt.id || !opt.label?.trim()) {
        errors.push(`Câu ${q.id} có lựa chọn thiếu id hoặc label.`);
      }
      if (optIds.has(opt.id)) {
        errors.push(`Câu ${q.id} có option.id bị trùng: ${opt.id}`);
      }
      optIds.add(opt.id);
    }

    const correctIds = q.interaction?.correctOptionIds || [];
    for (const cid of correctIds) {
      if (!optIds.has(cid)) {
        errors.push(`Câu ${q.id} có correctOptionId "${cid}" không nằm trong danh sách options.`);
      }
    }

    if (q.interaction?.type === 'single_choice') {
      singleChoiceCount++;
      if (correctIds.length !== 1) {
        errors.push(`Câu single_choice ${q.id} phải có đúng 1 đáp án, nhưng có ${correctIds.length}.`);
      }
    } else if (q.interaction?.type === 'multiple_choice') {
      multipleChoiceCount++;
      multipleChoiceQuestions.push({ id: q.id, correctOptionIds: [...correctIds] });
      if (correctIds.length <= 1) {
        errors.push(`Câu multiple_choice ${q.id} phải có nhiều hơn 1 đáp án, nhưng có ${correctIds.length}.`);
      }
    } else {
      errors.push(`Câu ${q.id} có interaction.type không hợp lệ: ${String(q.interaction?.type)}`);
    }

    const fullText = extractQuestionFullText(q);
    if (hasUnresolvedFlightReference(q) || fullText.includes('[object Object]')) {
      unresolvedReferencesCount++;
      errors.push(`Câu ${q.id} chứa chuỗi tham chiếu nội bộ hoặc [object Object].`);
    }
  });

  if (singleChoiceCount !== 102) {
    errors.push(`Số câu single_choice phải đúng 102, nhưng nhận được ${singleChoiceCount}.`);
  }
  if (multipleChoiceCount !== 8) {
    errors.push(`Số câu multiple_choice phải đúng 8, nhưng nhận được ${multipleChoiceCount}.`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    totalQuestions: questions.length,
    uniqueIdsCount: seenIds.size,
    singleChoiceCount,
    multipleChoiceCount,
    multipleChoiceQuestions,
    unresolvedReferencesCount,
  };
}

const typedRawBank = rawBankJson as unknown as QuestionBankRoot;

export const QUESTION_BANK: QuestionBankRoot = {
  ...typedRawBank,
  questions: typedRawBank.questions.map((q, index) => ({
    ...q,
    number: index + 1,
    derivedTags: deriveStudyTags(q),
    sourceNotes: deriveQuestionSourceNotes(q),
  })),
};

export const QUESTIONS: Question[] = QUESTION_BANK.questions;

export const QUESTIONS_BY_ID: Record<string, Question> = Object.fromEntries(
  QUESTIONS.map((q) => [q.id, q])
);

export const DATASET_VALIDATION: DatasetValidationReport = validateQuestionBank(QUESTION_BANK);

export const ALL_DERIVED_TAGS: string[] = Array.from(
  new Set(QUESTIONS.flatMap((q) => q.derivedTags || []))
).sort();
