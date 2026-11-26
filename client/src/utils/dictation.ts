export interface DiffToken {
  type: 'correct' | 'missing' | 'extra' | 'wrong';
  expected?: string;
  actual?: string;
}

export interface DictationCheckResult {
  accuracy: number;
  correctCount: number;
  totalExpected: number;
  tokens: DiffToken[];
  isPerfect: boolean;
}

export const TOPICS = [
  { id: 'all', label: 'Tất cả chủ đề', badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200' },
  { id: 'ted', label: 'TED Talks & Cảm hứng', badge: 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300' },
  { id: 'daily', label: 'Giao tiếp hằng ngày', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' },
  { id: 'ielts', label: 'IELTS & Học thuật', badge: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300' },
  { id: 'business', label: 'Công sở & Công nghệ', badge: 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300' },
  { id: 'travel', label: 'Du lịch & Văn hóa', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' },
  { id: 'stories', label: 'Phim ảnh & Kể chuyện', badge: 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300' },
];

export const LEVELS = ['all', 'A1', 'A2', 'B1', 'B2', 'C1'];

export function getTopicMeta(topicId: string) {
  return TOPICS.find((t) => t.id === topicId) || TOPICS[0];
}

export function getLevelColor(level: string) {
  switch (level) {
    case 'A1':
    case 'A2':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300';
    case 'B1':
    case 'B2':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300';
    case 'C1':
    case 'C2':
      return 'bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300';
    default:
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
  }
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds || 0));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^a-z0-9'-]/g, '')
    .replace(/^'+|'+$/g, '')
    .trim();
}

function tokenize(text: string): { raw: string; norm: string }[] {
  return text
    .replace(/[—–]/g, ' ')
    .split(/\s+/)
    .map((raw) => ({ raw, norm: normalizeWord(raw) }))
    .filter((t) => t.norm.length > 0);
}

/**
 * Word-level LCS diff comparing user dictation against target English sentence.
 */
export function evaluateDictation(userInput: string, targetText: string): DictationCheckResult {
  const expected = tokenize(targetText);
  const actual = tokenize(userInput);

  if (expected.length === 0) {
    return { accuracy: 100, correctCount: 0, totalExpected: 0, tokens: [], isPerfect: true };
  }

  const m = expected.length;
  const n = actual.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (expected[i - 1].norm === actual[j - 1].norm) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack LCS
  const rawOps: DiffToken[] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && expected[i - 1].norm === actual[j - 1].norm) {
      rawOps.push({ type: 'correct', expected: expected[i - 1].raw, actual: actual[j - 1].raw });
      i--;
      j--;
    } else if (i > 0 && (j === 0 || dp[i - 1][j] >= dp[i][j - 1])) {
      rawOps.push({ type: 'missing', expected: expected[i - 1].raw });
      i--;
    } else {
      rawOps.push({ type: 'extra', actual: actual[j - 1].raw });
      j--;
    }
  }
  rawOps.reverse();

  // Pair adjacent extra + missing into a single "wrong" substitution for clear visual feedback
  const tokens: DiffToken[] = [];
  for (let k = 0; k < rawOps.length; k++) {
    const cur = rawOps[k];
    const next = rawOps[k + 1];
    if (cur.type === 'missing' && next && next.type === 'extra') {
      tokens.push({ type: 'wrong', expected: cur.expected, actual: next.actual });
      k++;
    } else if (cur.type === 'extra' && next && next.type === 'missing') {
      tokens.push({ type: 'wrong', expected: next.expected, actual: cur.actual });
      k++;
    } else {
      tokens.push(cur);
    }
  }

  const correctCount = dp[m][n];
  const extraPenalty = Math.max(0, actual.length - expected.length) * 0.4;
  const rawScore = Math.max(0, ((correctCount - extraPenalty) / m) * 100);
  const accuracy = Math.min(100, Math.round(rawScore));

  return {
    accuracy,
    correctCount,
    totalExpected: m,
    tokens,
    isPerfect: correctCount === m && actual.length === m,
  };
}

/**
 * Progressive hint: reveals the next missing/wrong word cleanly.
 */
export function generateNextHint(userInput: string, targetText: string): {
  nextInput: string;
  hintedWord: string | null;
} {
  const expected = tokenize(targetText);
  const actual = tokenize(userInput);

  let matchIdx = 0;
  while (
    matchIdx < expected.length &&
    matchIdx < actual.length &&
    expected[matchIdx].norm === actual[matchIdx].norm
  ) {
    matchIdx++;
  }

  if (matchIdx >= expected.length) {
    return { nextInput: targetText, hintedWord: null };
  }

  const prefix = expected.slice(0, matchIdx + 1).map((t) => t.raw);
  return {
    nextInput: prefix.join(' ') + (matchIdx + 1 < expected.length ? ' ' : ''),
    hintedWord: expected[matchIdx].raw,
  };
}

/**
 * Web Speech API English pronunciation helper (supports US / UK accent + playback speed).
 */
export function speakEnglish(
  text: string,
  options?: { rate?: number; accent?: string; onEnd?: () => void }
) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    options?.onEnd?.();
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const wantUK = options?.accent?.toUpperCase() === 'UK';
  utterance.lang = wantUK ? 'en-GB' : 'en-US';
  utterance.rate = options?.rate ?? 1.0;

  const voices = window.speechSynthesis.getVoices();
  const preferred =
    voices.find((v) => v.lang.toLowerCase() === (wantUK ? 'en-gb' : 'en-us')) ||
    voices.find((v) => v.lang.toLowerCase().startsWith('en'));
  if (preferred) {
    utterance.voice = preferred;
  }

  if (options?.onEnd) {
    utterance.onend = options.onEnd;
    utterance.onerror = options.onEnd;
  }
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
