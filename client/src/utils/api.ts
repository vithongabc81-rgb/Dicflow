import type {
  Lesson,
  MistakeItem,
  ProgressSummary,
  Sentence,
  User,
  VocabularyItem,
  WordLookupResult,
} from '../types';

const TOKEN_KEY = 'dictaflow_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Yêu cầu thất bại (${res.status})`);
  }
  return data as T;
}

export const api = {
  // Auth
  register: (payload: { name: string; email: string; password: string }) =>
    request<{ token: string; user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  login: (payload: { email: string; password: string }) =>
    request<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  loginDemo: () =>
    request<{ token: string; user: User }>('/api/auth/demo', {
      method: 'POST',
    }),
  getMe: () => request<{ user: User }>('/api/auth/me'),
  updateProfile: (payload: { name?: string; daily_goal?: number }) =>
    request<{ user: User }>('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  // Lessons
  getLessons: (params?: Record<string, string>) => {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return request<{ lessons: Lesson[] }>(`/api/lessons${qs ? `?${qs}` : ''}`);
  },
  getLessonDetail: (id: number) =>
    request<{ lesson: Lesson; sentences: Sentence[] }>(`/api/lessons/${id}`),
  createLesson: (formData: FormData) =>
    request<{ lesson: Lesson }>('/api/lessons', {
      method: 'POST',
      body: formData,
    }),
  deleteLesson: (id: number) =>
    request<{ ok: boolean }>(`/api/lessons/${id}`, { method: 'DELETE' }),
  parseSubtitles: (formData: FormData) =>
    request<{
      sentences: { start_time: number; end_time: number; text_en: string; text_vi: string }[];
      count: number;
    }>('/api/lessons/parse-subtitles', {
      method: 'POST',
      body: formData,
    }),
  fetchYouTubeCaptions: (youtube_url: string) =>
    request<{
      videoId: string;
      title: string;
      author: string;
      duration_sec: number;
      thumbnail_url: string;
      has_captions: boolean;
      blocked_by_youtube?: boolean;
      error?: string;
      track_language?: string;
      is_auto_generated?: boolean;
      has_vietnamese?: boolean;
      sentences: { start_time: number; end_time: number; text_en: string; text_vi: string }[];
    }>('/api/lessons/fetch-youtube', {
      method: 'POST',
      body: JSON.stringify({ youtube_url }),
    }),

  // Progress & Mistakes
  saveAttempt: (payload: {
    lesson_id: number;
    sentence_id: number;
    user_input: string;
    accuracy: number;
    duration_sec?: number;
  }) =>
    request<{
      ok: boolean;
      accuracy: number;
      is_mastered: boolean;
      needs_review: boolean;
      streak_count: number;
    }>('/api/progress/attempt', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getProgressSummary: () => request<ProgressSummary>('/api/progress/summary'),
  getMistakes: () => request<{ mistakes: MistakeItem[] }>('/api/progress/mistakes'),
  resolveMistake: (sentenceId: number, payload: { accuracy: number; user_input: string }) =>
    request<{ ok: boolean; streak_count: number }>(`/api/progress/mistakes/${sentenceId}/resolve`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Vocabulary
  lookupWord: (word: string) =>
    request<WordLookupResult>(`/api/vocab/lookup/${encodeURIComponent(word)}`),
  getVocab: (params?: { filter?: string; search?: string }) => {
    const qs = params ? new URLSearchParams(params as Record<string, string>).toString() : '';
    return request<{ vocabulary: VocabularyItem[] }>(`/api/vocab${qs ? `?${qs}` : ''}`);
  },
  saveVocab: (payload: {
    word: string;
    phonetic?: string;
    part_of_speech?: string;
    meaning_vi?: string;
    example_en?: string;
    lesson_id?: number | null;
  }) =>
    request<{ item: VocabularyItem; alreadyExisted: boolean }>('/api/vocab', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateVocab: (
    id: number,
    payload: {
      meaning_vi?: string;
      phonetic?: string;
      part_of_speech?: string;
      example_en?: string;
      mastery_level?: number;
      increment_review?: boolean;
    }
  ) =>
    request<{ item: VocabularyItem }>(`/api/vocab/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteVocab: (id: number) =>
    request<{ ok: boolean }>(`/api/vocab/${id}`, { method: 'DELETE' }),
};
