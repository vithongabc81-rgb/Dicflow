import React, { useEffect, useState, useMemo } from 'react';
import {
  Search,
  Play,
  Youtube,
  Headphones,
  Clock,
  CheckCircle2,
  PlusCircle,
  Trash2,
  Sparkles,
  BookOpen,
  Film,
  Loader2,
} from 'lucide-react';
import { api } from '../utils/api';
import { formatTime, getLevelColor, getTopicMeta, LEVELS, TOPICS } from '../utils/dictation';
import { useAuth } from '../context/AuthContext';
import type { Lesson } from '../types';

interface ExplorePageProps {
  onSelectLesson: (lessonId: number) => void;
  onGoCreate: () => void;
}

export function ExplorePage({ onSelectLesson, onGoCreate }: ExplorePageProps) {
  const { user, setAuthModalOpen } = useAuth();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [topic, setTopic] = useState('all');
  const [level, setLevel] = useState('all');
  const [mediaFilter, setMediaFilter] = useState('all');
  const [onlyMine, setOnlyMine] = useState(false);
  const [search, setSearch] = useState('');

  const fetchLessons = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (topic !== 'all') params.topic = topic;
      if (level !== 'all') params.level = level;
      if (mediaFilter !== 'all') params.media_type = mediaFilter;
      if (onlyMine && user) params.mine = '1';
      if (search.trim()) params.search = search.trim();
      const data = await api.getLessons(params);
      setLessons(data.lessons);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(fetchLessons, 120);
    return () => clearTimeout(t);
  }, [topic, level, mediaFilter, onlyMine, search, user?.id]);

  const handleDeleteCustom = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!window.confirm('Bạn có chắc muốn xóa bài học tự tạo này không?')) return;
    try {
      await api.deleteLesson(id);
      setLessons((prev) => prev.filter((l) => l.id !== id));
    } catch (err: any) {
      alert(err.message || 'Không thể xóa bài học.');
    }
  };

  const stats = useMemo(() => {
    const total = lessons.length;
    const ytCount = lessons.filter((l) => l.media_type === 'youtube').length;
    const completed = lessons.filter((l) => (l.progress?.percent || 0) >= 100).length;
    return { total, ytCount, completed };
  }, [lessons]);

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-6 sm:p-8 text-white shadow-xl">
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-10 -bottom-20 w-56 h-56 rounded-full bg-cyan-400/20 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              Phương pháp Nghe Chép Chính Tả (Dictation) chuẩn quốc tế
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight">
              Luyện nghe Tiếng Anh sâu qua Video & Phụ đề từng câu
            </h1>
            <p className="mt-2.5 text-indigo-100 text-sm sm:text-base leading-relaxed">
              Chọn chủ đề yêu thích từ TED Talks, IELTS, Giao tiếp hằng ngày đến Công sở — hoặc tự tải lên video/link YouTube của riêng bạn. Chấm điểm chính xác từng từ, lưu Flashcard và theo dõi chuỗi ngày học!
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => lessons[0] && onSelectLesson(lessons[0].id)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-indigo-700 font-bold text-sm hover:bg-indigo-50 transition shadow-md cursor-pointer"
              >
                <Play className="w-4 h-4 fill-indigo-700" />
                Bắt đầu luyện ngay
              </button>
              <button
                type="button"
                onClick={onGoCreate}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur text-white font-semibold text-sm border border-white/25 transition cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                Tạo bài học từ YouTube / Video
              </button>
              {!user && (
                <button
                  type="button"
                  onClick={() => setAuthModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold text-sm transition cursor-pointer"
                >
                  Đăng nhập / Dùng thử Demo
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 shrink-0">
            <div className="rounded-2xl bg-white/15 backdrop-blur-sm p-3.5 text-center border border-white/15">
              <div className="text-2xl font-extrabold">{stats.total}</div>
              <div className="text-[11px] text-indigo-100 mt-0.5">Bài học</div>
            </div>
            <div className="rounded-2xl bg-white/15 backdrop-blur-sm p-3.5 text-center border border-white/15">
              <div className="text-2xl font-extrabold">{stats.ytCount}</div>
              <div className="text-[11px] text-indigo-100 mt-0.5">Video YouTube</div>
            </div>
            <div className="rounded-2xl bg-white/15 backdrop-blur-sm p-3.5 text-center border border-white/15">
              <div className="text-2xl font-extrabold">{stats.completed}</div>
              <div className="text-[11px] text-indigo-100 mt-0.5">Đã hoàn thành</div>
            </div>
          </div>
        </div>
      </div>

      {/* Topic Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {TOPICS.map((t) => {
          const active = !onlyMine && topic === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setOnlyMine(false);
                setTopic(t.id);
              }}
              className={`shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition cursor-pointer border ${
                active
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-indigo-400'
              }`}
            >
              {t.label}
            </button>
          );
        })}
        {user && (
          <button
            type="button"
            onClick={() => {
              setOnlyMine(true);
              setTopic('all');
            }}
            className={`shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition cursor-pointer border ${
              onlyMine
                ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                : 'bg-white dark:bg-slate-900 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-900 hover:border-violet-400'
            }`}
          >
            Bài học của tôi
          </button>
        )}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm bài học theo tiêu đề, diễn giả, chủ đề..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {LEVELS.map((lv) => (
              <option key={lv} value={lv}>
                {lv === 'all' ? 'Mọi trình độ' : `Trình độ ${lv}`}
              </option>
            ))}
          </select>

          <select
            value={mediaFilter}
            onChange={(e) => setMediaFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Tất cả định dạng</option>
            <option value="youtube">Video YouTube</option>
            <option value="audio_tts">Giọng đọc AI Studio</option>
            <option value="upload_video">Video tải lên</option>
            <option value="upload_audio">Audio tải lên</option>
          </select>
        </div>
      </div>

      {/* Lessons Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <span className="text-sm">Đang tải kho bài học...</span>
        </div>
      ) : lessons.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 p-12 text-center bg-white dark:bg-slate-900">
          <BookOpen className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
            Chưa tìm thấy bài học phù hợp
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Thử đổi bộ lọc hoặc tự tạo bài học luyện nghe mới từ YouTube / file của bạn.
          </p>
          <button
            type="button"
            onClick={onGoCreate}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" /> Tạo bài học ngay
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {lessons.map((lesson) => {
            const topicMeta = getTopicMeta(lesson.topic);
            const pct = lesson.progress?.percent || 0;
            const isCustom = !lesson.is_official;

            return (
              <div
                key={lesson.id}
                onClick={() => onSelectLesson(lesson.id)}
                className="group flex flex-col rounded-2xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600 hover:shadow-lg transition-all cursor-pointer"
              >
                {/* Thumbnail */}
                <div className="relative aspect-video bg-slate-800 overflow-hidden">
                  {lesson.thumbnail_url ? (
                    <img
                      src={lesson.thumbnail_url}
                      alt={lesson.title}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-indigo-800 via-violet-900 to-slate-900 flex flex-col items-center justify-center gap-2 p-4 text-center">
                      {lesson.media_type === 'upload_video' ? (
                        <Film className="w-11 h-11 text-indigo-300/80" />
                      ) : (
                        <Headphones className="w-11 h-11 text-cyan-300/85" />
                      )}
                      <span className="text-[11px] font-semibold uppercase tracking-widest text-indigo-200/80">
                        {lesson.speaker || 'AI Audio Studio'}
                      </span>
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />

                  {/* Media badge */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5">
                    {lesson.media_type === 'youtube' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600/90 text-white text-[11px] font-bold shadow">
                        <Youtube className="w-3.5 h-3.5" /> Video YouTube
                      </span>
                    ) : lesson.media_type === 'upload_video' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-600/90 text-white text-[11px] font-bold shadow">
                        <Film className="w-3.5 h-3.5" /> Video tải lên
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600/90 text-white text-[11px] font-bold shadow">
                        <Headphones className="w-3.5 h-3.5" /> Audio Studio
                      </span>
                    )}
                    {isCustom && (
                      <span className="px-2 py-1 rounded-lg bg-amber-500/90 text-slate-950 text-[11px] font-bold">
                        Của tôi
                      </span>
                    )}
                  </div>

                  {/* Level & Accent */}
                  <div className="absolute top-3 right-3 flex items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${getLevelColor(lesson.level)}`}>
                      {lesson.level}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-black/60 text-white backdrop-blur-sm">
                      {lesson.accent}
                    </span>
                  </div>

                  {/* Bottom Info over Thumbnail */}
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-white/90">
                    <span className="inline-flex items-center gap-1 font-medium">
                      <Clock className="w-3.5 h-3.5" />
                      {formatTime(lesson.duration_sec)} • {lesson.sentence_count || 0} câu
                    </span>
                    {pct >= 100 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500 text-white font-bold text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Hoàn thành
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 flex flex-col flex-1">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${topicMeta.badge}`}>
                      {topicMeta.label}
                    </span>
                    {isCustom && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteCustom(e, lesson.id)}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer"
                        title="Xóa bài học này"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <h3 className="font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition line-clamp-2">
                    {lesson.title}
                  </h3>
                  <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-2 flex-1">
                    {lesson.description || `Bài luyện nghe chép chính tả chủ đề ${topicMeta.label}.`}
                  </p>

                  {/* Progress Footer */}
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-slate-500 dark:text-slate-400 truncate max-w-[60%]">
                        {lesson.speaker || 'DictaFlow'}
                      </span>
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                        {lesson.progress?.mastered_count || 0}/{lesson.sentence_count || 0} câu ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          pct >= 100 ? 'bg-emerald-500' : 'bg-indigo-600'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
