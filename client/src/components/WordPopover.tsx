import React, { useEffect, useState } from 'react';
import { Volume2, BookmarkPlus, Check, X, Loader2 } from 'lucide-react';
import { api } from '../utils/api';
import { speakEnglish } from '../utils/dictation';
import { useAuth } from '../context/AuthContext';
import type { WordLookupResult } from '../types';

interface WordPopoverProps {
  word: string | null;
  exampleSentence?: string;
  lessonId?: number;
  accent?: string;
  onClose: () => void;
}

export function WordPopover({
  word,
  exampleSentence = '',
  lessonId,
  accent = 'US',
  onClose,
}: WordPopoverProps) {
  const { user, setAuthModalOpen } = useAuth();
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<WordLookupResult | null>(null);
  const [meaningInput, setMeaningInput] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!word) return;
    let active = true;
    setLoading(true);
    setSaved(false);
    setInfo(null);

    api
      .lookupWord(word)
      .then((res) => {
        if (!active) return;
        setInfo(res);
        setMeaningInput(res.meaning_vi || res.definition_en || '');
      })
      .catch(() => {
        if (!active) return;
        setInfo({
          word,
          phonetic: '',
          part_of_speech: '',
          meaning_vi: '',
          definition_en: '',
        });
        setMeaningInput('');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [word]);

  if (!word) return null;

  const handleSave = async () => {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    setSaving(true);
    try {
      await api.saveVocab({
        word: info?.word || word,
        phonetic: info?.phonetic || '',
        part_of_speech: info?.part_of_speech || '',
        meaning_vi: meaningInput.trim() || info?.meaning_vi || 'Từ vựng đã lưu',
        example_en: exampleSentence,
        lesson_id: lessonId || null,
      });
      setSaved(true);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 p-4 rounded-2xl bg-indigo-50/90 dark:bg-slate-800/95 border border-indigo-200 dark:border-indigo-900 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-lg font-bold text-indigo-700 dark:text-indigo-300">
            {info?.word || word}
          </span>
          {info?.phonetic && (
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
              {info.phonetic}
            </span>
          )}
          {info?.part_of_speech && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-medium">
              {info.part_of_speech}
            </span>
          )}
          <button
            type="button"
            onClick={() => speakEnglish(info?.word || word, { rate: 0.9, accent })}
            className="p-1.5 rounded-lg bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-slate-600 transition cursor-pointer"
            title="Nghe phát âm"
          >
            <Volume2 className="w-4 h-4" />
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-slate-500 mt-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang tra từ điển...
        </div>
      ) : (
        <div className="mt-3 space-y-2.5">
          {info?.definition_en && info.definition_en !== meaningInput && (
            <p className="text-xs text-slate-600 dark:text-slate-300 italic">
              EN: {info.definition_en}
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={meaningInput}
              onChange={(e) => setMeaningInput(e.target.value)}
              placeholder="Nhập nghĩa tiếng Việt / ghi chú..."
              className="flex-1 px-3 py-1.5 rounded-xl text-sm bg-white dark:bg-slate-900 border border-indigo-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || saved}
              className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl text-sm font-semibold transition cursor-pointer ${
                saved
                  ? 'bg-emerald-600 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : saved ? (
                <Check className="w-4 h-4" />
              ) : (
                <BookmarkPlus className="w-4 h-4" />
              )}
              {saved ? 'Đã lưu Flashcard' : 'Lưu sổ từ'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
