import React, { useEffect, useState } from 'react';
import {
  Volume2,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  Lock,
  Loader2,
  AlertTriangle,
  Eye,
} from 'lucide-react';
import { api } from '../utils/api';
import {
  evaluateDictation,
  getLevelColor,
  getTopicMeta,
  speakEnglish,
  type DictationCheckResult,
} from '../utils/dictation';
import { useAuth } from '../context/AuthContext';
import type { MistakeItem } from '../types';

interface MistakesPageProps {
  onOpenLesson: (lessonId: number) => void;
}

export function MistakesPage({ onOpenLesson }: MistakesPageProps) {
  const { user, setAuthModalOpen, updateLocalStreak } = useAuth();
  const [mistakes, setMistakes] = useState<MistakeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [drillInput, setDrillInput] = useState('');
  const [drillResult, setDrillResult] = useState<DictationCheckResult | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [resolvedToast, setResolvedToast] = useState('');

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .getMistakes()
      .then((res) => {
        setMistakes(res.mistakes);
        if (res.mistakes.length > 0) {
          setActiveId(res.mistakes[0].sentence_id);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user?.id]);

  if (!user) {
    return (
      <div className="max-w-xl mx-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-center shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-950 flex items-center justify-center mx-auto mb-4 text-amber-600 dark:text-amber-400">
          <Lock className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          Ôn tập câu hay gõ sai
        </h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Hệ thống tự động gom các câu bạn nghe chưa chính xác để bạn luyện tập lại cho đến khi làm chủ hoàn toàn.
        </p>
        <button
          type="button"
          onClick={() => setAuthModalOpen(true)}
          className="mt-5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition cursor-pointer"
        >
          Đăng nhập / Dùng thử Demo
        </button>
      </div>
    );
  }

  const activeMistake = mistakes.find((m) => m.sentence_id === activeId) || mistakes[0] || null;

  const selectMistake = (m: MistakeItem) => {
    setActiveId(m.sentence_id);
    setDrillInput('');
    setDrillResult(null);
    setShowAnswer(false);
  };

  const handleCheckDrill = async () => {
    if (!activeMistake) return;
    const res = evaluateDictation(drillInput, activeMistake.text_en);
    setDrillResult(res);

    if (res.accuracy >= 92) {
      try {
        const saved = await api.resolveMistake(activeMistake.sentence_id, {
          accuracy: res.accuracy,
          user_input: drillInput,
        });
        if (saved.streak_count) updateLocalStreak(saved.streak_count);
        setResolvedToast(`Tuyệt vời! Đã hoàn thành câu ôn tập với độ chính xác ${res.accuracy}%.`);
        setTimeout(() => setResolvedToast(''), 3000);
        setMistakes((prev) => {
          const next = prev.filter((x) => x.sentence_id !== activeMistake.sentence_id);
          setActiveId(next[0]?.sentence_id ?? null);
          return next;
        });
        setDrillInput('');
        setDrillResult(null);
        setShowAnswer(false);
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
          Ôn tập câu hay sai ({mistakes.length})
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Luyện nghe và gõ lại các câu có độ chính xác dưới 92% cho đến khi bạn làm chủ hoàn toàn.
        </p>
      </div>

      {resolvedToast && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-sm font-semibold flex items-center gap-2">
          <Sparkles className="w-4 h-4 shrink-0" /> {resolvedToast}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-indigo-500" />
        </div>
      ) : mistakes.length === 0 ? (
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-12 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Tuyệt vời! Bạn không còn câu sai nào cần ôn tập.
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Mỗi khi có câu luyện nghe dưới 92% chính xác, câu đó sẽ tự động xuất hiện tại đây.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left: Mistake List */}
          <div className="lg:col-span-5 space-y-2.5">
            {mistakes.map((m) => {
              const selected = activeMistake?.sentence_id === m.sentence_id;
              return (
                <div
                  key={m.sentence_id}
                  onClick={() => selectMistake(m)}
                  className={`p-4 rounded-2xl border transition cursor-pointer ${
                    selected
                      ? 'bg-indigo-50/90 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-700 shadow-xs'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
                      {m.lesson_title}
                    </span>
                    <span className="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                      {m.last_accuracy}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className={`px-2 py-0.5 rounded-md font-bold ${getLevelColor(m.level)}`}>
                      {m.level}
                    </span>
                    <span>{getTopicMeta(m.topic).label}</span>
                    <span>• Câu #{m.seq_index + 1}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: Active Mistake Drill Panel */}
          {activeMistake && (
            <div className="lg:col-span-7 p-6 rounded-3xl glass-card border border-slate-200/80 dark:border-white/10 space-y-4 shadow-md">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                    {activeMistake.lesson_title} • Câu #{activeMistake.seq_index + 1}
                  </span>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    Lần trước bạn gõ ({activeMistake.last_accuracy}%):{' '}
                    <span className="italic">“{activeMistake.last_input || '(bỏ trống)'}”</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenLesson(activeMistake.lesson_id)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  Mở bài gốc <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Audio Controls */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    speakEnglish(activeMistake.text_en, {
                      rate: 1.0,
                      accent: activeMistake.accent,
                    })
                  }
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition cursor-pointer"
                >
                  <Volume2 className="w-4 h-4" /> Nghe tốc độ chuẩn (1.0x)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    speakEnglish(activeMistake.text_en, {
                      rate: 0.75,
                      accent: activeMistake.accent,
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold transition cursor-pointer"
                >
                  <Volume2 className="w-4 h-4" /> Nghe chậm (0.75x)
                </button>
                <button
                  type="button"
                  onClick={() => setShowAnswer((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 text-xs font-bold cursor-pointer"
                >
                  <Eye className="w-4 h-4" /> {showAnswer ? 'Ẩn đáp án' : 'Xem đáp án'}
                </button>
              </div>

              <textarea
                rows={3}
                value={drillInput}
                onChange={(e) => setDrillInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleCheckDrill();
                  } else if (e.key === 'Tab') {
                    e.preventDefault();
                    speakEnglish(activeMistake.text_en, { rate: 0.9, accent: activeMistake.accent });
                  }
                }}
                placeholder="Nghe lại và gõ chính xác câu tiếng Anh... (Tab nghe lại, Enter kiểm tra)"
                className="w-full p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-700 focus:border-indigo-500 focus:outline-none text-base"
              />

              <button
                type="button"
                onClick={handleCheckDrill}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-sm transition cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" /> Kiểm tra & Xóa khỏi danh sách sai
              </button>

              {drillResult && drillResult.accuracy < 92 && (
                <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 space-y-2">
                  <div className="text-xs font-bold text-rose-700 dark:text-rose-300">
                    Độ chính xác: {drillResult.accuracy}% (Cần đạt từ 92% trở lên để vượt qua)
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-sm">
                    {drillResult.tokens.map((tok, i) => (
                      <span
                        key={i}
                        className={
                          tok.type === 'correct'
                            ? 'px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 font-semibold'
                            : tok.type === 'missing'
                            ? 'px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-dashed border-amber-400 font-mono'
                            : tok.type === 'extra'
                            ? 'px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-rose-500 line-through'
                            : 'px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-semibold'
                        }
                      >
                        {tok.type === 'missing'
                          ? '___'
                          : tok.type === 'correct'
                          ? tok.expected
                          : tok.actual}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {showAnswer && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1">
                  <p className="font-bold text-slate-900 dark:text-white">{activeMistake.text_en}</p>
                  {activeMistake.text_vi && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {activeMistake.text_vi}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
