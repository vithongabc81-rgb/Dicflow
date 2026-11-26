/**
 * Multi-layer YouTube video metadata & English captions fetcher.
 * Works reliably across both localhost and cloud servers (Render/Railway/VPS),
 * with oEmbed metadata fallback when datacenter IPs hit YouTube bot checks.
 */

function decodeHtmlEntities(str) {
  return String(str || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code)))
    .replace(/\u200b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanSpeechText(text) {
  return decodeHtmlEntities(text)
    .replace(/\[[^\]]*\]/g, '') // remove [Music], [Applause], [Laughter]
    .replace(/\([^)]*(?:music|applause|laughter|cheering|sighs|inaudible)[^)]*\)/gi, '')
    .replace(/♪[^♪]*♪/g, '')
    .replace(/♪/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseJson3Events(json3) {
  const events = Array.isArray(json3?.events) ? json3.events : [];
  const cues = [];
  for (const ev of events) {
    if (!ev || !Array.isArray(ev.segs)) continue;
    const raw = ev.segs.map((s) => s.utf8 || '').join('');
    const text = cleanSpeechText(raw);
    if (!text) continue;
    const start = Number(ev.tStartMs || 0) / 1000;
    const dur = Number(ev.dDurationMs || 3500) / 1000;
    cues.push({
      start: +start.toFixed(2),
      end: +(start + Math.max(0.8, dur)).toFixed(2),
      text,
    });
  }
  return cues;
}

function parseXmlCaptions(xml) {
  const cues = [];
  const pRegex = /<p\b[^>]*\bt="(\d+)"[^>]*?(?:\bd="(\d+)")?[^>]*>([\s\S]*?)<\/p>/g;
  let m;
  while ((m = pRegex.exec(xml)) !== null) {
    const start = Number(m[1]) / 1000;
    const dur = Number(m[2] || 3500) / 1000;
    const inner = m[3].replace(/<[^>]+>/g, '');
    const text = cleanSpeechText(inner);
    if (!text) continue;
    cues.push({
      start: +start.toFixed(2),
      end: +(start + Math.max(0.8, dur)).toFixed(2),
      text,
    });
  }
  if (cues.length > 0) return cues;

  const textRegex = /<text\b[^>]*start="([\d.]+)"[^>]*?(?:dur="([\d.]+)")?[^>]*>([\s\S]*?)<\/text>/g;
  while ((m = textRegex.exec(xml)) !== null) {
    const start = Number(m[1]);
    const dur = Number(m[2] || 3.5);
    const inner = m[3].replace(/<[^>]+>/g, '');
    const text = cleanSpeechText(inner);
    if (!text) continue;
    cues.push({
      start: +start.toFixed(2),
      end: +(start + Math.max(0.8, dur)).toFixed(2),
      text,
    });
  }
  return cues;
}

async function fetchTrackCues(baseUrl) {
  const u = new URL(baseUrl);
  u.searchParams.set('fmt', 'json3');
  const res = await fetch(u.toString(), {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
  if (!res.ok) throw new Error(`Caption track fetch failed (${res.status})`);
  const body = await res.text();
  if (!body || !body.trim()) return [];
  if (body.trim().startsWith('{')) {
    return parseJson3Events(JSON.parse(body));
  }
  return parseXmlCaptions(body);
}

function mergeCuesIntoSentences(rawCues) {
  if (!rawCues.length) return [];

  const cues = rawCues.map((c, idx) => {
    const nextStart = rawCues[idx + 1]?.start;
    let end = c.end;
    if (nextStart !== undefined && end > nextStart + 0.15) {
      end = Math.max(c.start + 0.6, +(nextStart - 0.05).toFixed(2));
    }
    return { ...c, end };
  });

  const merged = [];
  let buffer = null;

  const flush = () => {
    if (!buffer) return;
    let text = buffer.texts.join(' ').replace(/\s+/g, ' ').trim();
    if (text) {
      text = text.charAt(0).toUpperCase() + text.slice(1);
      merged.push({
        start_time: +buffer.start.toFixed(2),
        end_time: +Math.max(buffer.start + 1.2, buffer.end).toFixed(2),
        text_en: text,
        text_vi: '',
      });
    }
    buffer = null;
  };

  for (const cue of cues) {
    if (!buffer) {
      buffer = { start: cue.start, end: cue.end, texts: [cue.text] };
    } else {
      const currentText = buffer.texts.join(' ');
      const currentWords = currentText.split(/\s+/).length;
      const nextWords = cue.text.split(/\s+/).length;
      const gap = cue.start - buffer.end;
      const combinedDuration = cue.end - buffer.start;
      const endsWithPunct = /[.!?]["']?$/.test(currentText.trim());

      if (
        endsWithPunct ||
        gap > 1.3 ||
        currentWords + nextWords > 18 ||
        combinedDuration > 8.5
      ) {
        flush();
        buffer = { start: cue.start, end: cue.end, texts: [cue.text] };
      } else {
        buffer.texts.push(cue.text);
        buffer.end = Math.max(buffer.end, cue.end);
      }
    }

    const latest = buffer.texts.join(' ');
    if (/[.!?]["']?$/.test(latest.trim()) && latest.split(/\s+/).length >= 5) {
      flush();
    }
  }
  flush();

  return merged;
}

async function fetchOEmbedMeta(videoId) {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(
        `https://www.youtube.com/watch?v=${videoId}`
      )}&format=json`
    );
    if (!res.ok) return null;
    const data = await res.json();
    return {
      title: data.title || '',
      author: data.author_name || '',
    };
  } catch {
    return null;
  }
}

async function scrapeWatchPage(videoId) {
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        Cookie: 'CONSENT=YES+cb.20210328-17-p0.en+FX+667',
      },
    });
    if (!res.ok) return null;
    const html = await res.text();

    const apiKeyMatch = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/);
    const apiKey = apiKeyMatch ? apiKeyMatch[1] : null;

    let tracks = [];
    const tracksMatch = html.match(
      /"captionTracks":(\[[\s\S]*?\])(?:,"audioTracks"|,"translationLanguages"|,"defaultAudioTrackIndex")/
    );
    if (tracksMatch) {
      try {
        tracks = JSON.parse(tracksMatch[1]);
      } catch {
        tracks = [];
      }
    }

    const titleMatch = html.match(/"videoDetails":\{[\s\S]*?"title":"((?:[^"\\]|\\.)*)"/);
    const authorMatch = html.match(/"videoDetails":\{[\s\S]*?"author":"((?:[^"\\]|\\.)*)"/);
    const lengthMatch = html.match(/"lengthSeconds":"(\d+)"/);
    const loginRequired = html.includes('"status":"LOGIN_REQUIRED"');

    const unescapeJson = (s) => {
      try {
        return JSON.parse(`"${s}"`);
      } catch {
        return s || '';
      }
    };

    return {
      apiKey,
      tracks,
      title: titleMatch ? unescapeJson(titleMatch[1]) : '',
      author: authorMatch ? unescapeJson(authorMatch[1]) : '',
      durationSec: lengthMatch ? Number(lengthMatch[1]) : 0,
      loginRequired,
    };
  } catch {
    return null;
  }
}

async function callInnertubePlayer(videoId, clientConfig, apiKey) {
  const endpoint = apiKey
    ? `https://www.youtube.com/youtubei/v1/player?key=${encodeURIComponent(apiKey)}&prettyPrint=false`
    : 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false';

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': clientConfig.userAgent,
      'Accept-Language': 'en-US,en;q=0.9',
    },
    body: JSON.stringify({
      context: {
        client: {
          clientName: clientConfig.clientName,
          clientVersion: clientConfig.clientVersion,
          hl: 'en',
        },
      },
      videoId,
    }),
  });
  if (!res.ok) return null;
  return res.json();
}

async function tryFetchFromTracks(tracks) {
  if (!Array.isArray(tracks) || tracks.length === 0) return null;
  const enTrack =
    tracks.find((t) => /^en\b/i.test(t.languageCode || '') && t.kind !== 'asr') ||
    tracks.find((t) => /^en/i.test(t.languageCode || '')) ||
    tracks[0];
  if (!enTrack || !enTrack.baseUrl) return null;

  let rawCues = [];
  try {
    rawCues = await fetchTrackCues(enTrack.baseUrl);
  } catch {
    rawCues = [];
  }
  const sentences = mergeCuesIntoSentences(rawCues);
  if (!sentences.length) return null;

  const viTrack = tracks.find((t) => /^vi\b/i.test(t.languageCode || ''));
  if (viTrack && viTrack.baseUrl) {
    try {
      const viCues = await fetchTrackCues(viTrack.baseUrl);
      for (const s of sentences) {
        const overlapping = viCues.filter(
          (v) => v.end > s.start_time + 0.15 && v.start < s.end_time - 0.15
        );
        if (overlapping.length > 0) {
          s.text_vi = overlapping.map((v) => v.text).join(' ').replace(/\s+/g, ' ').trim();
        }
      }
    } catch {
      // Optional Vietnamese alignment
    }
  }

  return {
    enTrack,
    hasVietnamese: Boolean(viTrack),
    rawCount: rawCues.length,
    sentences,
  };
}

async function fetchYouTubeCaptions(videoId) {
  let title = '';
  let author = '';
  let durationSec = 0;
  let blockedByYouTube = false;
  let fetched = null;

  // Priority 1: Innertube ANDROID / IOS clients (their timedtext URLs work without web PO tokens)
  const clients = [
    {
      clientName: 'ANDROID',
      clientVersion: '20.10.38',
      userAgent: 'com.google.android.youtube/20.10.38 (Linux; U; Android 14)',
    },
    {
      clientName: 'IOS',
      clientVersion: '20.10.4',
      userAgent: 'com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X;)',
    },
  ];

  for (const cfg of clients) {
    try {
      const data = await callInnertubePlayer(videoId, cfg, null);
      if (!data) continue;
      if (data?.playabilityStatus?.status === 'LOGIN_REQUIRED') {
        blockedByYouTube = true;
      }
      if (!title && data?.videoDetails?.title) title = data.videoDetails.title;
      if (!author && data?.videoDetails?.author) author = data.videoDetails.author;
      if (!durationSec && data?.videoDetails?.lengthSeconds) {
        durationSec = Number(data.videoDetails.lengthSeconds);
      }
      const foundTracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
      const result = await tryFetchFromTracks(foundTracks);
      if (result) {
        fetched = result;
        blockedByYouTube = false;
        break;
      }
    } catch {
      // try next client
    }
  }

  // Priority 2: Watch HTML scrape (+ retry ANDROID with extracted INNERTUBE_API_KEY)
  if (!fetched) {
    const watchData = await scrapeWatchPage(videoId);
    if (watchData) {
      if (!title && watchData.title) title = watchData.title;
      if (!author && watchData.author) author = watchData.author;
      if (!durationSec && watchData.durationSec) durationSec = watchData.durationSec;
      if (watchData.loginRequired) blockedByYouTube = true;

      if (watchData.tracks && watchData.tracks.length > 0) {
        const result = await tryFetchFromTracks(watchData.tracks);
        if (result) {
          fetched = result;
          blockedByYouTube = false;
        }
      }

      if (!fetched && watchData.apiKey) {
        try {
          const data = await callInnertubePlayer(videoId, clients[0], watchData.apiKey);
          const foundTracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
          const result = await tryFetchFromTracks(foundTracks);
          if (result) {
            fetched = result;
            blockedByYouTube = false;
          }
        } catch {
          // ignore
        }
      }
    }
  }

  // Always enrich title/author via oEmbed if missing (never blocked on cloud IPs)
  if (!title || !author) {
    const oembed = await fetchOEmbedMeta(videoId);
    if (oembed) {
      if (!title) title = oembed.title;
      if (!author) author = oembed.author;
    }
  }

  const thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  if (!fetched) {
    return {
      videoId,
      title,
      author,
      duration_sec: durationSec,
      thumbnail_url: thumbnailUrl,
      has_captions: false,
      blocked_by_youtube: blockedByYouTube,
      sentences: [],
      error: blockedByYouTube
        ? 'YouTube đang hạn chế IP máy chủ đám mây (Render) tải phụ đề tự động cho video này. Tiêu đề đã được điền sẵn — bạn hãy mở mục "Hiện bản chép lời (Transcript)" ngay trên YouTube, copy rồi dán vào ô phụ đề bên dưới và bấm "Phân tích & Tách thành từng câu" nhé!'
        : 'Video YouTube này chưa có phụ đề hoặc YouTube đang chặn máy chủ tải phụ đề tự động. Bạn có thể copy mục "Bản chép lời (Transcript)" từ YouTube rồi dán vào ô bên dưới (hệ thống tự đọc mốc thời gian 0:12 của YouTube!).',
    };
  }

  return {
    videoId,
    title,
    author,
    duration_sec: durationSec,
    thumbnail_url: thumbnailUrl,
    has_captions: true,
    blocked_by_youtube: false,
    track_language: fetched.enTrack.languageCode || 'en',
    is_auto_generated: fetched.enTrack.kind === 'asr',
    has_vietnamese: fetched.hasVietnamese,
    raw_count: fetched.rawCount,
    sentences: fetched.sentences,
  };
}

module.exports = {
  fetchYouTubeCaptions,
};
