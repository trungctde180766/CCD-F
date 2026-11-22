import { extractBlockText } from '../data/questionBank';
import type { ContentBlock, Question, QuestionOption } from '../types';

export type LanguageDisplayMode = 'en' | 'bilingual' | 'vi';

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
 * Phrase-level and sentence-level technical translation dictionary for Claude Certified Developer Foundations.
 * Preserves technical identifiers while translating English exam stems, options, and explanations into natural Vietnamese.
 */
const PHRASE_TRANSLATIONS: Array<[RegExp, string]> = [
  [/Correct answers? from the source:/gi, 'Đáp án đúng từ nguồn:'],
  [/Your Claude application['’]s content policy defines categories of content that it must never produce under any circumstances\./gi, 'Chính sách nội dung (content policy) của ứng dụng Claude quy định các danh mục nội dung tuyệt đối không được phép sinh ra trong bất kỳ hoàn cảnh nào.'],
  [/The application currently has no way to enforce this policy, and content in these categories is appearing in its output\./gi, 'Ứng dụng hiện chưa có cơ chế cưỡng chế chính sách này và các nội dung vi phạm vẫn đang xuất hiện ở đầu ra.'],
  [/How would you enforce the content policy\?/gi, 'Bạn nên cưỡng chế thực thi chính sách nội dung này bằng cách nào?'],
  [/How should the keys be handled across environments\?/gi, 'Các khóa API (API keys) nên được quản lý như thế nào giữa các môi trường (development, staging, production)?'],
  [/How should you make the decision\?/gi, 'Bạn nên đưa ra quyết định lựa chọn giải pháp như thế nào?'],
  [/Which approach best fits this requirement\?/gi, 'Phương pháp tiếp cận nào phù hợp nhất với yêu cầu này?'],
  [/What is the most appropriate starting point\?/gi, 'Điểm bắt đầu phù hợp nhất cho bài toán này là gì?'],
  [/What happens when the session resumes\?/gi, 'Điều gì sẽ xảy ra khi phiên làm việc (session) được khôi phục (`--resume`)?'],
  [/When that developer runs Claude Code in the repo, what happens to `curl` commands\?/gi, 'Khi lập trình viên đó chạy Claude Code trong repository, điều gì sẽ xảy ra với các lệnh `curl`?'],
  [/Which current Claude model fits this requirement\?/gi, 'Mô hình Claude hiện tại nào phù hợp nhất với yêu cầu này?'],
  [/Select the statements below that accurately describe/gi, 'Hãy chọn tất cả các phát biểu bên dưới mô tả chính xác'],
  [/Select all that apply/gi, 'Chọn tất cả các phương án đúng'],
  [/Which of the following/gi, 'Phương án nào sau đây'],
  [/deterministic output filtering/gi, 'bộ lọc đầu ra tất định (deterministic output filtering)'],
  [/system prompt/gi, 'system prompt (chỉ dẫn hệ thống)'],
  [/secrets manager/gi, 'trình quản lý bí mật (secrets manager)'],
  [/development, staging, and production/gi, 'các môi trường development, staging và production'],
  [/distinct keys for each environment/gi, 'các khóa API riêng biệt cho từng môi trường'],
  [/built-in tools?/gi, 'công cụ tích hợp sẵn (built-in tool)'],
  [/custom tools?/gi, 'công cụ tùy chỉnh (custom tool)'],
  [/in-process MCP server/gi, 'máy chủ MCP nội tiến trình (in-process MCP server)'],
  [/external MCP server/gi, 'máy chủ MCP bên ngoài (external MCP server)'],
  [/community MCP server/gi, 'máy chủ MCP từ cộng đồng'],
  [/Message Batches API/gi, 'Message Batches API (API xử lý theo lô)'],
  [/prompt injection/gi, 'tấn công chèn chỉ dẫn (prompt injection)'],
  [/context window/gi, 'cửa sổ ngữ cảnh (context window)'],
  [/prompt caching/gi, 'bộ nhớ đệm prompt (prompt caching)'],
  [/permission rules merge across scopes/gi, 'các quy tắc phân quyền (permission rules) được gộp qua các phạm vi (scopes) thay vì ghi đè hoàn toàn'],
  [/precedence order/gi, 'thứ tự ưu tiên (precedence order)'],
  [/transient errors?/gi, 'lỗi tạm thời (transient error)'],
  [/retry behavior/gi, 'cơ chế thử lại (retry behavior)'],
  [/orchestrator agent/gi, 'tác tử điều phối (orchestrator agent)'],
  [/specialized agents?/gi, 'các tác tử chuyên biệt (specialized agents)'],
  [/production traces/gi, 'nhật ký vết thực thi (production traces)'],
  [/hallucination/gi, 'ảo giác của mô hình (hallucination)'],
  [/retrieval failure/gi, 'lỗi truy xuất dữ liệu (retrieval failure)'],
  [/sampling randomness/gi, 'độ ngẫu nhiên khi lấy mẫu (sampling randomness)'],
  [/non-interactive workloads/gi, 'các tác vụ chạy nền không tương tác trực tiếp'],
  [/structured outputs?/gi, 'đầu ra có cấu trúc (structured output)'],
  [/JSON schema/gi, 'lược đồ JSON (JSON schema)'],
  [/empirical evaluation/gi, 'đánh giá thực nghiệm (empirical evaluation)'],
  [/regression testing/gi, 'kiểm thử hồi quy (regression testing)'],
];

const CLAUSE_TRANSLATIONS: Array<[RegExp, string]> = [
  [/^Correct[\s:—.-]*/i, 'Chính xác: '],
  [/^Incorrect[\s:—.-]*/i, 'Không chính xác: '],
  [/^Option ([A-E]) is correct because /i, 'Phương án $1 đúng vì '],
  [/^Option ([A-E]) correctly /i, 'Phương án $1 đã xử lý đúng khi '],
  [/^([A-E])\.\s*Correct\.\s*/i, '$1. Chính xác: '],
  [/^([A-E])\.\s*Incorrect\.\s*/i, '$1. Không chính xác: '],
  [/before they reach users/gi, 'trước khi phản hồi được trả về cho người dùng'],
  [/during normal operation/gi, 'trong quá trình vận hành thông thường'],
  [/across all environments/gi, 'trên tất cả các môi trường'],
  [/compromise in one environment does not affect the others/gi, 'sự cố lộ khóa ở một môi trường không làm ảnh hưởng tới các môi trường còn lại'],
  [/without any modification or extension/gi, 'mà không cần chỉnh sửa hay mở rộng gì thêm'],
  [/development and maintenance cost/gi, 'chi phí phát triển và bảo trì lâu dài'],
  [/is not a guaranteed enforcement control/gi, 'không phải là cơ chế kiểm soát cưỡng chế được đảm bảo 100%'],
  [/may steer model behavior/gi, 'có thể định hướng hành vi của mô hình nhưng không đảm bảo chặn tuyệt đối'],
  [/enforces a strict limit of 100,000 requests or 256 MB/gi, 'áp dụng giới hạn nghiêm ngặt tối đa 100.000 request hoặc 256 MB cho mỗi batch'],
  [/24-hour processing window/gi, 'khung thời gian xử lý 24 giờ kể từ lúc khởi tạo'],
  [/remain available for download for 29 days/gi, 'kết quả tải về khả dụng trong 29 ngày sau khi tạo batch'],
  [/scoped to a single Workspace/gi, 'được giới hạn phạm vi trong từng Workspace riêng biệt'],
  [/does not support streaming/gi, 'không hỗ trợ chế độ truyền phát trực tiếp (streaming)'],
  [/falls through to the normal precedence order/gi, 'chuyển tiếp sang thứ tự ưu tiên chọn model thông thường thay vì báo lỗi dừng hẳn'],
  [/cannot remove a project-level deny/gi, 'quy tắc allow cục bộ không thể xóa bỏ quy tắc deny đã áp ở cấp dự án'],
  [/duplicates capabilities the built-in tools already provide/gi, 'lặp lại các tính năng mà bộ công cụ tích hợp sẵn (built-in tools) đã cung cấp'],
  [/adds unnecessary implementation work/gi, 'gây tốn công sức cài đặt không cần thiết'],
  [/adds infrastructure and latency/gi, 'làm phát sinh thêm hạ tầng mạng và độ trễ không cần thiết'],
  [/cannot substitute for the actual tool execution/gi, 'chỉ cung cấp hướng dẫn quy trình chứ không thể thay thế cho việc thực thi công cụ thật'],
  [/not designed for authenticated internal gateway calls/gi, 'không được thiết kế cho các lời gọi tới cổng nội bộ (internal gateway) có xác thực riêng'],
  [/best combination of speed and intelligence/gi, 'sự kết hợp tối ưu nhất giữa tốc độ phản hồi và trí thông minh'],
];

/**
 * Generates a clear Vietnamese technical explanation/translation for any English text block.
 */
export function translateTechnicalEnglishToVietnamese(englishText: string): string {
  if (!englishText || !englishText.trim()) return '';
  let result = englishText.trim();

  for (const [pattern, replacement] of PHRASE_TRANSLATIONS) {
    result = result.replace(pattern, replacement);
  }
  for (const [pattern, replacement] of CLAUSE_TRANSLATIONS) {
    result = result.replace(pattern, replacement);
  }

  // Common sentence structure translations for technical prompts and options
  result = result
    .replace(/\bA developer\b/gi, 'Một lập trình viên')
    .replace(/\bAn individual developer\b/gi, 'Một lập trình viên cá nhân')
    .replace(/\bA platform team\b/gi, 'Đội ngũ hạ tầng (platform team)')
    .replace(/\bA product team\b/gi, 'Đội ngũ phát triển sản phẩm')
    .replace(/\bA fintech startup\b/gi, 'Một công ty khởi nghiệp fintech')
    .replace(/\bA small internal tool\b/gi, 'Một công cụ nội bộ nhỏ')
    .replace(/\bThe team is considering whether to\b/gi, 'Nhóm phát triển đang cân nhắc việc')
    .replace(/\bYour team is building\b/gi, 'Nhóm của bạn đang xây dựng')
    .replace(/\bYour organization\b/gi, 'Tổ chức của bạn')
    .replace(/\bYour application\b/gi, 'Ứng dụng của bạn')
    .replace(/\bEnhance the system prompt to\b/gi, 'Tăng cường system prompt để')
    .replace(/\bRemove the content policy entirely\b/gi, 'Gỡ bỏ hoàn toàn chính sách nội dung')
    .replace(/\bAdd deterministic output filtering that checks responses\b/gi, 'Bổ sung bộ lọc đầu ra tất định để kiểm tra mọi phản hồi')
    .replace(/\bMove enforcement to users by asking them to report\b/gi, 'Đẩy việc kiểm soát sang người dùng bằng cách nhờ họ báo cáo vi phạm')
    .replace(/\bUse a single development key everywhere\b/gi, 'Dùng chung một khóa development cho mọi môi trường')
    .replace(/\bUse distinct keys for each environment\b/gi, 'Sử dụng các khóa API riêng biệt cho từng môi trường')
    .replace(/\bRotate the same key across environments\b/gi, 'Xoay vòng cùng một khóa dùng chung trên mọi môi trường')
    .replace(/\bUse the same key across all environments for simplicity\b/gi, 'Dùng chung một khóa cho tất cả môi trường để đơn giản hóa')
    .replace(/\bEvaluate whether the missing feature can be addressed by extending\b/gi, 'Đánh giá xem tính năng còn thiếu có thể giải quyết bằng cách mở rộng')
    .replace(/\bDefine a custom tool that calls\b/gi, 'Định nghĩa một custom tool gọi tới')
    .replace(/\bRely on the built-in\b/gi, 'Chỉ dựa vào công cụ tích hợp sẵn')
    .replace(/\bWrite a Skill that documents\b/gi, 'Viết một Skill mô tả tài liệu')
    .replace(/\bWrite a Skill containing instructions\b/gi, 'Viết một Skill chứa hướng dẫn')
    .replace(/\bSearch for a community MCP server\b/gi, 'Tìm kiếm một MCP server từ cộng đồng')
    .replace(/\bUse the SDK['’]s built-in tools such as\b/gi, 'Sử dụng trực tiếp các công cụ tích hợp sẵn của SDK như')
    .replace(/\bBuild a custom tool for\b/gi, 'Tự xây dựng lại công cụ tùy chỉnh cho')
    .replace(/\bConnect an external MCP server that reimplements\b/gi, 'Kết nối tới một MCP server bên ngoài cài đặt lại');

  return result;
}

/**
 * Summarizes the Vietnamese core requirement of a question prompt so learners can grasp the question rapidly during an exam.
 */
export function getVietnamesePromptSummary(question: Question): string {
  const rawPrompt = extractBlockText(question.prompt);
  const translated = translateTechnicalEnglishToVietnamese(rawPrompt);
  const isMulti = question.interaction.type === 'multiple_choice';
  const prefix = isMulti
    ? '[Câu hỏi chọn NHIỀU đáp án] '
    : '[Câu hỏi chọn 1 đáp án] ';
  return `${prefix}${translated}`;
}

export function getVietnameseOptionTranslation(option: QuestionOption): string {
  return translateTechnicalEnglishToVietnamese(option.label);
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
 * Diagnoses the exact flaw or trap in an incorrect distractor option when the source only provides a general explanation.
 */
function diagnoseDistractorFlaw(
  option: QuestionOption,
  question: Question,
  correctOptionsText: string
): { en: string; vi: string; categoryVi: string } {
  const lbl = option.label;

  if (/\b(remove|disable|ignore|skip|bypass|accept whatever|let any output reach|without any validation)\b/i.test(lbl)) {
    return {
      categoryVi: 'Bẫy bỏ qua kiểm soát an toàn / chất lượng',
      en: `Incorrect. This option abandons enforcement or validation controls altogether instead of addressing the requirement safely.`,
      vi: `Sai vì phương án này bỏ qua hoặc tắt luôn cơ chế kiểm soát/ràng buộc an toàn, gây rủi ro trực tiếp trong vận hành thực tế.`,
    };
  }

  if (/\b(same key|single development key|shared key|hardcode|commit.*key|plain text)\b/i.test(lbl)) {
    return {
      categoryVi: 'Vi phạm nguyên tắc cô lập môi trường & bảo mật khóa (Least Privilege)',
      en: `Incorrect. Sharing or reusing the same credential across environments fails to isolate blast radius if a key is compromised.`,
      vi: `Sai vì dùng chung một khóa (API key) giữa các môi trường vi phạm nguyên tắc cô lập bảo mật: nếu lộ khóa ở dev/staging sẽ làm lộ luôn môi trường production.`,
    };
  }

  if (/\b(system prompt.*primary enforcement|treat the strengthened prompt as the primary|rely solely on prompt|expect Claude to reason.*from memory)\b/i.test(lbl)) {
    return {
      categoryVi: 'Nhầm lẫn giữa chỉ dẫn xác suất (Prompt) và kiểm soát tất định (Deterministic Control)',
      en: `Incorrect. Prompt instructions guide model behavior probabilistically but cannot guarantee 100% deterministic enforcement or live data access.`,
      vi: `Sai vì chỉ dẫn trong prompt hoặc bộ nhớ mô hình mang tính xác suất, không thể thay thế cho bộ lọc kiểm soát tất định (deterministic check) hoặc kết nối dữ liệu thực.`,
    };
  }

  if (/\b(ask.*users to report|move enforcement to users|manual approval every time|manually review every)\b/i.test(lbl)) {
    return {
      categoryVi: 'Đẩy trách nhiệm kiểm soát tự động sang thủ công / người dùng cuối',
      en: `Incorrect. Shifting enforcement to end-users or manual post-incident reporting allows violations to reach production users first.`,
      vi: `Sai vì đẩy việc kiểm soát sang phía người dùng cuối hoặc xử lý thủ công sau khi sự cố/nội dung vi phạm đã lọt ra ngoài.`,
    };
  }

  if (/\b(reimplement|build a custom tool for reading files|external MCP server.*filesystem|before writing any code)\b/i.test(lbl)) {
    return {
      categoryVi: 'Thiết kế thừa (Over-engineering) khi đã có sẵn công cụ tích hợp',
      en: `Incorrect. Rebuilding capabilities that are already provided natively by built-in tools adds unnecessary complexity, latency, and maintenance overhead.`,
      vi: `Sai vì tự viết lại công cụ hoặc dựng thêm server phức tạp cho những tính năng mà bộ công cụ tích hợp sẵn (built-in tools) đã hỗ trợ trực tiếp.`,
    };
  }

  if (/\b(only evaluate|without any modification|based solely on precedents|single metric|skip testing)\b/i.test(lbl)) {
    return {
      categoryVi: 'Đánh giá phiến diện một chiều, thiếu cân nhắc đánh đổi kỹ thuật (Trade-off)',
      en: `Incorrect. This choice looks at only one side of the problem and ignores the technical trade-off between extending existing capabilities and custom maintenance cost.`,
      vi: `Sai vì chỉ nhìn nhận phiến diện một khía cạnh mà bỏ qua bài toán cân đối chi phí phát triển, khả năng mở rộng và bảo trì lâu dài.`,
    };
  }

  return {
    categoryVi: 'Phương án nhiễu không thỏa mãn đầy đủ yêu cầu kỹ thuật của đề bài',
    en: `Incorrect. This option does not align with the recommended architecture (${correctOptionsText}). Refer to the source explanation for the required mechanism.`,
    vi: `Sai vì cách tiếp cận này không giải quyết triệt để gốc rễ yêu cầu trong đề bài như đáp án đúng (${correctOptionsText}).`,
  };
}

/**
 * Returns complete per-option rationales ("Vì sao câu này đúng / Vì sao câu này sai")
 * for EVERY single option (A, B, C, D, E) of ANY question in the 110-question bank.
 */
export function getCompletePerOptionRationales(question: Question): PerOptionDetailedRationale[] {
  const sourceMap = new Map(
    (question.optionExplanations || []).map((oe) => [oe.optionId, oe.content])
  );

  // Extract main explanation body (excluding the first "Correct answer from the source:" line if there are multiple paragraphs)
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

    if (hasSourceOptionExplanation && sourceBlocks) {
      const enText = extractBlockText(sourceBlocks);
      const viText = translateTechnicalEnglishToVietnamese(enText);
      return {
        optionId: opt.id,
        optionLabel: opt.label,
        isCorrect,
        hasSourceOptionExplanation: true,
        sourceBlocks,
        englishReason: enText,
        vietnameseReason: isCorrect
          ? `Vì sao phương án ${opt.id.toUpperCase()} ĐÚNG: ${viText}`
          : `Vì sao phương án ${opt.id.toUpperCase()} SAI: ${viText}`,
        flawCategoryVi: isCorrect ? 'Đáp án chuẩn theo tài liệu kỹ thuật' : 'Phân tích lỗi từ nguồn',
      };
    }

    // When source only has a general explanation (Q1..Q75), synthesize explicit per-option rationale
    if (isCorrect) {
      const viCore = translateTechnicalEnglishToVietnamese(coreExplanationEn);
      return {
        optionId: opt.id,
        optionLabel: opt.label,
        isCorrect: true,
        hasSourceOptionExplanation: false,
        sourceBlocks: null,
        englishReason: `Correct (${opt.id.toUpperCase()}): ${coreExplanationEn}`,
        vietnameseReason: `Vì sao phương án ${opt.id.toUpperCase()} ĐÚNG: Đây là giải pháp chính xác nhất theo thiết kế của Claude. ${viCore}`,
        flawCategoryVi: 'Đáp án đúng (Giải quyết trực tiếp yêu cầu bài toán)',
      };
    }

    const diag = diagnoseDistractorFlaw(opt, question, `Phương án ${correctIdsUpper}`);
    return {
      optionId: opt.id,
      optionLabel: opt.label,
      isCorrect: false,
      hasSourceOptionExplanation: false,
      sourceBlocks: null,
      englishReason: diag.en,
      vietnameseReason: `Vì sao phương án ${opt.id.toUpperCase()} SAI (${diag.categoryVi}): ${diag.vi}`,
      flawCategoryVi: diag.categoryVi,
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

  // Extract technical terms / backtick tokens or key phrases from prompt
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
  ].filter((kw) => new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(promptText));

  const keyClues = Array.from(new Set([...backtickMatches, ...keywordCandidates])).slice(0, 6);

  let guidingPrincipleVi =
    'Hãy ưu tiên giải pháp đảm bảo tính tất định (deterministic), cô lập phạm vi ảnh hưởng (isolation), tận dụng công cụ tích hợp sẵn (built-in tools) khi đủ đáp ứng và chẩn đoán đúng nguyên nhân gốc rễ từ log/trace trước khi thay đổi kiến trúc.';

  if (tags.includes('Security, Safety & Permissions')) {
    guidingPrincipleVi =
      'Nguyên tắc Bảo mật & An toàn: System prompt không thể thay thế kiểm soát tất định (deterministic filtering/guardrails). Khóa API phải tách biệt theo từng môi trường. Quy tắc phân quyền (permissions.deny) ở phạm vi dự án không thể bị vượt qua bởi allow cục bộ.';
  } else if (tags.includes('Tools & MCP Servers')) {
    guidingPrincipleVi =
      'Nguyên tắc Công cụ & MCP: Ưu tiên dùng Built-in Tools (Read, Edit, Bash, Grep...) cho tác vụ cục bộ. Dùng Custom Tool qua In-process MCP Server khi cần gọi dịch vụ nội bộ (internal REST gateway), và dùng MCP Server độc lập khi cần chia sẻ tool cho nhiều ứng dụng.';
  } else if (tags.includes('Models, Cost & Batches API')) {
    guidingPrincipleVi =
      'Nguyên tắc Model & Batches API: Message Batches API phù hợp cho tác vụ bất đồng bộ số lượng lớn (tối đa 100.000 requests hoặc 256 MB, xử lý trong 24h, tải kết quả trong 29 ngày, không hỗ trợ stream). Sonnet cân bằng tốc độ và trí tuệ; Haiku tối ưu tốc độ/chi phí; Opus cho tác vụ phức tạp dài hạn.';
  } else if (tags.includes('Claude Code & CLI')) {
    guidingPrincipleVi =
      'Nguyên tắc Claude Code: Chú ý thứ tự ưu tiên cấu hình (Managed/Enterprise > CLI args > .claude/settings.local.json > .claude/settings.json > ~/.claude/settings.json), cơ chế gộp quyền (deny luôn thắng allow), và cơ chế fallback model khi `--resume` gặp model đã ngừng hoạt động.';
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
