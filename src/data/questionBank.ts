import rawDeveloperBankJson from './questions.json';
import rawAssociateBankJson from './associate/questions.json';
import type {
  ContentBlock,
  CourseId,
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
      if (b.type === 'callout') {
        if (b.title && FLIGHT_REF_REGEX.test(b.title.trim())) return true;
        if (b.text && FLIGHT_REF_REGEX.test(b.text.trim())) return true;
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

/** Rule-derived study tags strictly for Developer (CCDV-F) */
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

/**
 * Rule-derived business-workflow study tags strictly for Associate (CCAO-F).
 * Never assigns Developer programming tags to Associate questions.
 */
export const ASSOCIATE_DERIVED_TAG_RULES: Array<{ tag: string; keywords: RegExp }> = [
  {
    tag: 'Prompting & Structured Output',
    keywords: /\b(prompt|few-shot|XML|template|format|role|audience|tone|iteration|clarif|constraint|example|step-by-step|chain of thought)\b/i,
  },
  {
    tag: 'Projects & Context Management',
    keywords: /\b(project|project knowledge|project instructions|context window|knowledge base|reference document|attached file|shared context|long conversation)\b/i,
  },
  {
    tag: 'Skills, Connectors & Artifacts',
    keywords: /\b(skill|skills|connector|connectors|artifact|artifacts|integration|Slack|Google Drive|Notion|Jira|Confluence|external tool)\b/i,
  },
  {
    tag: 'Code Execution & Data Analysis',
    keywords: /\b(code execution|spreadsheet|CSV|chart|calculation|formula|analysis tool|python|dataset|table|quantitative|visualize)\b/i,
  },
  {
    tag: 'Memory & Workspace Workflows',
    keywords: /\b(memory|preferences|style|recurring|workflow|handoff|sequence|steps|digest|meeting notes|onboarding|team)\b/i,
  },
  {
    tag: 'Output Verification & Evaluation',
    keywords: /\b(verify|verification|fact-check|citation|hallucinat|accuracy|review|source document|claim|rubric|spot-check|bias|inaccura|generalization)\b/i,
  },
  {
    tag: 'Data Handling & Privacy',
    keywords: /\b(confidential|sensitive|PII|privacy|redact|anonymiz|data handling|customer data|internal data|compliance|retention|policy)\b/i,
  },
  {
    tag: 'Responsible Use & Governance',
    keywords: /\b(responsible|ethics|ethical|governance|disclosure|human-in-the-loop|oversight|high-stakes|legal|medical|financial|approval|risk|escalation)\b/i,
  },
];

export function extractBlockText(blocks: ContentBlock[]): string {
  if (!Array.isArray(blocks)) return '';
  const parts: string[] = [];
  for (const b of blocks) {
    if (!b || typeof b !== 'object') continue;
    if (b.type === 'paragraph' || b.type === 'heading') {
      if (typeof b.text === 'string') parts.push(b.text);
    } else if (b.type === 'callout') {
      if (typeof b.title === 'string' && b.title.trim()) parts.push(b.title);
      if (typeof b.text === 'string' && b.text.trim()) parts.push(b.text);
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

export function deriveStudyTags(q: Question, courseId: CourseId = 'ccdv-f'): string[] {
  const searchCorpus = `${extractBlockText(q.prompt)}\n${q.interaction.options.map((o) => o.label).join('\n')}\n${extractBlockText(q.explanation)}`;
  const rules = courseId === 'ccao-f' ? ASSOCIATE_DERIVED_TAG_RULES : DERIVED_TAG_RULES;
  const fallbackTag =
    courseId === 'ccao-f' ? 'Business Workflows & General Use' : 'Application Integration';

  const matched: string[] = [];
  for (const rule of rules) {
    if (rule.keywords.test(searchCorpus)) {
      matched.push(rule.tag);
    }
  }
  if (matched.length === 0) {
    matched.push(fallbackTag);
  }
  return matched;
}

export function deriveQuestionSourceNotes(q: Question, courseId: CourseId = 'ccdv-f'): string[] {
  const notes: string[] = [];
  if (q.review?.notes?.length) {
    notes.push(...q.review.notes);
  }
  if (q.review?.status && q.review.status !== 'ready') {
    notes.push(`Trạng thái review từ nguồn: ${q.review.status}`);
  }
  if (courseId === 'ccdv-f') {
    if (q.id === 'ccdv-f-q004' || q.id === 'ccdv-f-q019') {
      notes.push(
        'Ghi chú câu hỏi: Lời giải câu này có trích dẫn tài liệu kỹ thuật OpenAI; nội dung và đáp án được giữ nguyên văn.'
      );
    }
    if (q.id === 'ccdv-f-q054' || q.id === 'ccdv-f-q055' || q.id === 'ccdv-f-q056') {
      notes.push(
        'Ghi chú từ nguồn: Câu 54–56 là câu hỏi mẫu minh họa (illustrative sample questions), giữ nguyên đáp án và lời giải gốc.'
      );
    }
  }
  return notes;
}

export interface BankValidationExpectation {
  expectedTotal: number;
  expectedSingleChoice: number;
  expectedMultipleChoice: number;
  idPrefix: string;
}

export const COURSE_VALIDATION_EXPECTATIONS: Record<CourseId, BankValidationExpectation> = {
  'ccdv-f': {
    expectedTotal: 110,
    expectedSingleChoice: 102,
    expectedMultipleChoice: 8,
    idPrefix: 'ccdv-f-q',
  },
  'ccao-f': {
    expectedTotal: 169,
    expectedSingleChoice: 127,
    expectedMultipleChoice: 42,
    idPrefix: 'ccao-f-q',
  },
};

export function validateQuestionBank(
  bank: QuestionBankRoot,
  expectation?: BankValidationExpectation
): DatasetValidationReport {
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

  const resolvedExpectation: BankValidationExpectation =
    expectation ??
    (bank.id === 'ccao-f'
      ? COURSE_VALIDATION_EXPECTATIONS['ccao-f']
      : COURSE_VALIDATION_EXPECTATIONS['ccdv-f']);

  const questions = Array.isArray(bank.questions) ? bank.questions : [];
  if (questions.length !== resolvedExpectation.expectedTotal) {
    errors.push(
      `Số lượng câu hỏi phải đúng ${resolvedExpectation.expectedTotal} câu, nhưng nhận được ${questions.length}.`
    );
  }

  const seenIds = new Set<string>();
  let singleChoiceCount = 0;
  let multipleChoiceCount = 0;
  let unresolvedReferencesCount = 0;
  const multipleChoiceQuestions: Array<{ id: string; correctOptionIds: string[] }> = [];

  questions.forEach((q, idx) => {
    const expectedId = `${resolvedExpectation.idPrefix}${String(idx + 1).padStart(3, '0')}`;
    if (q.id !== expectedId) {
      errors.push(
        `Thứ tự hoặc mã câu tại vị trí ${idx + 1} không khớp: mong đợi ${expectedId}, nhận được ${q.id}`
      );
    }
    if (seenIds.has(q.id)) {
      errors.push(`Trùng mã câu hỏi: ${q.id}`);
    }
    seenIds.add(q.id);

    if (!Array.isArray(q.prompt) || q.prompt.length === 0 || !extractBlockText(q.prompt).trim()) {
      errors.push(`Câu ${q.id} có prompt rỗng.`);
    }
    if (
      !Array.isArray(q.explanation) ||
      q.explanation.length === 0 ||
      !extractBlockText(q.explanation).trim()
    ) {
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
        errors.push(
          `Câu single_choice ${q.id} phải có đúng 1 đáp án, nhưng có ${correctIds.length}.`
        );
      }
    } else if (q.interaction?.type === 'multiple_choice') {
      multipleChoiceCount++;
      multipleChoiceQuestions.push({ id: q.id, correctOptionIds: [...correctIds] });
      if (correctIds.length <= 1) {
        errors.push(
          `Câu multiple_choice ${q.id} phải có nhiều hơn 1 đáp án, nhưng có ${correctIds.length}.`
        );
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

  if (singleChoiceCount !== resolvedExpectation.expectedSingleChoice) {
    errors.push(
      `Số câu single_choice phải đúng ${resolvedExpectation.expectedSingleChoice}, nhưng nhận được ${singleChoiceCount}.`
    );
  }
  if (multipleChoiceCount !== resolvedExpectation.expectedMultipleChoice) {
    errors.push(
      `Số câu multiple_choice phải đúng ${resolvedExpectation.expectedMultipleChoice}, nhưng nhận được ${multipleChoiceCount}.`
    );
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

export interface CourseBundle {
  id: CourseId;
  shortCode: string;
  name: string;
  shortTitle: string;
  descriptionVi: string;
  bank: QuestionBankRoot;
  questions: Question[];
  questionsById: Record<string, Question>;
  validation: DatasetValidationReport;
  derivedTags: string[];
  firstQuestionId: string;
  hasVietnameseTranslations: boolean;
  showSourceAttribution: boolean;
}

function buildCourseBundle(
  courseId: CourseId,
  rawJson: unknown,
  meta: {
    shortCode: string;
    name: string;
    shortTitle: string;
    descriptionVi: string;
    hasVietnameseTranslations: boolean;
    showSourceAttribution: boolean;
  }
): CourseBundle {
  const typedRaw = rawJson as unknown as QuestionBankRoot;
  const bank: QuestionBankRoot = {
    ...typedRaw,
    questions: typedRaw.questions.map((q, index) => ({
      ...q,
      number: index + 1,
      derivedTags: deriveStudyTags(q, courseId),
      sourceNotes: deriveQuestionSourceNotes(q, courseId),
    })),
  };

  const questions = bank.questions;
  const questionsById = Object.fromEntries(questions.map((q) => [q.id, q]));
  const validation = validateQuestionBank(bank, COURSE_VALIDATION_EXPECTATIONS[courseId]);
  const derivedTags = Array.from(new Set(questions.flatMap((q) => q.derivedTags || []))).sort();

  return {
    id: courseId,
    shortCode: meta.shortCode,
    name: meta.name,
    shortTitle: meta.shortTitle,
    descriptionVi: meta.descriptionVi,
    bank,
    questions,
    questionsById,
    validation,
    derivedTags,
    firstQuestionId: questions[0]?.id || `${courseId}-q001`,
    hasVietnameseTranslations: meta.hasVietnameseTranslations,
    showSourceAttribution: meta.showSourceAttribution,
  };
}

export const DEVELOPER_COURSE: CourseBundle = buildCourseBundle('ccdv-f', rawDeveloperBankJson, {
  shortCode: 'CCDV-F',
  name: 'Claude Certified Developer – Foundations',
  shortTitle: 'Developer (CCDV-F)',
  descriptionVi:
    'Bộ đề lập trình & tích hợp API, Claude Code, Agent SDK, MCP Server, Prompt Caching, Batches API và Bảo mật (110 câu, kèm song ngữ & mẹo học vẹt).',
  hasVietnameseTranslations: true,
  showSourceAttribution: false,
});

export const ASSOCIATE_COURSE: CourseBundle = buildCourseBundle('ccao-f', rawAssociateBankJson, {
  shortCode: 'CCAO-F',
  name: 'Claude Certified Associate – Foundations',
  shortTitle: 'Associate (CCAO-F)',
  descriptionVi:
    'Bộ đề nghiệp vụ về Prompting, Projects, Skills, Connectors, Code Execution, Memory, kiểm tra đầu ra và sử dụng Claude có trách nhiệm (169 câu nguyên văn tiếng Anh).',
  hasVietnameseTranslations: false,
  showSourceAttribution: true,
});

export const COURSES: CourseBundle[] = [DEVELOPER_COURSE, ASSOCIATE_COURSE];

export const COURSES_BY_ID: Record<CourseId, CourseBundle> = {
  'ccdv-f': DEVELOPER_COURSE,
  'ccao-f': ASSOCIATE_COURSE,
};

export function getCourseBundle(courseId?: string | null): CourseBundle {
  if (courseId === 'ccao-f') return ASSOCIATE_COURSE;
  return DEVELOPER_COURSE;
}

export function detectCourseIdFromQuestionId(questionId?: string | null): CourseId {
  if (typeof questionId === 'string' && questionId.startsWith('ccao-f-')) {
    return 'ccao-f';
  }
  return 'ccdv-f';
}

export const ALL_QUESTIONS: Question[] = [
  ...DEVELOPER_COURSE.questions,
  ...ASSOCIATE_COURSE.questions,
];

export const ALL_QUESTIONS_BY_ID: Record<string, Question> = {
  ...DEVELOPER_COURSE.questionsById,
  ...ASSOCIATE_COURSE.questionsById,
};

// Backward-compatible exports for Developer (ccdv-f)
export const QUESTION_BANK: QuestionBankRoot = DEVELOPER_COURSE.bank;
export const QUESTIONS: Question[] = DEVELOPER_COURSE.questions;
export const QUESTIONS_BY_ID: Record<string, Question> = DEVELOPER_COURSE.questionsById;
export const DATASET_VALIDATION: DatasetValidationReport = DEVELOPER_COURSE.validation;
export const ALL_DERIVED_TAGS: string[] = DEVELOPER_COURSE.derivedTags;
