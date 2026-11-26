import React, { useState } from 'react';
import {
  Youtube,
  Upload,
  Headphones,
  FileText,
  Plus,
  Trash2,
  Sparkles,
  Loader2,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { api } from '../utils/api';
import { LEVELS, TOPICS } from '../utils/dictation';
import { useAuth } from '../context/AuthContext';

interface CreateLessonPageProps {
  onCreated: (lessonId: number) => void;
}

interface EditableSentence {
  start_time: number;
  end_time: number;
  text_en: string;
  text_vi: string;
}

const SAMPLE_SRT = `1
00:00:05,000 --> 00:00:10,000
Learning a new language opens doors to new cultures and friendships.

2
00:00:10,500 --> 00:00:16,000
Listening and writing down every word trains your ears to catch natural speed.

3
00:00:16,500 --> 00:00:22,000
Practice for fifteen minutes every day and you will notice steady progress.`;

function extractYtIdClient(url: string): string | null {
  const m = url
    .trim()
    .match(/(?:(?:www\.|m\.)?youtube\.com\/(?:watch\?.*?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (m) return m[1];
  const qm = url.trim().match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (qm) return qm[1];
  if (/^[a-zA-Z0-9_-]{11}$/.test(url.trim())) return url.trim();
  return null;
}

export function CreateLessonPage({ onCreated }: CreateLessonPageProps) {
  const { user, setAuthModalOpen } = useAuth();
  const [mediaType, setMediaType] = useState<'youtube' | 'upload_video' | 'audio_tts'>('youtube');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [topic, setTopic] = useState('daily');
  const [level, setLevel] = useState('B1');
  const [accent, setAccent] = useState('US');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);

  const [rawSubtitle, setRawSubtitle] = useState('');
  const [sentences, setSentences] = useState<EditableSentence[]>([]);
  const [parsing, setParsing] = useState(false);
  const [fetchingYt, setFetchingYt] = useState(false);
  const [ytFetchInfo, setYtFetchInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!user) {
    return (
      <div className="max-w-xl mx-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-center shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center mx-auto mb-4 text-indigo-600 dark:text-indigo-400">
          <Lock className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          Đăng nhập để tạo bài học của riêng bạn
        </h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Bạn có thể dán link YouTube, tải lên file Video/Audio và nhập phụ đề .srt/.vtt để xây dựng kho luyện nghe cá nhân.
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

  const ytPreviewId = mediaType === 'youtube' ? extractYtIdClient(youtubeUrl) : null;

  const handleFetchYouTube = async () => {
    if (!ytPreviewId) {
      setError('Vui lòng dán link YouTube hợp lệ trước khi lấy phụ đề tự động.');
      return;
    }
    setFetchingYt(true);
    setError('');
    setYtFetchInfo('');
    try {
      const res = await api.fetchYouTubeCaptions(youtubeUrl.trim());
      if (res.title && !title.trim()) {
        setTitle(res.title);
      }
      if (res.author && !description.trim()) {
        setDescription(`Bài luyện nghe từ kênh ${res.author} trên YouTube.`);
      }
      if (res.has_captions && res.sentences.length > 0) {
        setSentences(res.sentences);
        setYtFetchInfo(
          `Đã tự động lấy ${res.sentences.length} câu phụ đề (${
            res.is_auto_generated ? 'phụ đề tự động YouTube' : 'phụ đề chuẩn CC'
          }${res.has_vietnamese ? ' + kèm dịch tiếng Việt' : ''})! Bạn có thể kiểm tra, rút gọn hoặc lưu ngay.`
        );
      } else {
        setError(
          res.error ||
            'Không lấy được phụ đề tự động từ YouTube. Tiêu đề đã được điền sẵn — bạn hãy copy "Bản chép lời (Transcript)" từ YouTube dán vào ô phụ đề bên dưới nhé!'
        );
      }
    } catch (err: any) {
      setError(err.message || 'Không thể tự động lấy phụ đề từ video này.');
    } finally {
      setFetchingYt(false);
    }
  };

  const handleParseText = async (textOverride?: string) => {
    const content = textOverride !== undefined ? textOverride : rawSubtitle;
    if (!content.trim()) return;
    setParsing(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('subtitleText', content);
      const res = await api.parseSubtitles(fd);
      setSentences(res.sentences);
    } catch (err: any) {
      setError(err.message || 'Không thể tách phụ đề.');
    } finally {
      setParsing(false);
    }
  };

  const handleSubtitleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true);
    setError('');
    try {
      const text = await file.text();
      setRawSubtitle(text);
      const fd = new FormData();
      fd.append('subtitleFile', file);
      const res = await api.parseSubtitles(fd);
      setSentences(res.sentences);
    } catch (err: any) {
      setError(err.message || 'Không thể đọc file phụ đề.');
    } finally {
      setParsing(false);
    }
  };

  const addManualSentence = () => {
    const lastEnd = sentences.length > 0 ? sentences[sentences.length - 1].end_time : 0;
    setSentences((prev) => [
      ...prev,
      { start_time: lastEnd, end_time: lastEnd + 5, text_en: '', text_vi: '' },
    ]);
  };

  const updateSentence = (idx: number, field: keyof EditableSentence, value: string | number) => {
    setSentences((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s))
    );
  };

  const removeSentence = (idx: number) => {
    setSentences((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Vui lòng nhập tiêu đề bài học.');
      return;
    }
    if (mediaType === 'youtube' && !ytPreviewId) {
      setError('Vui lòng nhập link YouTube hợp lệ (VD: https://www.youtube.com/watch?v=...)');
      return;
    }
    if (mediaType === 'upload_video' && !mediaFile) {
      setError('Vui lòng chọn file Video hoặc Audio để tải lên.');
      return;
    }

    const validSentences = sentences.filter((s) => s.text_en.trim());
    if (validSentences.length === 0 && !rawSubtitle.trim()) {
      setError('Vui lòng nhập phụ đề (.srt/.vtt) hoặc thêm ít nhất 1 câu luyện nghe.');
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('title', title.trim());
      fd.append('description', description.trim());
      fd.append('topic', topic);
      fd.append('level', level);
      fd.append('accent', accent);
      fd.append('media_type', mediaType);
      if (mediaType === 'youtube') {
        fd.append('youtube_url', youtubeUrl.trim());
      } else if (mediaType === 'upload_video' && mediaFile) {
        fd.append('mediaFile', mediaFile);
      }

      if (validSentences.length > 0) {
        fd.append('sentencesJson', JSON.stringify(validSentences));
      } else {
        fd.append('subtitleText', rawSubtitle);
      }

      const res = await api.createLesson(fd);
      onCreated(res.lesson.id);
    } catch (err: any) {
      setError(err.message || 'Không thể tạo bài học.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
          Tạo bài học luyện nghe mới
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Dán link YouTube, tải lên file Video/Audio hoặc nhập đoạn văn bản tiếng Anh để tạo bài nghe chép chính tả tùy chỉnh.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm font-medium">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Media Source */}
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <h2 className="font-bold text-base text-slate-900 dark:text-white">
            1. Chọn nguồn Video / Audio
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                id: 'youtube' as const,
                icon: Youtube,
                title: 'Link Video YouTube',
                desc: 'Dán URL video bất kỳ từ YouTube',
              },
              {
                id: 'upload_video' as const,
                icon: Upload,
                title: 'Tải Video / Audio',
                desc: 'Hỗ trợ .mp4, .webm, .mp3, .wav',
              },
              {
                id: 'audio_tts' as const,
                icon: Headphones,
                title: 'Giọng đọc AI (TTS)',
                desc: 'Không cần file, chỉ cần nhập câu',
              },
            ].map((item) => {
              const Icon = item.icon;
              const active = mediaType === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setMediaType(item.id)}
                  className={`p-4 rounded-2xl border-2 text-left transition cursor-pointer ${
                    active
                      ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <Icon
                    className={`w-6 h-6 mb-2 ${
                      active ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'
                    }`}
                  />
                  <div className="font-bold text-sm text-slate-900 dark:text-white">{item.title}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{item.desc}</div>
                </button>
              );
            })}
          </div>

          {mediaType === 'youtube' && (
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                Đường dẫn Video YouTube
              </label>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  value={youtubeUrl}
                  onChange={(e) => {
                    setYoutubeUrl(e.target.value);
                    setYtFetchInfo('');
                  }}
                  placeholder="https://www.youtube.com/watch?v=UNP03fDSj1U"
                  className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleFetchYouTube}
                  disabled={fetchingYt || !ytPreviewId}
                  className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-sm font-bold shadow-sm transition cursor-pointer disabled:opacity-50"
                >
                  {fetchingYt ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {fetchingYt ? 'Đang lấy phụ đề...' : 'Tự động lấy phụ đề & tiêu đề'}
                </button>
              </div>
              {ytPreviewId && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                  <img
                    src={`https://i.ytimg.com/vi/${ytPreviewId}/hqdefault.jpg`}
                    alt="YouTube preview"
                    className="w-28 h-16 object-cover rounded-lg"
                  />
                  <div className="text-xs space-y-0.5">
                    <div className="font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Nhận diện video thành công!
                    </div>
                    <div className="text-slate-500 dark:text-slate-400 font-mono">
                      YouTube ID: {ytPreviewId}
                    </div>
                    {ytFetchInfo ? (
                      <div className="text-indigo-700 dark:text-indigo-300 font-semibold pt-0.5">
                        {ytFetchInfo}
                      </div>
                    ) : (
                      <div className="text-slate-500 dark:text-slate-400">
                        Nhấn nút <strong>“Tự động lấy phụ đề & tiêu đề”</strong> để kéo sẵn phụ đề từng câu từ YouTube.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {mediaType === 'upload_video' && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                Chọn file Video hoặc Audio từ máy tính (Tối đa 120MB)
              </label>
              <input
                type="file"
                accept="video/*,audio/*"
                onChange={(e) => setMediaFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-slate-600 dark:text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 dark:file:bg-indigo-950 dark:file:text-indigo-300 hover:file:bg-indigo-100 cursor-pointer"
              />
              {mediaFile && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1.5 font-medium">
                  Đã chọn: {mediaFile.name} ({(mediaFile.size / (1024 * 1024)).toFixed(2)} MB)
                </p>
              )}
            </div>
          )}

          {/* Lesson Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Tiêu đề bài học *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: TED Talk - Power of Consistency"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Mô tả ngắn (Tùy chọn)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ghi chú nội dung hoặc mục tiêu luyện nghe của bài học..."
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Chủ đề
              </label>
              <select
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
              >
                {TOPICS.filter((t) => t.id !== 'all').map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Trình độ
                </label>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                >
                  {LEVELS.filter((l) => l !== 'all').map((lv) => (
                    <option key={lv} value={lv}>
                      {lv}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Giọng đọc
                </label>
                <select
                  value={accent}
                  onChange={(e) => setAccent(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                >
                  <option value="US">Anh - Mỹ (US)</option>
                  <option value="UK">Anh - Anh (UK)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Step 2: Subtitles / Transcript */}
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-bold text-base text-slate-900 dark:text-white">
                2. Phụ đề & Danh sách câu luyện nghe
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tải file <code className="font-mono">.srt / .vtt</code>, dán thẳng <strong>Bản chép lời (Transcript)</strong> copy từ YouTube (<code className="font-mono">0:12</code> + lời thoại), hoặc nhập mỗi dòng một câu (<code className="font-mono">Tiếng Anh | Dịch Việt</code>).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold hover:bg-indigo-100 transition cursor-pointer">
                <FileText className="w-3.5 h-3.5" />
                Tải file .SRT / .VTT
                <input
                  type="file"
                  accept=".srt,.vtt,.txt"
                  onChange={handleSubtitleFile}
                  className="hidden"
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  setRawSubtitle(SAMPLE_SRT);
                  handleParseText(SAMPLE_SRT);
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Dữ liệu mẫu
              </button>
            </div>
          </div>

          <textarea
            rows={5}
            value={rawSubtitle}
            onChange={(e) => setRawSubtitle(e.target.value)}
            placeholder={`Dán nội dung .srt / .vtt hoặc mỗi dòng một câu, ví dụ:\n[00:05 - 00:10] Hello everyone, welcome back to our channel! | Xin chào mọi người!`}
            className="w-full p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 font-mono text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleParseText()}
              disabled={parsing || !rawSubtitle.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white text-xs font-semibold disabled:opacity-50 cursor-pointer"
            >
              {parsing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Phân tích & Tách thành từng câu
            </button>
            <button
              type="button"
              onClick={addManualSentence}
              className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold hover:bg-indigo-100 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Thêm câu thủ công
            </button>
          </div>

          {/* Interactive Sentence Editor */}
          {sentences.length > 0 && (
            <div className="space-y-2.5 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  Xem trước & Chỉnh sửa ({sentences.length} câu):
                </div>
                {sentences.length > 15 && (
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="text-slate-400">Rút gọn nhanh:</span>
                    <button
                      type="button"
                      onClick={() => setSentences((prev) => prev.slice(0, 10))}
                      className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-100 dark:hover:bg-indigo-950 font-semibold cursor-pointer"
                    >
                      Giữ 10 câu đầu
                    </button>
                    <button
                      type="button"
                      onClick={() => setSentences((prev) => prev.slice(0, 20))}
                      className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-100 dark:hover:bg-indigo-950 font-semibold cursor-pointer"
                    >
                      Giữ 20 câu đầu
                    </button>
                  </div>
                )}
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {sentences.map((s, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                        Câu #{idx + 1}
                      </span>
                      <div className="flex items-center gap-2 text-xs">
                        <label className="text-slate-400">Từ (giây):</label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={s.start_time}
                          onChange={(e) => updateSentence(idx, 'start_time', Number(e.target.value))}
                          className="w-16 px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono"
                        />
                        <label className="text-slate-400">Đến:</label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={s.end_time}
                          onChange={(e) => updateSentence(idx, 'end_time', Number(e.target.value))}
                          className="w-16 px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => removeSentence(idx)}
                          className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <input
                      type="text"
                      value={s.text_en}
                      onChange={(e) => updateSentence(idx, 'text_en', e.target.value)}
                      placeholder="Câu tiếng Anh..."
                      className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm"
                    />
                    <input
                      type="text"
                      value={s.text_vi}
                      onChange={(e) => updateSentence(idx, 'text_vi', e.target.value)}
                      placeholder="Dịch tiếng Việt (tùy chọn)..."
                      className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md transition cursor-pointer disabled:opacity-60"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Lưu bài học & Bắt đầu luyện ngay
          </button>
        </div>
      </form>
    </div>
  );
}
