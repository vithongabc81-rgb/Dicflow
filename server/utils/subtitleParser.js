/**
 * Subtitle & URL parsing utilities for .srt, .vtt, timestamped transcripts, and YouTube URLs.
 */

function extractYouTubeId(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /[?&]v=([a-zA-Z0-9_-]{11})/,
  ];
  for (const regex of patterns) {
    const match = trimmed.match(regex);
    if (match && match[1]) return match[1];
  }
  return null;
}

function timeStringToSeconds(str) {
  if (typeof str === 'number') return str;
  const clean = String(str).trim().replace(',', '.');
  const parts = clean.split(':').map(Number);
  if (parts.some((n) => Number.isNaN(n))) return 0;
  if (parts.length === 3) {
    return +(parts[0] * 3600 + parts[1] * 60 + parts[2]).toFixed(2);
  }
  if (parts.length === 2) {
    return +(parts[0] * 60 + parts[1]).toFixed(2);
  }
  return +(parts[0] || 0).toFixed(2);
}

function cleanCaptionText(text) {
  return text
    .replace(/<[^>]+>/g, '') // strip HTML/VTT tags
    .replace(/\{[^}]+\}/g, '') // strip ASS/SSA style tags
    .replace(/\s+/g, ' ')
    .trim();
}

function parseSubtitles(rawText) {
  if (!rawText || typeof rawText !== 'string') return [];
  const normalized = rawText.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!normalized) return [];

  // 1. Try SRT / VTT format (contains "-->")
  if (normalized.includes('-->')) {
    const blocks = normalized
      .replace(/^WEBVTT[^\n]*\n*/i, '')
      .split(/\n{2,}/);

    const results = [];
    for (const block of blocks) {
      const lines = block
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      if (!lines.length) continue;

      const timeIdx = lines.findIndex((l) => l.includes('-->'));
      if (timeIdx === -1) continue;

      const timeLine = lines[timeIdx];
      const match = timeLine.match(
        /(\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3}\s*-->\s*(\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3}/
      );
      if (!match) continue;

      const [startRaw, endRaw] = match[0].split('-->').map((s) => s.trim());
      const start_time = timeStringToSeconds(startRaw);
      const end_time = Math.max(start_time + 1, timeStringToSeconds(endRaw));

      const textLines = lines.slice(timeIdx + 1);
      const text_en = cleanCaptionText(textLines.join(' '));
      if (!text_en) continue;

      results.push({
        start_time,
        end_time,
        text_en,
        text_vi: '',
      });
    }
    if (results.length > 0) return results;
  }

  // 2. Try bracketed timestamps like [00:12] Text or [00:12 - 00:16] Text
  const lines = normalized
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const bracketRegex = /^\[(\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?)(?:\s*-\s*(\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?))?\]\s*(.+)$/;
  const hasBrackets = lines.some((l) => bracketRegex.test(l));

  if (hasBrackets) {
    const parsed = [];
    for (const line of lines) {
      const m = line.match(bracketRegex);
      if (!m) continue;
      const start_time = timeStringToSeconds(m[1]);
      const end_time = m[2] ? timeStringToSeconds(m[2]) : null;
      const parts = m[3].split('|').map((p) => p.trim());
      parsed.push({
        start_time,
        end_time,
        text_en: cleanCaptionText(parts[0]),
        text_vi: parts[1] || '',
      });
    }
    for (let i = 0; i < parsed.length; i++) {
      if (parsed[i].end_time === null) {
        const nextStart = parsed[i + 1]?.start_time;
        parsed[i].end_time =
          nextStart && nextStart > parsed[i].start_time
            ? nextStart
            : +(parsed[i].start_time + 4.5).toFixed(2);
      }
    }
    if (parsed.length > 0) return parsed;
  }

  // 3. Fallback: Plain lines (optional "English | Vietnamese") with estimated timestamps
  let cursor = 0;
  return lines
    .map((line) => {
      const parts = line.split('|').map((p) => p.trim());
      const text_en = cleanCaptionText(parts[0]);
      if (!text_en) return null;
      const wordCount = text_en.split(/\s+/).length;
      const estDuration = Math.max(2.5, +(wordCount * 0.45 + 1.2).toFixed(2));
      const item = {
        start_time: +cursor.toFixed(2),
        end_time: +(cursor + estDuration).toFixed(2),
        text_en,
        text_vi: parts[1] || '',
      };
      cursor += estDuration + 0.5;
      return item;
    })
    .filter(Boolean);
}

module.exports = {
  extractYouTubeId,
  timeStringToSeconds,
  parseSubtitles,
};
