import React, { useEffect, useState } from 'react';
import {
  Volume2,
  Trash2,
  Plus,
  Layers,
  List,
  Search,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  Lock,
  Loader2,
  BookMarked,
} from 'lucide-react';
import { api } from '../utils/api';
import { speakEnglish } from '../utils/dictation';
import { useAuth } from '../context/AuthContext';
import type { VocabularyItem } from '../types';

export function VocabPage() {
  const { user, setAuthModalOpen } = useAuth();
  const [items, setItems] = useState<VocabularyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'flashcard'>('list');
  const [filter, setFilter] = useState<'all' | 'learning' | 'mastered'>('all');
  const [search, setSearch] = useState('');

  // Add new word form
  const [showAdd, setShowAdd] = useState(false);
  const [newWord, setNewWord] = useState('');
  const [newPhonetic, setNewPhonetic] = useState('');
  const [newMeaning, setNewMeaning] = useState('');
  const [newExample, setNewExample] = useState('');
  const [lookingUp, setLookingUp] = useState(false);

  // Flashcard state
  const [cardIdx, setCardIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const fetchVocab = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await api.getVocab({ filter, search });
      setItems(data.vocabulary);
      setCardIdx(0);
      setFlipped(false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(fetchVocab, 100);
    return () => clearTimeout(t);
  }, [user?.id, filter, search]);

  // Space to flip flashcard
  useEffect(() => {
    if (viewMode !== 'flashcard') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' && (e.target as HTMLElement)?.tagName !== 'INPUT') {
        e.preventDefault();
        setFlipped((f) => !f);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewMode]);

  if (!user) {
    return (
      <div className="max-w-xl mx-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-center shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center mx-auto mb-4 text-indigo-600 dark:text-indigo-400">
          <Lock className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          Sổ từ vựng & Ôn tập Flashcard
        </h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Đăng nhập để lưu lại các từ mới khi luyện nghe chép chính tả và ôn tập thông minh bằng thẻ Flashcard 3D.
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

  const handleAutoLookup = async () => {
    if (!newWord.trim()) return;
    setLookingUp(true);
    try {
      const res = await api.lookupWord(newWord.trim());
      if (res.phonetic) setNewPhonetic(res.phonetic);
      if (res.meaning_vi) setNewMeaning(res.meaning_vi);
    } finally {
      setLookingUp(false);
    }
  };

  const handleAddWord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWord.trim()) return;
    try {
      await api.saveVocab({
        word: newWord.trim(),
        phonetic: newPhonetic.trim(),
        meaning_vi: newMeaning.trim() || 'Chưa có nghĩa',
        example_en: newExample.trim(),
      });
      setNewWord('');
      setNewPhonetic('');
      setNewMeaning('');
      setNewExample('');
      setShowAdd(false);
      fetchVocab();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleToggleMastery = async (item: VocabularyItem, mastered: boolean) => {
    try {
      const res = await api.updateVocab(item.id, {
        mastery_level: mastered ? 1 : 0,
        increment_review: true,
      });
      setItems((prev) => prev.map((v) => (v.id === item.id ? res.item : v)));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.deleteVocab(id);
      setItems((prev) => prev.filter((v) => v.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const currentCard = items[cardIdx] || null;

  const handleFlashcardDecision = async (known: boolean) => {
    if (!currentCard) return;
    await handleToggleMastery(currentCard, known);
    setFlipped(false);
    setTimeout(() => {
      setCardIdx((prev) => (prev + 1 < items.length ? prev + 1 : 0));
    }, 180);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
            Sổ từ vựng & Flashcard
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Quản lý từ vựng bạn đã lưu trong quá trình luyện nghe và ôn tập bằng thẻ lật 3D.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl bg-slate-200/70 dark:bg-slate-800 p-1">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <List className="w-4 h-4" /> Danh sách ({items.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode('flashcard');
                setCardIdx(0);
                setFlipped(false);
              }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === 'flashcard'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <Layers className="w-4 h-4" /> Ôn Flashcard
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowAdd((v) => !v)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Thêm từ mới
          </button>
        </div>
      </div>

      {/* Add New Word Collapsible Form */}
      {showAdd && (
        <form
          onSubmit={handleAddWord}
          className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900 shadow-sm space-y-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={newWord}
                onChange={(e) => setNewWord(e.target.value)}
                placeholder="Từ tiếng Anh (VD: resilient)"
                className="flex-1 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
              />
              <button
                type="button"
                onClick={handleAutoLookup}
                disabled={lookingUp || !newWord.trim()}
                className="px-3 py-2 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-xs font-bold hover:bg-amber-200 cursor-pointer"
                title="Tra nhanh phiên âm & nghĩa"
              >
                {lookingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              </button>
            </div>
            <input
              type="text"
              value={newPhonetic}
              onChange={(e) => setNewPhonetic(e.target.value)}
              placeholder="Phiên âm IPA (VD: /rɪˈzɪl.jənt/)"
              className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-mono"
            />
            <input
              type="text"
              required
              value={newMeaning}
              onChange={(e) => setNewMeaning(e.target.value)}
              placeholder="Nghĩa tiếng Việt..."
              className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={newExample}
              onChange={(e) => setNewExample(e.target.value)}
              placeholder="Câu ví dụ tiếng Anh (tùy chọn)..."
              className="flex-1 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
            />
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold cursor-pointer"
            >
              Lưu vào sổ từ
            </button>
          </div>
        </form>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-1.5">
          {[
            { id: 'all' as const, label: 'Tất cả' },
            { id: 'learning' as const, label: 'Đang học' },
            { id: 'mastered' as const, label: 'Đã thuộc' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                filter === tab.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm từ vựng hoặc nghĩa..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-indigo-500" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 p-12 text-center bg-white dark:bg-slate-900">
          <BookMarked className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h3 className="font-bold text-slate-800 dark:text-slate-100">Chưa có từ vựng nào</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Khi luyện nghe, hãy nhấn vào bất kỳ từ nào trong câu đáp án để lưu ngay vào sổ từ vựng!
          </p>
        </div>
      ) : viewMode === 'flashcard' && currentCard ? (
        /* 3D Flashcard Mode */
        <div className="max-w-xl mx-auto space-y-5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>
              Thẻ {cardIdx + 1} / {items.length}
            </span>
            <span>Nhấn vào thẻ hoặc phím Space để lật</span>
          </div>

          <div
            onClick={() => setFlipped((f) => !f)}
            className="perspective-1000 h-72 sm:h-80 cursor-pointer select-none"
          >
            <div
              className={`relative w-full h-full transition-transform duration-500 transform-style-3d ${
                flipped ? 'rotate-y-180' : ''
              }`}
            >
              {/* Front */}
              <div className="absolute inset-0 backface-hidden rounded-[2rem] bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-8 text-white shadow-2xl shadow-indigo-500/30 border border-white/15 flex flex-col items-center justify-center text-center overflow-hidden">
                <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-white/15 blur-2xl pointer-events-none" />
                <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-cyan-300/20 blur-2xl pointer-events-none" />
                <span className="relative px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-[11px] uppercase tracking-widest text-indigo-100 font-bold mb-4">
                  {currentCard.part_of_speech || 'TỪ VỰNG'}
                </span>
                <div className="relative text-3xl sm:text-5xl font-display font-extrabold tracking-tight">
                  {currentCard.word}
                </div>
                {currentCard.phonetic && (
                  <div className="relative mt-2.5 font-mono text-indigo-100/90 text-sm">
                    {currentCard.phonetic}
                  </div>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    speakEnglish(currentCard.word, { rate: 0.9 });
                  }}
                  className="relative mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white/18 hover:bg-white/28 backdrop-blur-md text-white text-xs font-bold border border-white/20 transition cursor-pointer active:scale-95"
                >
                  <Volume2 className="w-4 h-4" /> Nghe phát âm
                </button>
              </div>

              {/* Back */}
              <div className="absolute inset-0 backface-hidden rotate-y-180 rounded-[2rem] glass-card border-2 border-indigo-400/70 dark:border-indigo-500/60 p-8 shadow-2xl shadow-indigo-500/15 flex flex-col items-center justify-center text-center">
                <span className="px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-[11px] uppercase tracking-widest text-indigo-600 dark:text-indigo-300 font-bold mb-3">
                  Nghĩa tiếng Việt
                </span>
                <div className="text-2xl sm:text-3xl font-display font-extrabold text-slate-900 dark:text-white">
                  {currentCard.meaning_vi}
                </div>
                {currentCard.example_en && (
                  <div className="mt-4 p-4 rounded-2xl bg-slate-100/80 dark:bg-white/[0.05] border border-slate-200/70 dark:border-white/10 text-sm text-slate-600 dark:text-slate-300 italic max-w-md">
                    “{currentCard.example_en}”
                  </div>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    speakEnglish(currentCard.example_en || currentCard.word, { rate: 0.95 });
                  }}
                  className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  <Volume2 className="w-4 h-4" /> Nghe câu ví dụ
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleFlashcardDecision(false)}
              className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-amber-100 dark:bg-amber-950/60 hover:bg-amber-200 text-amber-800 dark:text-amber-300 font-bold text-sm transition cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" /> Chưa nhớ (Ôn lại)
            </button>
            <button
              type="button"
              onClick={() => handleFlashcardDecision(true)}
              className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-sm transition cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" /> Đã thuộc từ này!
            </button>
          </div>
        </div>
      ) : (
        /* Vocabulary Grid List */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="p-5 rounded-3xl glass-card border border-slate-200/80 dark:border-white/10 flex flex-col justify-between gap-3 hover:border-indigo-400/70 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-500/10 transition-all"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-lg font-extrabold text-slate-900 dark:text-white">
                      {item.word}
                    </span>
                    {item.phonetic && (
                      <span className="text-xs font-mono text-slate-400">{item.phonetic}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => speakEnglish(item.word, { rate: 0.9 })}
                      className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 cursor-pointer"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                      item.mastery_level >= 1
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                        : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                    }`}
                  >
                    {item.mastery_level >= 1 ? 'Đã thuộc' : 'Đang học'}
                  </span>
                </div>

                <p className="mt-1.5 text-sm font-semibold text-indigo-700 dark:text-indigo-300">
                  {item.meaning_vi}
                </p>
                {item.example_en && (
                  <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 italic">
                    “{item.example_en}”
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 dark:border-slate-800 text-xs">
                <span className="text-slate-400">Đã ôn {item.review_count || 0} lần</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleMastery(item, item.mastery_level < 1)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-100 dark:hover:bg-emerald-950 text-slate-700 dark:text-slate-200 font-semibold transition cursor-pointer"
                  >
                    {item.mastery_level >= 1 ? 'Đánh dấu ôn lại' : 'Đánh dấu đã thuộc'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer"
                    title="Xóa từ"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
