import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  Eye,
  EyeOff,
  CheckCircle2,
  Repeat,
  Languages,
  Trophy,
  Sparkles,
  FileText,
  Keyboard,
  Volume2,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { api } from '../utils/api';
import {
  evaluateDictation,
  formatTime,
  generateNextHint,
  getLevelColor,
  getTopicMeta,
  speakEnglish,
  type DictationCheckResult,
} from '../utils/dictation';
import { useAuth } from '../context/AuthContext';
import { MediaPlayer, type MediaPlayerHandle } from '../components/MediaPlayer';
import { WordPopover } from '../components/WordPopover';
import type { Lesson, Sentence } from '../types';

interface PracticePageProps {
  lessonId: number;
  onBack: () => void;
  onOpenMistakes: () => void;
}

const SPEEDS = [0.5, 0.75, 0.9, 1.0, 1.25, 1.5];

export function PracticePage({ lessonId, onBack, onOpenMistakes }: PracticePageProps) {
  const { user, setAuthModalOpen, updateLocalStreak } = useAuth();
  const playerRef = useRef<MediaPlayerHandle | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const activeChipRef = useRef<HTMLButtonElement | null>(null);
  const sentenceStartTs = useRef<number>(Date.now());

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [currentIndex, setCurrentIndex] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [checkResult, setCheckResult] = useState<DictationCheckResult | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showVietnamese, setShowVietnamese] = useState(false);
  const [showFullTranscript, setShowFullTranscript] = useState(false);

  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [loopSegment, setLoopSegment] = useState(false);
  const [forceTTS, setForceTTS] = useState(false);

  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [hintToast, setHintToast] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api
      .getLessonDetail(lessonId)
      .then((data) => {
        if (!active) return;
        setLesson(data.lesson);
        setSentences(data.sentences);
        // Jump to first unmastered sentence if user has progress
        const firstPending = data.sentences.findIndex((s) => !s.attempt?.is_mastered);
        const startIdx = firstPending >= 0 ? firstPending : 0;
        setCurrentIndex(startIdx);
        setUserInput(data.sentences[startIdx]?.attempt?.last_input || '');
        setCheckResult(null);
        setShowAnswer(false);
        setSelectedWord(null);
        sentenceStartTs.current = Date.now();
      })
      .catch((err) => {
        if (active) setError(err.message || 'Không thể tải bài học.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [lessonId, user?.id]);

  const currentSentence = sentences[currentIndex] || null;

  // Keep active sentence pill scrolled into view in the horizontal navigator
  useEffect(() => {
    activeChipRef.current?.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    });
  }, [currentIndex]);

  const goToSentence = (idx: number, autoPlay = true) => {
    if (idx < 0 || idx >= sentences.length) return;
    const target = sentences[idx];
    setCurrentIndex(idx);
    setUserInput(target?.attempt?.is_mastered ? target.text_en : '');
    setCheckResult(null);
    setShowAnswer(false);
    setSelectedWord(null);
    setHintToast('');
    sentenceStartTs.current = Date.now();

    if (autoPlay && target) {
      // Call synchronously inside click handler so mobile browsers allow immediate seek & play!
      playerRef.current?.playSegment(target.start_time, target.end_time, target.text_en);
    } else {
      playerRef.current?.stop();
    }
    setTimeout(() => {
      inputRef.current?.focus();
    }, 60);
  };

  const handleCheck = async () => {
    if (!currentSentence || !lesson) return;
    const result = evaluateDictation(userInput, currentSentence.text_en);
    setCheckResult(result);

    const elapsedSec = Math.max(5, Math.round((Date.now() - sentenceStartTs.current) / 1000));
    const isMastered = result.accuracy >= 92;

    // Update local sentence state immediately
    setSentences((prev) =>
      prev.map((s, idx) =>
        idx === currentIndex
          ? {
              ...s,
              attempt: {
                last_input: userInput,
                best_accuracy: Math.max(s.attempt?.best_accuracy || 0, result.accuracy),
                last_accuracy: result.accuracy,
                attempts_count: (s.attempt?.attempts_count || 0) + 1,
                is_mastered: Boolean(s.attempt?.is_mastered || isMastered),
                needs_review: !isMastered,
              },
            }
          : s
      )
    );

    if (user) {
      try {
        const saved = await api.saveAttempt({
          lesson_id: lesson.id,
          sentence_id: currentSentence.id,
          user_input: userInput,
          accuracy: result.accuracy,
          duration_sec: elapsedSec,
        });
        if (saved.streak_count) {
          updateLocalStreak(saved.streak_count);
        }
      } catch (err) {
        console.error('Save attempt failed:', err);
      }
    }
  };

  const handleHint = () => {
    if (!currentSentence) return;
    const { nextInput, hintedWord } = generateNextHint(userInput, currentSentence.text_en);
    setUserInput(nextInput);
    if (hintedWord) {
      setHintToast(`Gợi ý từ tiếp theo: "${hintedWord}"`);
      setTimeout(() => setHintToast(''), 2500);
    }
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      playerRef.current?.replaySegment();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (checkResult && checkResult.accuracy >= 92 && currentIndex < sentences.length - 1) {
        goToSentence(currentIndex + 1, true);
      } else {
        handleCheck();
      }
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
      e.preventDefault();
      handleHint();
    } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      setShowAnswer((v) => !v);
    }
  };

  const renderClickableSentence = (text: string) => {
    return text.split(/(\s+)/).map((part, idx) => {
      if (!part.trim()) return <span key={idx}>{part}</span>;
      const clean = part.replace(/[^a-zA-Z'-]/g, '');
      if (!clean) return <span key={idx}>{part}</span>;
      return (
        <button
          key={idx}
          type="button"
          onClick={() => setSelectedWord(clean)}
          className="hover:bg-indigo-200/70 dark:hover:bg-indigo-800/60 hover:text-indigo-900 dark:hover:text-indigo-100 rounded px-0.5 transition cursor-pointer underline decoration-dotted decoration-indigo-400/60 underline-offset-4"
          title="Nhấn để tra từ & lưu Flashcard"
        >
          {part}
        </button>
      );
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <span className="text-sm">Đang chuẩn bị phòng luyện nghe...</span>
      </div>
    );
  }

  if (error || !lesson || !currentSentence) {
    return (
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-center">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <p className="font-semibold text-slate-800 dark:text-slate-100">{error || 'Bài học chưa có câu nào.'}</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold cursor-pointer"
        >
          Quay lại danh sách
        </button>
      </div>
    );
  }

  const masteredCount = sentences.filter((s) => s.attempt?.is_mastered).length;
  const allCompleted = sentences.length > 0 && masteredCount === sentences.length;
  const topicMeta = getTopicMeta(lesson.topic);

  return (
    <div className="space-y-5">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => {
              playerRef.current?.stop();
              onBack();
            }}
            className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title="Quay lại"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${topicMeta.badge}`}>
                {topicMeta.label}
              </span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${getLevelColor(lesson.level)}`}>
                {lesson.level}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Giọng {lesson.accent}
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white truncate mt-0.5">
              {lesson.title}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold">
            Đã đạt:{' '}
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
              {masteredCount}/{sentences.length} câu
            </span>
          </div>
          {!user && (
            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-xs font-semibold hover:bg-amber-200 transition cursor-pointer"
            >
              Đăng nhập để lưu tiến độ
            </button>
          )}
        </div>
      </div>

      {/* Completion Banner */}
      {allCompleted && (
        <div className="rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 p-4 sm:p-5 text-white flex flex-wrap items-center justify-between gap-4 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center">
              <Trophy className="w-6 h-6 text-amber-200" />
            </div>
            <div>
              <h2 className="font-bold text-base">Xuất sắc! Bạn đã hoàn thành toàn bộ bài học này!</h2>
              <p className="text-xs text-emerald-100">
                Hãy tiếp tục luyện bài mới hoặc ôn lại các câu từng gõ sai để ghi nhớ lâu hơn.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenMistakes}
              className="px-3.5 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-semibold transition cursor-pointer"
            >
              Ôn câu hay sai
            </button>
            <button
              type="button"
              onClick={onBack}
              className="px-4 py-2 rounded-xl bg-white text-emerald-700 text-xs font-bold hover:bg-emerald-50 transition cursor-pointer"
            >
              Chọn bài tiếp theo
            </button>
          </div>
        </div>
      )}

      {/* Main 2-Column Studio */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: Video / Audio Player & Controls */}
        <div className="lg:col-span-5 space-y-4">
          <MediaPlayer
            ref={playerRef}
            mediaType={lesson.media_type}
            youtubeId={lesson.youtube_id}
            mediaUrl={lesson.media_url}
            thumbnailUrl={lesson.thumbnail_url}
            accent={lesson.accent}
            speaker={lesson.speaker}
            startTime={currentSentence.start_time}
            endTime={currentSentence.end_time}
            sentenceText={currentSentence.text_en}
            playbackRate={playbackRate}
            loopSegment={loopSegment}
            forceTTS={forceTTS}
            onToggleForceTTS={() => setForceTTS((v) => !v)}
          />

          {/* Speed & Loop Toolbar */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Tốc độ phát
              </span>
              <div className="flex items-center gap-1 flex-wrap">
                {SPEEDS.map((sp) => (
                  <button
                    key={sp}
                    type="button"
                    onClick={() => setPlaybackRate(sp)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      playbackRate === sp
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {sp}x
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setLoopSegment((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  loopSegment
                    ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                <Repeat className="w-3.5 h-3.5" />
                Tự lặp lại câu: {loopSegment ? 'BẬT' : 'TẮT'}
              </button>

              <button
                type="button"
                onClick={() => setShowFullTranscript((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                {showFullTranscript ? 'Ẩn lời thoại' : 'Xem toàn bộ lời thoại'}
              </button>
            </div>
          </div>

          {/* Keyboard Shortcuts Legend */}
          <div className="p-3.5 rounded-2xl bg-slate-100/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300 mb-2">
              <Keyboard className="w-4 h-4 text-indigo-500" /> Phím tắt luyện nghe nhanh
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div><kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono">Tab</kbd> Nghe lại câu</div>
              <div><kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono">Enter</kbd> Kiểm tra / Tiếp</div>
              <div><kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono">Ctrl+H</kbd> Gợi ý từ tiếp</div>
              <div><kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono">Ctrl+Shift+S</kbd> Hiện đáp án</div>
            </div>
          </div>
        </div>

        {/* Right: Dictation Workspace */}
        <div className="lg:col-span-7 space-y-4">
          {/* Sentence Navigator Strip (scales smoothly to 300+ sentences) */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  Câu {currentIndex + 1} / {sentences.length}
                </span>
                <select
                  value={currentIndex}
                  onChange={(e) => goToSentence(Number(e.target.value), true)}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                  aria-label="Chuyển nhanh tới câu"
                >
                  {sentences.map((s, idx) => (
                    <option key={s.id} value={idx}>
                      Câu {idx + 1} ({formatTime(s.start_time)})
                      {s.attempt?.is_mastered ? ' ✓' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentIndex === 0}
                  onClick={() => goToSentence(currentIndex - 1, true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" /> Trước
                </button>
                <button
                  type="button"
                  disabled={currentIndex >= sentences.length - 1}
                  onClick={() => goToSentence(currentIndex + 1, true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold disabled:opacity-40 cursor-pointer"
                >
                  Tiếp <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Compact horizontal scrollable sentence pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-1 px-0.5">
              {sentences.map((s, idx) => {
                const isCurrent = idx === currentIndex;
                const mastered = s.attempt?.is_mastered;
                const needsReview = s.attempt?.needs_review;
                return (
                  <button
                    key={s.id}
                    ref={isCurrent ? activeChipRef : null}
                    type="button"
                    onClick={() => goToSentence(idx, true)}
                    className={`shrink-0 min-w-8 h-8 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                      isCurrent
                        ? 'bg-indigo-600 text-white ring-2 ring-indigo-400 ring-offset-1 dark:ring-offset-slate-900'
                        : mastered
                        ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                        : needsReview
                        ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dictation Typing Box */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between gap-2">
              <label className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Nghe và gõ lại chính xác những gì bạn nghe được:
              </label>
              <span className="text-xs text-slate-400">
                {currentSentence.text_en.split(/\s+/).length} từ
              </span>
            </div>

            <textarea
              ref={inputRef}
              rows={3}
              value={userInput}
              onChange={(e) => {
                setUserInput(e.target.value);
                if (checkResult) setCheckResult(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Gõ câu tiếng Anh bạn nghe được... (Nhấn Tab để nghe lại, Enter để kiểm tra)"
              className="w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-700 focus:border-indigo-500 focus:outline-none text-base font-medium leading-relaxed resize-none transition"
            />

            {hintToast && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-medium">
                <Sparkles className="w-4 h-4 shrink-0" /> {hintToast}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleCheck}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-sm transition cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Kiểm tra
                </button>
                <button
                  type="button"
                  onClick={handleHint}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-amber-100 dark:bg-amber-950/60 hover:bg-amber-200 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 text-sm font-semibold transition cursor-pointer"
                >
                  <Lightbulb className="w-4 h-4" />
                  Gợi ý từ
                </button>
                <button
                  type="button"
                  onClick={() => setShowAnswer((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold transition cursor-pointer"
                >
                  {showAnswer ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  {showAnswer ? 'Ẩn đáp án' : 'Xem đáp án'}
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowVietnamese((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  showVietnamese
                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                <Languages className="w-4 h-4" />
                {showVietnamese ? 'Ẩn dịch Việt' : 'Dịch nghĩa'}
              </button>
            </div>

            {/* Word-by-word Diff Feedback */}
            {checkResult && (
              <div
                className={`p-4 rounded-2xl border ${
                  checkResult.accuracy >= 92
                    ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                    : 'bg-rose-50/70 dark:bg-rose-950/25 border-rose-200 dark:border-rose-900'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-extrabold px-3 py-1 rounded-full ${
                        checkResult.accuracy >= 92
                          ? 'bg-emerald-600 text-white'
                          : checkResult.accuracy >= 70
                          ? 'bg-amber-500 text-white'
                          : 'bg-rose-600 text-white'
                      }`}
                    >
                      Độ chính xác: {checkResult.accuracy}%
                    </span>
                    <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                      Đúng {checkResult.correctCount}/{checkResult.totalExpected} từ
                    </span>
                  </div>
                  {checkResult.accuracy >= 92 && currentIndex < sentences.length - 1 && (
                    <button
                      type="button"
                      onClick={() => goToSentence(currentIndex + 1, true)}
                      className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer"
                    >
                      Câu tiếp theo <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Diff Tokens — Clickable to look up / save vocab */}
                <div className="flex flex-wrap gap-1.5 leading-loose text-base">
                  {checkResult.tokens.map((tok, i) => {
                    if (tok.type === 'correct') {
                      const clean = (tok.expected || '').replace(/[^a-zA-Z'-]/g, '');
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => clean && setSelectedWord(clean)}
                          className="px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 font-semibold hover:ring-2 hover:ring-emerald-400 cursor-pointer"
                          title="Từ đúng — Nhấn để tra & lưu Flashcard"
                        >
                          {tok.expected}
                        </button>
                      );
                    }
                    if (tok.type === 'wrong') {
                      const clean = (tok.expected || '').replace(/[^a-zA-Z'-]/g, '');
                      return (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800"
                        >
                          <span className="line-through text-rose-600 dark:text-rose-400 text-sm">
                            {tok.actual}
                          </span>
                          <button
                            type="button"
                            onClick={() => clean && setSelectedWord(clean)}
                            className="text-emerald-700 dark:text-emerald-300 font-bold hover:underline cursor-pointer"
                            title="Đáp án đúng — Nhấn để lưu từ vựng"
                          >
                            {tok.expected}
                          </button>
                        </span>
                      );
                    }
                    if (tok.type === 'missing') {
                      const clean = (tok.expected || '').replace(/[^a-zA-Z'-]/g, '');
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => clean && setSelectedWord(clean)}
                          className="px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-200 border border-dashed border-amber-400 font-semibold cursor-pointer"
                          title="Từ bị thiếu — Nhấn để tra & lưu từ vựng"
                        >
                          {tok.expected}
                        </button>
                      );
                    }
                    return (
                      <span
                        key={i}
                        className="px-1.5 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-rose-500 line-through text-sm"
                        title="Từ dư"
                      >
                        {tok.actual}
                      </span>
                    );
                  })}
                </div>

                <p className="mt-2.5 text-[11px] text-slate-500 dark:text-slate-400">
                  Mẹo: Nhấn trực tiếp vào bất kỳ từ tiếng Anh nào ở trên để nghe phát âm, xem nghĩa và lưu vào sổ Flashcard!
                </p>
              </div>
            )}

            {/* Answer Reveal Panel */}
            {showAnswer && (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    Đáp án chuẩn (Nhấn từ bất kỳ để tra & lưu)
                  </span>
                  <button
                    type="button"
                    onClick={() => speakEnglish(currentSentence.text_en, { rate: 0.9, accent: lesson.accent })}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5" /> Đọc chậm câu này
                  </button>
                </div>
                <p className="text-base font-semibold text-slate-900 dark:text-white leading-relaxed">
                  {renderClickableSentence(currentSentence.text_en)}
                </p>
              </div>
            )}

            {/* Vietnamese Translation */}
            {(showVietnamese || (checkResult && checkResult.accuracy >= 92)) && currentSentence.text_vi && (
              <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900 text-sm text-emerald-900 dark:text-emerald-200">
                <span className="font-bold mr-1.5">Dịch nghĩa:</span>
                {currentSentence.text_vi}
              </div>
            )}

            {/* Key Vocabulary Chips */}
            {currentSentence.keywords && currentSentence.keywords.length > 0 && (showAnswer || checkResult) && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Từ khóa đáng chú ý:
                </span>
                {currentSentence.keywords.map((kw, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelectedWord(kw.word)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/70 border border-indigo-200 dark:border-indigo-800 text-xs transition cursor-pointer"
                  >
                    <span className="font-bold text-indigo-700 dark:text-indigo-300">{kw.word}</span>
                    {kw.meaning_vi && (
                      <span className="text-slate-600 dark:text-slate-300">({kw.meaning_vi})</span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Interactive Word Lookup & Save Popover */}
            <WordPopover
              word={selectedWord}
              exampleSentence={currentSentence.text_en}
              lessonId={lesson.id}
              accent={lesson.accent}
              onClose={() => setSelectedWord(null)}
            />
          </div>

          {/* Full Transcript Collapsible Panel */}
          {showFullTranscript && (
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Toàn bộ lời thoại bài học ({sentences.length} câu)
                </h3>
                <span className="text-xs text-slate-400">Nhấn vào một câu để chuyển tới câu đó</span>
              </div>
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {sentences.map((s, idx) => (
                  <div
                    key={s.id}
                    onClick={() => goToSentence(idx, true)}
                    className={`p-3 rounded-xl border transition cursor-pointer ${
                      idx === currentIndex
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700'
                        : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200/70 dark:border-slate-800 hover:border-indigo-300'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">Câu {idx + 1}</span>
                      <span className="font-mono">
                        {formatTime(s.start_time)} – {formatTime(s.end_time)}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{s.text_en}</p>
                    {s.text_vi && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{s.text_vi}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
