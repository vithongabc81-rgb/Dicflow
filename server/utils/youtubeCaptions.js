/**
 * Fetch YouTube video metadata & English captions (manual CC or auto-generated ASR)
 * and merge raw caption cues into clean, dictation-ready sentences with timestamps.
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
  // Format 3: <p t="1234" d="2000">...</p>
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

  // Classic format: <text start="1.23" dur="2.34">...</text>
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
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  if (!res.ok) throw new Error(`Caption track fetch failed (${res.status})`);
  const body = await res.text();
  if (body.trim().startsWith('{')) {
    return parseJson3Events(JSON.parse(body));
  }
  return parseXmlCaptions(body);
}

/**
 * Merge fragmented ASR / short caption cues into natural dictation sentences
 * with non-overlapping timestamps.
 */
function mergeCuesIntoSentences(rawCues) {
  if (!rawCues.length) return [];

  // Normalize overlapping end times first
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
      // Capitalize first letter nicely for ASR captions
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

    // Flush immediately if this chunk ended a sentence with enough words
    const latest = buffer.texts.join(' ');
    if (/[.!?]["']?$/.test(latest.trim()) && latest.split(/\s+/).length >= 5) {
      flush();
    }
  }
  flush();

  return merged;
}

async function callInnertubePlayer(videoId, clientConfig) {
  const res = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': clientConfig.userAgent,
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

async function fetchYouTubeCaptions(videoId) {
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

  let playerData = null;
  let tracks = [];

  for (const cfg of clients) {
    try {
      const data = await callInnertubePlayer(videoId, cfg);
      const foundTracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
      if (!playerData && data?.videoDetails) {
        playerData = data;
      }
      if (foundTracks.length > 0) {
        playerData = data;
        tracks = foundTracks;
        break;
      }
    } catch {
      // try next client
    }
  }

  const videoDetails = playerData?.videoDetails || {};
  const title = videoDetails.title || '';
  const author = videoDetails.author || '';
  const durationSec = Number(videoDetails.lengthSeconds || 0);
  const thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  if (!tracks.length) {
    return {
      videoId,
      title,
      author,
      duration_sec: durationSec,
      thumbnail_url: thumbnailUrl,
      has_captions: false,
      sentences: [],
      error:
        'Video YouTube này không có phụ đề (CC / phụ đề tự động). Bạn vẫn có thể dán lời thoại hoặc tải file .srt/.vtt thủ công bên dưới.',
    };
  }

  // Prefer manual English track > auto-generated English track > first available track
  const enTrack =
    tracks.find((t) => /^en\b/i.test(t.languageCode || '') && t.kind !== 'asr') ||
    tracks.find((t) => /^en/i.test(t.languageCode || '')) ||
    tracks[0];

  const rawCues = await fetchTrackCues(enTrack.baseUrl);
  const sentences = mergeCuesIntoSentences(rawCues);

  // Bonus: if a native Vietnamese caption track exists, align Vietnamese meanings by timestamp
  const viTrack = tracks.find((t) => /^vi\b/i.test(t.languageCode || ''));
  if (viTrack && sentences.length > 0) {
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
      // Optional Vietnamese track alignment failed; proceed with English sentences
    }
  }

  return {
    videoId,
    title,
    author,
    duration_sec: durationSec,
    thumbnail_url: thumbnailUrl,
    has_captions: sentences.length > 0,
    track_language: enTrack.languageCode || 'en',
    is_auto_generated: enTrack.kind === 'asr',
    has_vietnamese: Boolean(viTrack),
    raw_count: rawCues.length,
    sentences,
  };
}

module.exports = {
  fetchYouTubeCaptions,
};
