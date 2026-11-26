import React, { useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import { Play, Pause, RotateCcw, Volume2, Youtube, Headphones } from 'lucide-react';
import { formatTime, speakEnglish, stopSpeaking } from '../utils/dictation';

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export interface MediaPlayerHandle {
  replaySegment: () => void;
  togglePlay: () => void;
  stop: () => void;
}

interface MediaPlayerProps {
  mediaType: 'youtube' | 'upload_video' | 'upload_audio' | 'audio_tts';
  youtubeId?: string | null;
  mediaUrl?: string | null;
  thumbnailUrl?: string | null;
  accent?: string;
  speaker?: string;
  startTime: number;
  endTime: number;
  sentenceText: string;
  playbackRate: number;
  loopSegment: boolean;
  forceTTS: boolean;
  onToggleForceTTS?: () => void;
}

let ytApiPromise: Promise<void> | null = null;
function loadYouTubeAPI(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    document.body.appendChild(script);
  });
  return ytApiPromise;
}

export const MediaPlayer = forwardRef<MediaPlayerHandle, MediaPlayerProps>(function MediaPlayer(
  {
    mediaType,
    youtubeId,
    mediaUrl,
    thumbnailUrl,
    accent = 'US',
    speaker = '',
    startTime,
    endTime,
    sentenceText,
    playbackRate,
    loopSegment,
    forceTTS,
    onToggleForceTTS,
  },
  ref
) {
  const effectiveMode = forceTTS || mediaType === 'audio_tts' ? 'audio_tts' : mediaType;

  const ytContainerRef = useRef<HTMLDivElement | null>(null);
  const ytPlayerRef = useRef<any>(null);
  const ytReadyRef = useRef(false);
  const htmlMediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [ytReady, setYtReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(startTime);

  const segmentRef = useRef({ startTime, endTime, sentenceText, playbackRate, loopSegment, accent });
  segmentRef.current = { startTime, endTime, sentenceText, playbackRate, loopSegment, accent };

  // Initialize YouTube player when in youtube mode
  useEffect(() => {
    if (effectiveMode !== 'youtube' || !youtubeId) return;
    let cancelled = false;
    setYtReady(false);
    ytReadyRef.current = false;

    loadYouTubeAPI().then(() => {
      if (cancelled || !ytContainerRef.current) return;
      if (ytPlayerRef.current) {
        try {
          ytPlayerRef.current.destroy();
        } catch {
          // ignore
        }
      }
      ytContainerRef.current.innerHTML = '';
      const mountEl = document.createElement('div');
      ytContainerRef.current.appendChild(mountEl);

      ytPlayerRef.current = new window.YT.Player(mountEl, {
        videoId: youtubeId,
        width: '100%',
        height: '100%',
        playerVars: {
          rel: 0,
          modestbranding: 1,
          cc_load_policy: 0, // hide captions by default for dictation!
          iv_load_policy: 3,
          playsinline: 1,
          start: Math.floor(segmentRef.current.startTime),
        },
        events: {
          onReady: (e: any) => {
            if (cancelled) return;
            ytReadyRef.current = true;
            setYtReady(true);
            try {
              e.target.setPlaybackRate(segmentRef.current.playbackRate);
            } catch {
              // ignore
            }
          },
          onStateChange: (e: any) => {
            if (cancelled) return;
            if (e.data === window.YT?.PlayerState?.PLAYING) {
              setIsPlaying(true);
            } else if (
              e.data === window.YT?.PlayerState?.PAUSED ||
              e.data === window.YT?.PlayerState?.ENDED
            ) {
              setIsPlaying(false);
            }
          },
        },
      });
    });

    return () => {
      cancelled = true;
      if (ytPlayerRef.current) {
        try {
          ytPlayerRef.current.destroy();
        } catch {
          // ignore
        }
        ytPlayerRef.current = null;
      }
    };
  }, [effectiveMode, youtubeId]);

  // Sync playbackRate changes
  useEffect(() => {
    if (effectiveMode === 'youtube' && ytPlayerRef.current && ytReadyRef.current) {
      try {
        ytPlayerRef.current.setPlaybackRate(playbackRate);
      } catch {
        // ignore
      }
    }
    if ((effectiveMode === 'upload_video' || effectiveMode === 'upload_audio') && htmlMediaRef.current) {
      htmlMediaRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate, effectiveMode]);

  // Poll YouTube time to stop/loop at endTime
  useEffect(() => {
    if (effectiveMode !== 'youtube') return;
    const timer = window.setInterval(() => {
      const player = ytPlayerRef.current;
      if (!player || !ytReadyRef.current || typeof player.getCurrentTime !== 'function') return;
      if (player.getPlayerState?.() !== window.YT?.PlayerState?.PLAYING) return;
      const now = player.getCurrentTime();
      setCurrentTime(now);
      const { startTime: s, endTime: e, loopSegment: loop } = segmentRef.current;
      if (now >= e - 0.08) {
        if (loop) {
          player.seekTo(s, true);
        } else {
          player.pauseVideo();
          setIsPlaying(false);
        }
      }
    }, 120);
    return () => window.clearInterval(timer);
  }, [effectiveMode]);

  // Stop speech when unmounting or switching sentence
  useEffect(() => {
    setCurrentTime(startTime);
    stopSpeaking();
    setIsPlaying(false);
    return () => {
      stopSpeaking();
    };
  }, [startTime, endTime, effectiveMode]);

  const playTTSLoop = () => {
    const { sentenceText: txt, playbackRate: rate, accent: acc } = segmentRef.current;
    setIsPlaying(true);
    speakEnglish(txt, {
      rate,
      accent: acc,
      onEnd: () => {
        if (segmentRef.current.loopSegment) {
          setTimeout(() => {
            if (segmentRef.current.loopSegment) {
              playTTSLoop();
            }
          }, 600);
        } else {
          setIsPlaying(false);
        }
      },
    });
  };

  const replaySegment = () => {
    const { startTime: s, playbackRate: rate } = segmentRef.current;
    if (effectiveMode === 'audio_tts') {
      playTTSLoop();
      return;
    }
    if (effectiveMode === 'youtube') {
      const p = ytPlayerRef.current;
      if (p && ytReadyRef.current) {
        try {
          p.setPlaybackRate(rate);
          p.seekTo(s, true);
          p.playVideo();
          setIsPlaying(true);
        } catch {
          // ignore
        }
      }
      return;
    }
    const el = htmlMediaRef.current;
    if (el) {
      el.playbackRate = rate;
      el.currentTime = s;
      el.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const stop = () => {
    stopSpeaking();
    if (effectiveMode === 'youtube' && ytPlayerRef.current && ytReadyRef.current) {
      try {
        ytPlayerRef.current.pauseVideo();
      } catch {
        // ignore
      }
    }
    if (htmlMediaRef.current) {
      htmlMediaRef.current.pause();
    }
    setIsPlaying(false);
  };

  const togglePlay = () => {
    if (isPlaying) {
      stop();
    } else {
      replaySegment();
    }
  };

  useImperativeHandle(ref, () => ({
    replaySegment,
    togglePlay,
    stop,
  }));

  const handleHtmlTimeUpdate = () => {
    const el = htmlMediaRef.current;
    if (!el) return;
    setCurrentTime(el.currentTime);
    if (el.currentTime >= endTime - 0.05) {
      if (loopSegment) {
        el.currentTime = startTime;
        el.play().catch(() => {});
      } else {
        el.pause();
        setIsPlaying(false);
      }
    }
  };

  return (
    <div className="rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg">
      {/* Media Viewport */}
      {effectiveMode === 'youtube' && youtubeId ? (
        <div className="relative aspect-video bg-black">
          <div ref={ytContainerRef} className="w-full h-full" />
          {!ytReady && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 text-slate-300 gap-2">
              <Youtube className="w-10 h-10 text-rose-500 animate-pulse" />
              <span className="text-sm">Đang tải trình phát Video YouTube...</span>
            </div>
          )}
        </div>
      ) : effectiveMode === 'upload_video' && mediaUrl ? (
        <div className="relative aspect-video bg-black">
          <video
            ref={htmlMediaRef as React.RefObject<HTMLVideoElement>}
            src={mediaUrl}
            onTimeUpdate={handleHtmlTimeUpdate}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            controls
            className="w-full h-full object-contain"
          />
        </div>
      ) : effectiveMode === 'upload_audio' && mediaUrl ? (
        <div className="relative p-6 bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 text-white flex flex-col items-center justify-center min-h-[210px] gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center">
            <Headphones className="w-7 h-7 text-indigo-300" />
          </div>
          <audio
            ref={htmlMediaRef as React.RefObject<HTMLAudioElement>}
            src={mediaUrl}
            onTimeUpdate={handleHtmlTimeUpdate}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            controls
            className="w-full max-w-md"
          />
        </div>
      ) : (
        /* AI Studio Voice Player */
        <div className="relative min-h-[220px] p-6 bg-gradient-to-br from-indigo-950 via-slate-900 to-violet-950 text-white flex flex-col items-center justify-center overflow-hidden">
          {thumbnailUrl && (
            <img
              src={thumbnailUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover opacity-15 pointer-events-none"
            />
          )}
          <div className="relative z-10 flex flex-col items-center text-center gap-4">
            <div className="flex items-end gap-1.5 h-12">
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className={`w-2 rounded-full bg-gradient-to-t from-indigo-400 to-cyan-300 transition-all ${
                    isPlaying ? 'eq-bar h-11' : 'h-3 opacity-50'
                  }`}
                  style={{ animationDelay: `${i * 0.12}s` }}
                />
              ))}
            </div>
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur text-xs font-medium text-indigo-200 border border-white/10">
                <Volume2 className="w-3.5 h-3.5" />
                Giọng đọc AI ({accent === 'UK' ? 'Anh - Anh (UK)' : 'Anh - Mỹ (US)'})
                {speaker ? ` • ${speaker}` : ''}
              </span>
              <p className="mt-2 text-xs text-slate-300">
                Nhấn <kbd className="px-1.5 py-0.5 rounded bg-white/15 font-mono">Tab</kbd> hoặc nút bên dưới để nghe lại câu hiện tại
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Segment Control Bar */}
      <div className="px-4 py-3 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 border-t border-slate-800">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePlay}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition cursor-pointer shadow-sm"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {isPlaying ? 'Tạm dừng' : 'Nghe câu này'}
          </button>
          <button
            type="button"
            onClick={replaySegment}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition cursor-pointer"
            title="Phát lại câu (Phím Tab)"
          >
            <RotateCcw className="w-4 h-4" />
            Lặp lại
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="font-mono bg-slate-800 px-2.5 py-1 rounded-lg text-slate-200">
            {formatTime(currentTime)} / {formatTime(startTime)}–{formatTime(endTime)}
          </span>
          {mediaType === 'youtube' && onToggleForceTTS && (
            <button
              type="button"
              onClick={onToggleForceTTS}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                forceTTS
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
              title="Chuyển đổi giữa Video YouTube và giọng đọc AI chậm rõ"
            >
              {forceTTS ? <Youtube className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              {forceTTS ? 'Về Video YouTube' : 'Giọng đọc AI'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
