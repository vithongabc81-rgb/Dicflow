import React, { useLayoutEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { Check } from 'lucide-react';

export type DictationMode = 'parroto_full' | 'parroto_blanks' | 'free';

export interface ParrotoInputHandle {
  checkAll: () => {
    accuracy: number;
    correctCount: number;
    totalBlanks: number;
    isPerfect: boolean;
    reconstructedInput: string;
  };
  hintActiveWord: () => string | null;
  focusActive: () => void;
  reset: () => void;
}

interface ParsedWord {
  index: number;
  leading: string;
  core: string;
  trailing: string;
  norm: string;
  isBlank: boolean;
}

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'to', 'of', 'in', 'on', 'at', 'is', 'am', 'are', 'was', 'were',
  'be', 'been', 'and', 'or', 'but', 'so', 'for', 'it', 'its', 'i', 'you', 'he', 'she',
  'we', 'they', 'my', 'your', 'our', 'his', 'her', 'that', 'this', 'with', 'as', 'by',
]);

function normalizeCore(word: string): string {
  return word
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^a-z0-9]/g, '');
}

function parseSentenceToWords(text: string, sentenceId: number, mode: DictationMode): ParsedWord[] {
  const rawTokens = text
    .replace(/\s*--\s*/g, ' — ')
    .replace(/[—–]/g, ' — ')
    .split(/\s+/)
    .filter(Boolean);

  const parsed: ParsedWord[] = rawTokens.map((raw, index) => {
    // Handles contractions (don't), hyphenated words (30-day), abbreviations (a.m., L.A.), and decimals cleanly
    const match = raw.match(/^([^a-zA-Z0-9]*)([a-zA-Z0-9](?:[a-zA-Z0-9'’.-]*[a-zA-Z0-9])?)([^a-zA-Z0-9]*)$/);
    if (!match) {
      return { index, leading: raw, core: '', trailing: '', norm: '', isBlank: false };
    }
    const core = match[2];
    const norm = normalizeCore(core);
    return {
      index,
      leading: match[1],
      core,
      trailing: match[3],
      norm,
      isBlank: norm.length > 0,
    };
  });

  if (mode === 'parroto_blanks') {
    const wordIndices = parsed.filter((w) => w.isBlank).map((w) => w.index);
    const targetBlankCount = Math.min(
      wordIndices.length,
      Math.max(1, Math.round(wordIndices.length * 0.45))
    );

    // Score words: prefer longer, meaningful content words, deterministic per sentence
    const scored = wordIndices.map((idx) => {
      const w = parsed[idx];
      const lower = w.core.toLowerCase();
      const isStop = STOP_WORDS.has(lower);
      const hash = ((sentenceId * 31 + idx * 17) % 100) / 100;
      const priority = (isStop ? 0 : 2) + Math.min(2, w.core.length / 4) + hash;
      return { idx, priority };
    });

    scored.sort((a, b) => b.priority - a.priority);
    const chosen = new Set(scored.slice(0, targetBlankCount).map((s) => s.idx));
    for (const w of parsed) {
      if (w.isBlank) {
        w.isBlank = chosen.has(w.index);
      }
    }
  }

  return parsed;
}

interface ParrotoDictationInputProps {
  sentenceId: number;
  textEn: string;
  mode: 'parroto_full' | 'parroto_blanks';
  onReplay: () => void;
  onSelectWord: (word: string) => void;
  onAllSolved: (reconstructedInput: string) => void;
  onRequestNextSentence?: () => void;
  onRequestHint?: () => void;
  onToggleShowAnswer?: () => void;
}

export const ParrotoDictationInput = forwardRef<ParrotoInputHandle, ParrotoDictationInputProps>(
  function ParrotoDictationInput(
    {
      sentenceId,
      textEn,
      mode,
      onReplay,
      onSelectWord,
      onAllSolved,
      onRequestNextSentence,
      onRequestHint,
      onToggleShowAnswer,
    },
    ref
  ) {
    const words = useMemo(
      () => parseSentenceToWords(textEn, sentenceId, mode),
      [textEn, sentenceId, mode]
    );
    const blankIndices = useMemo(
      () => words.filter((w) => w.isBlank).map((w) => w.index),
      [words]
    );

    const [values, setValues] = useState<Record<number, string>>({});
    const [status, setStatus] = useState<Record<number, 'idle' | 'correct' | 'wrong'>>({});
    const [activeIdx, setActiveIdx] = useState<number>(blankIndices[0] ?? -1);
    const inputRefs = useRef<Record<number, HTMLInputElement | null>>({});
    const keeperRef = useRef<HTMLInputElement | null>(null);
    const solvedTriggeredRef = useRef(false);

    // Reset & immediately focus first blank synchronously in layout effect so mobile keyboard stays open!
    useLayoutEffect(() => {
      setValues({});
      setStatus({});
      solvedTriggeredRef.current = false;
      const first = blankIndices[0] ?? -1;
      setActiveIdx(first);
      if (first >= 0) {
        const el = inputRefs.current[first];
        if (el) {
          el.focus({ preventScroll: true });
        } else {
          requestAnimationFrame(() => {
            inputRefs.current[first]?.focus({ preventScroll: true });
          });
        }
      }
    }, [sentenceId, mode, blankIndices]);

    const buildReconstructed = (vals: Record<number, string>) => {
      return words
        .map((w) => {
          if (!w.core) return w.leading;
          const val = w.isBlank ? (vals[w.index] || '').trim() : w.core;
          return `${w.leading}${val}${w.trailing}`;
        })
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    };

    const focusBlank = (wordIdx: number) => {
      setActiveIdx(wordIdx);
      const el = inputRefs.current[wordIdx];
      if (el) {
        // Synchronous focus inside user input event keeps iOS/Android virtual keyboard open!
        el.focus({ preventScroll: true });
        try {
          el.setSelectionRange(el.value.length, el.value.length);
        } catch {
          // ignore
        }
      } else {
        requestAnimationFrame(() => {
          const delayed = inputRefs.current[wordIdx];
          if (delayed) {
            delayed.focus({ preventScroll: true });
          }
        });
      }
    };

    const findNextUnsolvedBlank = (fromWordIdx: number, nextStatus: Record<number, 'idle' | 'correct' | 'wrong'>) => {
      const pos = blankIndices.indexOf(fromWordIdx);
      for (let i = pos + 1; i < blankIndices.length; i++) {
        if (nextStatus[blankIndices[i]] !== 'correct') return blankIndices[i];
      }
      for (let i = 0; i < pos; i++) {
        if (nextStatus[blankIndices[i]] !== 'correct') return blankIndices[i];
      }
      return -1;
    };

    const checkSolvedComplete = (
      nextVals: Record<number, string>,
      nextStatus: Record<number, 'idle' | 'correct' | 'wrong'>
    ) => {
      if (solvedTriggeredRef.current || blankIndices.length === 0) return;
      const allCorrect = blankIndices.every((idx) => nextStatus[idx] === 'correct');
      if (allCorrect) {
        solvedTriggeredRef.current = true;
        // Transfer focus synchronously to hidden focus-keeper input so mobile virtual keyboard does NOT dismiss!
        keeperRef.current?.focus({ preventScroll: true });
        onAllSolved(buildReconstructed(nextVals));
      }
    };

    const submitWordAt = (wordIdx: number, rawVal?: string) => {
      const word = words[wordIdx];
      if (!word || !word.isBlank) return;
      const currentVal = (rawVal !== undefined ? rawVal : values[wordIdx] || '').trim();
      if (!currentVal) {
        setStatus((prev) => ({ ...prev, [wordIdx]: 'wrong' }));
        return;
      }

      const isMatch = normalizeCore(currentVal) === word.norm;
      if (isMatch) {
        const nextVals = { ...values, [wordIdx]: word.core };
        const nextStatus: Record<number, 'idle' | 'correct' | 'wrong'> = {
          ...status,
          [wordIdx]: 'correct',
        };
        setValues(nextVals);
        setStatus(nextStatus);

        const nextTarget = findNextUnsolvedBlank(wordIdx, nextStatus);
        if (nextTarget >= 0) {
          focusBlank(nextTarget);
        }
        checkSolvedComplete(nextVals, nextStatus);
      } else {
        setStatus((prev) => ({ ...prev, [wordIdx]: 'wrong' }));
      }
    };

    const handleChange = (wordIdx: number, incoming: string) => {
      const word = words[wordIdx];
      if (!word || status[wordIdx] === 'correct') return;

      // Mobile & desktop: pressing Space submits the current word cleanly!
      if (incoming.endsWith(' ')) {
        const trimmed = incoming.trim();
        setValues((prev) => ({ ...prev, [wordIdx]: trimmed }));
        if (trimmed.length > 0) {
          submitWordAt(wordIdx, trimmed);
        }
        return;
      }

      const nextVals = { ...values, [wordIdx]: incoming };
      setValues(nextVals);
      if (status[wordIdx] === 'wrong') {
        setStatus((prev) => ({ ...prev, [wordIdx]: 'idle' }));
      }

      // Auto-complete & jump immediately when normalized spelling matches (works smoothly for contractions like "dont" -> "don't"!)
      if (word.norm.length > 0 && normalizeCore(incoming) === word.norm) {
        const solvedVals = { ...nextVals, [wordIdx]: word.core };
        const nextStatus: Record<number, 'idle' | 'correct' | 'wrong'> = {
          ...status,
          [wordIdx]: 'correct',
        };
        setValues(solvedVals);
        setStatus(nextStatus);

        const nextTarget = findNextUnsolvedBlank(wordIdx, nextStatus);
        if (nextTarget >= 0) {
          focusBlank(nextTarget);
        }
        checkSolvedComplete(solvedVals, nextStatus);
      }
    };

    const handleKeyDown = (wordIdx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        onReplay();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        onRequestHint?.();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        onToggleShowAnswer?.();
        return;
      }
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        submitWordAt(wordIdx);
        return;
      }
      if (e.key === 'Backspace' && !(values[wordIdx] || '')) {
        const pos = blankIndices.indexOf(wordIdx);
        for (let i = pos - 1; i >= 0; i--) {
          if (status[blankIndices[i]] !== 'correct') {
            e.preventDefault();
            focusBlank(blankIndices[i]);
            return;
          }
        }
      }
      if (e.key === 'ArrowRight') {
        const input = e.currentTarget;
        if (input.selectionStart === input.value.length) {
          const next = findNextUnsolvedBlank(wordIdx, status);
          if (next >= 0) {
            e.preventDefault();
            focusBlank(next);
          }
        }
      }
      if (e.key === 'ArrowLeft') {
        const input = e.currentTarget;
        if (input.selectionStart === 0) {
          const pos = blankIndices.indexOf(wordIdx);
          for (let i = pos - 1; i >= 0; i--) {
            if (status[blankIndices[i]] !== 'correct') {
              e.preventDefault();
              focusBlank(blankIndices[i]);
              return;
            }
          }
        }
      }
    };

    useImperativeHandle(ref, () => ({
      checkAll: () => {
        const nextVals = { ...values };
        const nextStatus: Record<number, 'idle' | 'correct' | 'wrong'> = { ...status };
        let correctCount = 0;

        for (const idx of blankIndices) {
          const w = words[idx];
          const val = (nextVals[idx] || '').trim();
          if (normalizeCore(val) === w.norm) {
            nextVals[idx] = w.core;
            nextStatus[idx] = 'correct';
            correctCount++;
          } else {
            nextStatus[idx] = 'wrong';
          }
        }

        setValues(nextVals);
        setStatus(nextStatus);

        const totalBlanks = blankIndices.length;
        const accuracy = totalBlanks > 0 ? Math.round((correctCount / totalBlanks) * 100) : 100;
        const isPerfect = correctCount === totalBlanks;

        // Focus first wrong blank so learner can immediately fix it
        const firstWrong = blankIndices.find((idx) => nextStatus[idx] !== 'correct');
        if (firstWrong !== undefined) {
          focusBlank(firstWrong);
        }

        return {
          accuracy,
          correctCount,
          totalBlanks,
          isPerfect,
          reconstructedInput: buildReconstructed(nextVals),
        };
      },

      hintActiveWord: () => {
        // Pick active unsolved blank, or first unsolved blank
        const targetIdx =
          activeIdx >= 0 && blankIndices.includes(activeIdx) && status[activeIdx] !== 'correct'
            ? activeIdx
            : blankIndices.find((idx) => status[idx] !== 'correct');

        if (targetIdx === undefined) return null;
        const targetWord = words[targetIdx].core;
        const cur = (values[targetIdx] || '').trim();

        // Find longest matching prefix, then reveal 1 more letter (just like Parroto!)
        let prefixLen = 0;
        while (
          prefixLen < cur.length &&
          prefixLen < targetWord.length &&
          cur[prefixLen].toLowerCase() === targetWord[prefixLen].toLowerCase()
        ) {
          prefixLen++;
        }

        const nextLen = Math.min(targetWord.length, prefixLen + 1);
        const revealed = targetWord.slice(0, nextLen);

        const nextVals = { ...values, [targetIdx]: revealed };
        setValues(nextVals);

        if (nextLen >= targetWord.length) {
          const nextStatus: Record<number, 'idle' | 'correct' | 'wrong'> = {
            ...status,
            [targetIdx]: 'correct',
          };
          setStatus(nextStatus);
          const nextTarget = findNextUnsolvedBlank(targetIdx, nextStatus);
          if (nextTarget >= 0) focusBlank(nextTarget);
          checkSolvedComplete(nextVals, nextStatus);
          return `Đã hoàn thành từ "${targetWord}"`;
        } else {
          setStatus((prev) => ({ ...prev, [targetIdx]: 'idle' }));
          focusBlank(targetIdx);
          return `Gợi ý thêm chữ cái: "${revealed}..."`;
        }
      },

      focusActive: () => {
        const target =
          activeIdx >= 0 && status[activeIdx] !== 'correct'
            ? activeIdx
            : blankIndices.find((idx) => status[idx] !== 'correct') ?? blankIndices[0];
        if (target !== undefined) focusBlank(target);
      },

      reset: () => {
        setValues({});
        setStatus({});
        solvedTriggeredRef.current = false;
        if (blankIndices[0] !== undefined) focusBlank(blankIndices[0]);
      },
    }));

    const solvedCount = blankIndices.filter((idx) => status[idx] === 'correct').length;
    const progressPct = blankIndices.length > 0 ? Math.round((solvedCount / blankIndices.length) * 100) : 0;

    return (
      <div className="relative space-y-3">
        {/* Invisible focus-keeper input: keeps mobile virtual keyboard open when the last word box locks into a completed chip */}
        <input
          ref={keeperRef}
          type="text"
          value=""
          aria-hidden="true"
          tabIndex={-1}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          onChange={() => {}}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onRequestNextSentence?.();
            } else if (e.key === 'Tab') {
              e.preventDefault();
              onReplay();
            }
          }}
          className="sr-only"
        />

        {/* Mini Progress Bar for Current Sentence */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>
              Gõ đúng tự động chuyển ô (hoặc nhấn{' '}
              <kbd className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 font-mono text-[10px]">
                Space
              </kbd>
              )
            </span>
            <span className="font-extrabold text-indigo-600 dark:text-indigo-400 shrink-0 ml-2">
              {solvedCount}/{blankIndices.length} từ
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-slate-200/70 dark:bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-emerald-400 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Parroto Word Capsules Container */}
        <div
          className="p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-slate-50/90 to-indigo-50/30 dark:from-[#0b1224] dark:to-[#0f172a] border border-slate-200/90 dark:border-white/10 shadow-inner flex flex-wrap items-center gap-x-2 gap-y-3 leading-relaxed"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              const next = blankIndices.find((idx) => status[idx] !== 'correct');
              if (next !== undefined) focusBlank(next);
            }
          }}
        >
          {words.map((w) => {
            if (!w.core) {
              return (
                <span key={w.index} className="text-slate-400 dark:text-slate-500 font-medium">
                  {w.leading}
                </span>
              );
            }

            if (!w.isBlank) {
              return (
                <span key={w.index} className="inline-flex items-baseline text-base font-semibold text-slate-700 dark:text-slate-200">
                  {w.leading}
                  <button
                    type="button"
                    onClick={() => onSelectWord(w.core)}
                    className="hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline decoration-dotted underline-offset-4 cursor-pointer"
                    title="Nhấn để tra & lưu từ vựng"
                  >
                    {w.core}
                  </button>
                  {w.trailing}
                </span>
              );
            }

            const st = status[w.index] || 'idle';
            const val = values[w.index] || '';
            const isFocused = activeIdx === w.index;
            const widthCh = Math.max(3.6, Math.min(18, Math.max(w.core.length, val.length) + 1.8));

            if (st === 'correct') {
              return (
                <span key={w.index} className="inline-flex items-baseline gap-0.5 animate-pop-in">
                  {w.leading && <span className="text-slate-400">{w.leading}</span>}
                  <button
                    type="button"
                    onClick={() => onSelectWord(w.core)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-gradient-to-b from-emerald-50 to-emerald-100/90 dark:from-emerald-950/90 dark:to-emerald-900/60 border border-emerald-300/90 dark:border-emerald-700/80 text-emerald-800 dark:text-emerald-200 font-bold text-base shadow-xs hover:ring-2 hover:ring-emerald-400 transition cursor-pointer"
                    title="Chính xác! Nhấn để tra & lưu Flashcard"
                  >
                    {w.core}
                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  </button>
                  {w.trailing && <span className="text-slate-500 dark:text-slate-300 font-medium">{w.trailing}</span>}
                </span>
              );
            }

            return (
              <span key={w.index} className="inline-flex items-baseline gap-0.5">
                {w.leading && <span className="text-slate-400">{w.leading}</span>}
                <input
                  ref={(el) => {
                    inputRefs.current[w.index] = el;
                  }}
                  type="text"
                  value={val}
                  autoCapitalize="off"
                  autoCorrect="off"
                  autoComplete="off"
                  spellCheck={false}
                  onFocus={() => setActiveIdx(w.index)}
                  onChange={(e) => handleChange(w.index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(w.index, e)}
                  style={{ width: `${widthCh}ch` }}
                  placeholder={'•'.repeat(Math.min(w.core.length, 6))}
                  className={`px-2.5 py-1.5 rounded-xl text-center text-base font-bold transition-all focus:outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600 placeholder:tracking-widest ${
                    st === 'wrong'
                      ? 'animate-shake bg-rose-50 dark:bg-rose-950/70 border-2 border-rose-400 dark:border-rose-500 text-rose-700 dark:text-rose-200 shadow-sm shadow-rose-500/15'
                      : isFocused
                      ? 'bg-white dark:bg-slate-900 border-2 border-indigo-500 ring-4 ring-indigo-500/15 text-slate-900 dark:text-white shadow-md shadow-indigo-500/10'
                      : 'bg-white/95 dark:bg-slate-900/90 border border-slate-300/80 dark:border-white/15 text-slate-900 dark:text-white shadow-xs hover:border-indigo-400'
                  }`}
                />
                {w.trailing && <span className="text-slate-500 dark:text-slate-300 font-medium">{w.trailing}</span>}
              </span>
            );
          })}
        </div>
      </div>
    );
  }
);
