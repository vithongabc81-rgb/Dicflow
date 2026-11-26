import React, { useEffect, useState } from 'react';
import {
  Flame,
  Target,
  CheckCircle2,
  BookMarked,
  Clock,
  TrendingUp,
  Play,
  Lock,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { api } from '../utils/api';
import { getLevelColor, getTopicMeta } from '../utils/dictation';
import { useAuth } from '../context/AuthContext';
import type { ProgressSummary } from '../types';

interface DashboardPageProps {
  onOpenLesson: (lessonId: number) => void;
  onOpenMistakes: () => void;
  onOpenVocab: () => void;
}

export function DashboardPage({ onOpenLesson, onOpenMistakes, onOpenVocab }: DashboardPageProps) {
  const { user, setAuthModalOpen, refreshUser } = useAuth();
  const [summary, setSummary] = useState<ProgressSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [goalInput, setGoalInput] = useState(15);
  const [savingGoal, setSavingGoal] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .getProgressSummary()
      .then((data) => {
        setSummary(data);
        setGoalInput(data.daily_goal || 15);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user?.id]);

  if (!user) {
    return (
      <div className="max-w-xl mx-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-center shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center mx-auto mb-4 text-indigo-600 dark:text-indigo-400">
          <Lock className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          Thống kê tiến độ & Chuỗi ngày học
        </h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Đăng nhập để xem biểu đồ 7 ngày luyện tập, điểm chính xác trung bình, chuỗi Streak và lịch sử bài học.
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

  if (loading || !summary) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  const maxDaySentences = Math.max(5, ...summary.last_7_days.map((d) => d.sentences));
  const dailyPercent = Math.min(100, Math.round((summary.today_sentences / Math.max(1, summary.daily_goal)) * 100));

  const handleSaveGoal = async () => {
    setSavingGoal(true);
    try {
      await api.updateProfile({ daily_goal: goalInput });
      await refreshUser();
      const fresh = await api.getProgressSummary();
      setSummary(fresh);
    } finally {
      setSavingGoal(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
            Bảng điều khiển học tập của {user.name}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Theo dõi chuỗi ngày học, độ chính xác và mục tiêu luyện nghe mỗi ngày.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-3.5 py-2 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
          <span className="font-semibold text-slate-500 dark:text-slate-400">Mục tiêu/ngày:</span>
          <input
            type="number"
            min={5}
            max={100}
            value={goalInput}
            onChange={(e) => setGoalInput(Number(e.target.value))}
            className="w-14 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-bold text-center"
          />
          <span className="text-slate-400">câu</span>
          <button
            type="button"
            onClick={handleSaveGoal}
            disabled={savingGoal}
            className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer"
          >
            Lưu
          </button>
        </div>
      </div>

      {/* Top KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-orange-100">Chuỗi ngày học (Streak)</span>
            <Flame className="w-5 h-5 text-amber-200" />
          </div>
          <div className="mt-2 text-3xl font-extrabold">{summary.streak_count} ngày</div>
          <div className="mt-1 text-xs text-orange-100">
            Hôm nay: {summary.today_sentences}/{summary.daily_goal} câu ({dailyPercent}%)
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Độ chính xác TB
            </span>
            <Target className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="mt-2 text-3xl font-extrabold text-slate-900 dark:text-white">
            {summary.avg_accuracy}%
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Trên {summary.total_attempted} câu đã luyện
          </div>
        </div>

        <div
          onClick={onOpenVocab}
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-400 transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Từ vựng Flashcard
            </span>
            <BookMarked className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="mt-2 text-3xl font-extrabold text-slate-900 dark:text-white">
            {summary.vocab_total} từ
          </div>
          <div className="mt-1 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
            Đã thuộc: {summary.vocab_mastered} từ
          </div>
        </div>

        <div
          onClick={onOpenMistakes}
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-rose-400 transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Câu cần ôn lại
            </span>
            <AlertCircle className="w-5 h-5 text-rose-500" />
          </div>
          <div className="mt-2 text-3xl font-extrabold text-slate-900 dark:text-white">
            {summary.mistakes_count}
          </div>
          <div className="mt-1 text-xs text-rose-600 dark:text-rose-400 font-semibold">
            Nhấn để vào ôn tập ngay →
          </div>
        </div>
      </div>

      {/* 7-Day Activity Chart + Daily Goal Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-500" />
                Hoạt động luyện nghe 7 ngày qua
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Số câu nghe chép chính tả mỗi ngày & điểm chính xác trung bình
              </p>
            </div>
            <div className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              <Clock className="w-3.5 h-3.5" /> Tổng ~{Math.max(1, summary.total_minutes)} phút
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2.5 items-end h-44 pt-4">
            {summary.last_7_days.map((day) => {
              const heightPct = day.sentences > 0 ? Math.max(14, Math.round((day.sentences / maxDaySentences) * 100)) : 6;
              return (
                <div key={day.date} className="flex flex-col items-center gap-2 h-full justify-end">
                  <div className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                    {day.sentences > 0 ? day.sentences : ''}
                  </div>
                  <div className="w-full flex-1 flex items-end">
                    <div
                      className={`w-full rounded-t-xl transition-all duration-500 ${
                        day.sentences > 0
                          ? 'bg-gradient-to-t from-indigo-600 to-violet-500'
                          : 'bg-slate-100 dark:bg-slate-800'
                      }`}
                      style={{ height: `${heightPct}%` }}
                      title={`${day.date}: ${day.sentences} câu (TB ${day.avg_accuracy}%)`}
                    />
                  </div>
                  <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    {day.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Topic Breakdown */}
        <div className="lg:col-span-5 p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <h2 className="font-bold text-base text-slate-900 dark:text-white">
            Tiến độ theo chủ đề
          </h2>

          {summary.topic_stats.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 py-8 text-center">
              Hãy luyện bài học đầu tiên để xem phân tích theo chủ đề!
            </p>
          ) : (
            <div className="space-y-3.5">
              {summary.topic_stats.map((ts) => {
                const meta = getTopicMeta(ts.topic);
                const ratio = ts.sentences_practiced
                  ? Math.round((Number(ts.mastered) / Number(ts.sentences_practiced)) * 100)
                  : 0;
                return (
                  <div key={ts.topic} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        {meta.label}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">
                        {ts.mastered}/{ts.sentences_practiced} câu đạt • TB {ts.avg_accuracy}%
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-indigo-600"
                        style={{ width: `${ratio}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent Lessons */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-base text-slate-900 dark:text-white">
            Bài học luyện gần đây
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400 inline-flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            Đã hoàn thành {summary.completed_lessons} bài
          </span>
        </div>

        {summary.recent_lessons.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 py-6 text-center">
            Chưa có lịch sử luyện nghe nào.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {summary.recent_lessons.map((lp) => {
              const pct = lp.total_s > 0 ? Math.round((Number(lp.mastered_s) / Number(lp.total_s)) * 100) : 0;
              return (
                <div
                  key={lp.id}
                  onClick={() => onOpenLesson(lp.id)}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 hover:border-indigo-400 flex items-center justify-between gap-3 transition cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${getLevelColor(lp.level)}`}>
                        {lp.level}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {getTopicMeta(lp.topic).label}
                      </span>
                    </div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                      {lp.title}
                    </h3>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {lp.mastered_s}/{lp.total_s} câu ({pct}%) • TB {lp.avg_acc}%
                    </div>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                    <Play className="w-4 h-4 fill-white" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
