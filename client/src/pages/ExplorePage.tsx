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
  Check,
  MessageSquareText,
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
    const totalSentences = lessons.reduce((acc, l) => acc + (l.sentence_count || 0), 0);
    return { total, ytCount, totalSentences };
  }, [lessons]);

  return (
    <div className="space-y-7">
      {/* Cinema Aurora Hero Banner */}
      <div className="relative overflow-hidden rounded-[2rem] bg-[#0f172a] p-6 sm:p-9 text-white shadow-2xl shadow-indigo-950/25 border border-white/10">
        {/* Multi-layer glowing aurora backdrop */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/90 via-violet-700/85 to-fuchsia-700/80" />
        <div className="absolute -right-24 -top-24 w-96 h-96 rounded-full bg-cyan-400/25 blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-24 w-80 h-80 rounded-full bg-pink-500/25 blur-3xl pointer-events-none" />
        <div
          className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/15 backdrop-blur-md text-xs font-bold border border-white/20 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Luyện Nghe Chép Chính Tả chuẩn phong cách Parroto</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-[1.15]">
              Bứt phá kỹ năng Nghe tiếng Anh qua{' '}
              <span className="bg-gradient-to-r from-amber-200 via-cyan-200 to-white bg-clip-text text-transparent">
                Video thực tế
              </span>
            </h1>

            <p className="text-indigo-100/90 text-sm sm:text-base leading-relaxed max-w-xl">
              Điền từng ô từ mượt mà, đồng bộ chuẩn từng giây từ đầu đến cuối video TED, IELTS, Giao tiếp & Công sở — kèm dịch nghĩa song ngữ và Flashcard thông minh.
            </p>

            <div className="pt-1 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => lessons[0] && onSelectLesson(lessons[0].id)}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white text-indigo-700 font-extrabold text-sm hover:bg-indigo-50 transition shadow-xl shadow-black/20 cursor-pointer active:scale-95"
              >
                <Play className="w-4 h-4 fill-indigo-700" />
                Luyện nghe ngay
              </button>
              <button
                type="button"
                onClick={onGoCreate}
                className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-white/15 hover:bg-white/25 backdrop-blur-md text-white font-bold text-sm border border-white/25 transition cursor-pointer active:scale-95"
              >
                <PlusCircle className="w-4 h-4" />
                Tự tạo bài học
              </button>
              {!user && (
                <button
                  type="button"
                  onClick={() => setAuthModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-400 hover:brightness-105 text-slate-950 font-extrabold text-sm shadow-lg shadow-amber-500/20 transition cursor-pointer active:scale-95"
                >
                  Dùng thử Demo
                </button>
              )}
            </div>
          </div>

          {/* Floating Interactive Dictation Preview + Stats */}
          <div className="lg:col-span-5 space-y-3.5">
            <div className="hidden sm:block rounded-2xl bg-slate-950/45 backdrop-blur-xl border border-white/15 p-4 shadow-2xl animate-float-slow">
              <div className="flex items-center justify-between text-[11px] text-indigo-200/90 mb-3">
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Chế độ điền từng ô từ
                </span>
                <span className="font-mono bg-white/10 px-2 py-0.5 rounded-md">00:23 – 00:27</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-sm">
                {['Try', 'something', 'new', 'for'].map((w) => (
                  <span
                    key={w}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/25 border border-emerald-400/40 text-emerald-200 font-bold"
                  >
                    {w} <Check className="w-3 h-3" />
                  </span>
                ))}
                <span className="px-3 py-1 rounded-xl bg-white/15 border-2 border-cyan-300 text-white font-bold shadow-sm">
                  30
                </span>
                <span className="px-3 py-1 rounded-xl bg-white/5 border border-dashed border-white/30 text-white/40 font-mono">
                  ••••
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div className="rounded-2xl bg-white/12 backdrop-blur-md p-3.5 text-center border border-white/15">
                <div className="text-xl sm:text-2xl font-extrabold">{stats.total}</div>
                <div className="text-[11px] text-indigo-100/85 mt-0.5">Bài học</div>
              </div>
              <div className="rounded-2xl bg-white/12 backdrop-blur-md p-3.5 text-center border border-white/15">
                <div className="text-xl sm:text-2xl font-extrabold">{stats.ytCount}</div>
                <div className="text-[11px] text-indigo-100/85 mt-0.5">Video YouTube</div>
              </div>
              <div className="rounded-2xl bg-white/12 backdrop-blur-md p-3.5 text-center border border-white/15">
                <div className="text-xl sm:text-2xl font-extrabold">
                  {stats.totalSentences.toLocaleString('vi-VN')}
                </div>
                <div className="text-[11px] text-indigo-100/85 mt-0.5">Câu song ngữ</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Topic Pills Rail */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
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
              className={`shrink-0 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer border ${
                active
                  ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white border-transparent shadow-md shadow-indigo-500/25'
                  : 'glass-card text-slate-700 dark:text-slate-200 border-slate-200/80 dark:border-white/10 hover:border-indigo-400/70'
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
            className={`shrink-0 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer border ${
              onlyMine
                ? 'bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white border-transparent shadow-md shadow-fuchsia-500/25'
                : 'glass-card text-violet-700 dark:text-violet-300 border-violet-200/80 dark:border-violet-800/60 hover:border-violet-400'
            }`}
          >
            Bài học của tôi
          </button>
        )}
      </div>

      {/* Frosted Glass Search & Filter Dock */}
      <div className="glass-card p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm bài học theo tên video, diễn giả, chủ đề..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-100/80 dark:bg-white/[0.05] border border-slate-200/70 dark:border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Level Pill Selector */}
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100/80 dark:bg-white/[0.05] border border-slate-200/70 dark:border-white/10 overflow-x-auto no-scrollbar">
            {LEVELS.map((lv) => (
              <button
                key={lv}
                type="button"
                onClick={() => setLevel(lv)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  level === lv
                    ? 'bg-white dark:bg-indigo-600 text-indigo-700 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                {lv === 'all' ? 'Mọi cấp' : lv}
              </button>
            ))}
          </div>

          <select
            value={mediaFilter}
            onChange={(e) => setMediaFilter(e.target.value)}
            className="px-3.5 py-2 rounded-xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200/70 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="all">Tất cả định dạng</option>
            <option value="youtube">Video YouTube</option>
            <option value="audio_tts">Giọng đọc AI Studio</option>
            <option value="upload_video">Video tải lên</option>
            <option value="upload_audio">Audio tải lên</option>
          </select>
        </div>
      </div>

      {/* Lessons Editorial Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <span className="text-sm font-medium">Đang tải kho bài học...</span>
        </div>
      ) : lessons.length === 0 ? (
        <div className="glass-card rounded-3xl border border-dashed border-slate-300 dark:border-white/15 p-12 text-center">
          <BookOpen className="w-11 h-11 text-slate-400 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
            Chưa tìm thấy bài học phù hợp
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Thử đổi bộ lọc hoặc tự tạo bài học luyện nghe mới từ YouTube / file của bạn.
          </p>
          <button
            type="button"
            onClick={onGoCreate}
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-bold shadow-md shadow-indigo-500/25 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" /> Tạo bài học ngay
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {lessons.map((lesson) => {
            const topicMeta = getTopicMeta(lesson.topic);
            const pct = lesson.progress?.percent || 0;
            const isCustom = !lesson.is_official;

            return (
              <div
                key={lesson.id}
                onClick={() => onSelectLesson(lesson.id)}
                className="group flex flex-col rounded-3xl overflow-hidden glass-card border border-slate-200/80 dark:border-white/10 hover:border-indigo-400/70 dark:hover:border-indigo-500/60 hover:-translate-y-1 hover:shadow-2xl hover:shadow-indigo-500/12 transition-all duration-300 cursor-pointer"
              >
                {/* Thumbnail with Hover Play Overlay */}
                <div className="relative aspect-video bg-slate-900 overflow-hidden">
                  {lesson.thumbnail_url ? (
                    <img
                      src={lesson.thumbnail_url}
                      alt={lesson.title}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-indigo-700 via-violet-800 to-slate-900 flex flex-col items-center justify-center gap-2 p-4 text-center">
                      {lesson.media_type === 'upload_video' ? (
                        <Film className="w-11 h-11 text-indigo-200/85" />
                      ) : (
                        <Headphones className="w-11 h-11 text-cyan-200/90" />
                      )}
                      <span className="text-[11px] font-bold uppercase tracking-widest text-indigo-100/80">
                        {lesson.speaker || 'AI Audio Studio'}
                      </span>
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-slate-950/10" />

                  {/* Hover Center Play Button */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="w-13 h-13 rounded-full bg-white/95 text-indigo-700 flex items-center justify-center shadow-2xl scale-90 group-hover:scale-100 transition-transform duration-300">
                      <Play className="w-6 h-6 fill-indigo-700 ml-0.5" />
                    </div>
                  </div>

                  {/* Top Left Media Badge */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5">
                    {lesson.media_type === 'youtube' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-600/90 backdrop-blur-md text-white text-[11px] font-bold shadow">
                        <Youtube className="w-3.5 h-3.5" /> YouTube
                      </span>
                    ) : lesson.media_type === 'upload_video' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-violet-600/90 backdrop-blur-md text-white text-[11px] font-bold shadow">
                        <Film className="w-3.5 h-3.5" /> Video
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-600/90 backdrop-blur-md text-white text-[11px] font-bold shadow">
                        <Headphones className="w-3.5 h-3.5" /> AI Audio
                      </span>
                    )}
                    {isCustom && (
                      <span className="px-2.5 py-1 rounded-full bg-amber-400/95 text-slate-950 text-[11px] font-extrabold shadow">
                        Của tôi
                      </span>
                    )}
                  </div>

                  {/* Top Right Level & Accent */}
                  <div className="absolute top-3 right-3 flex items-center gap-1.5">
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold shadow-xs ${getLevelColor(lesson.level)}`}>
                      {lesson.level}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-black/60 text-white backdrop-blur-md border border-white/15">
                      {lesson.accent}
                    </span>
                  </div>

                  {/* Bottom Overlays */}
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-white/95">
                    <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-black/55 backdrop-blur-md text-[11px] font-semibold border border-white/10">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3 text-indigo-300" />
                        {formatTime(lesson.duration_sec)}
                      </span>
                      <span className="opacity-40">•</span>
                      <span className="inline-flex items-center gap-1">
                        <MessageSquareText className="w-3 h-3 text-cyan-300" />
                        {lesson.sentence_count || 0} câu
                      </span>
                    </span>
                    {pct >= 100 && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500 text-white font-bold text-[11px] shadow">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Xong
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-5 flex flex-col flex-1">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${topicMeta.badge}`}>
                      {topicMeta.label}
                    </span>
                    {isCustom && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteCustom(e, lesson.id)}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer"
                        title="Xóa bài học này"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <h3 className="font-display font-bold text-base text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition line-clamp-2 leading-snug">
                    {lesson.title}
                  </h3>
                  <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed flex-1">
                    {lesson.description || `Bài luyện nghe chép chính tả chủ đề ${topicMeta.label}.`}
                  </p>

                  {/* Progress Footer */}
                  <div className="mt-4 pt-3.5 border-t border-slate-200/70 dark:border-white/10">
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="text-slate-500 dark:text-slate-400 font-medium truncate max-w-[58%]">
                        {lesson.speaker || 'DictaFlow'}
                      </span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">
                        {lesson.progress?.mastered_count || 0}/{lesson.sentence_count || 0} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-200/80 dark:bg-white/10 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          pct >= 100
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                            : 'bg-gradient-to-r from-indigo-600 to-violet-500'
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
