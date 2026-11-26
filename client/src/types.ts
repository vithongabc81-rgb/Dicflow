export interface User {
  id: number;
  name: string;
  email: string;
  daily_goal: number;
  streak_count: number;
  last_active_date: string | null;
  created_at?: string;
}

export interface KeywordItem {
  word: string;
  phonetic?: string;
  meaning_vi?: string;
}

export interface SentenceAttempt {
  last_input: string;
  best_accuracy: number;
  last_accuracy: number;
  attempts_count: number;
  is_mastered: boolean;
  needs_review: boolean;
}

export interface Sentence {
  id: number;
  lesson_id: number;
  seq_index: number;
  start_time: number;
  end_time: number;
  text_en: string;
  text_vi: string;
  keywords: KeywordItem[];
  attempt: SentenceAttempt | null;
}

export interface LessonProgress {
  attempted_count: number;
  mastered_count: number;
  total_sentences: number;
  percent: number;
  avg_accuracy: number;
}

export interface Lesson {
  id: number;
  slug: string;
  title: string;
  description: string;
  topic: string;
  level: string;
  media_type: 'youtube' | 'upload_video' | 'upload_audio' | 'audio_tts';
  youtube_id: string | null;
  media_url: string | null;
  thumbnail_url: string | null;
  duration_sec: number;
  accent: string;
  speaker: string;
  is_official: number;
  user_id: number | null;
  sentence_count?: number;
  progress?: LessonProgress;
  created_at?: string;
}

export interface VocabularyItem {
  id: number;
  user_id: number;
  word: string;
  phonetic: string;
  part_of_speech: string;
  meaning_vi: string;
  example_en: string;
  lesson_id: number | null;
  mastery_level: number;
  review_count: number;
  created_at: string;
}

export interface MistakeItem {
  attempt_id: number;
  last_input: string;
  last_accuracy: number;
  best_accuracy: number;
  attempts_count: number;
  updated_at: string;
  sentence_id: number;
  seq_index: number;
  start_time: number;
  end_time: number;
  text_en: string;
  text_vi: string;
  lesson_id: number;
  lesson_title: string;
  topic: string;
  level: string;
  media_type: string;
  youtube_id: string | null;
  media_url: string | null;
  accent: string;
}

export interface ProgressSummary {
  streak_count: number;
  daily_goal: number;
  today_sentences: number;
  today_minutes: number;
  total_minutes: number;
  total_attempted: number;
  total_mastered: number;
  mistakes_count: number;
  avg_accuracy: number;
  completed_lessons: number;
  vocab_total: number;
  vocab_mastered: number;
  last_7_days: {
    date: string;
    label: string;
    sentences: number;
    avg_accuracy: number;
  }[];
  topic_stats: {
    topic: string;
    sentences_practiced: number;
    mastered: number;
    avg_accuracy: number;
  }[];
  recent_lessons: {
    id: number;
    title: string;
    topic: string;
    level: string;
    total_s: number;
    attempted_s: number;
    mastered_s: number;
    avg_acc: number;
    last_practiced: string;
  }[];
}

export interface WordLookupResult {
  word: string;
  phonetic: string;
  part_of_speech: string;
  meaning_vi: string;
  definition_en: string;
}

export type PageRoute = 'explore' | 'practice' | 'create' | 'vocab' | 'mistakes' | 'dashboard';
