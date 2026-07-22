export function mergeSubtitles(subtitles) {
  if (!subtitles?.length) return [];

  const merged = [];
  let current = {
    texts: [],
    startTime: subtitles[0].startTime,
    endTime: subtitles[0].endTime,
  };

  for (const sub of subtitles) {
    current.texts.push(sub.text);
    current.endTime = sub.endTime;

    const combined = current.texts.join(" ").trim();

    // 문장 끝 감지: .?! 로 끝나거나, 시간이 충분히 쌓였거나, 길이가 길면 분리
    const endsWithPunctuation = /[.?!]$/.test(combined);
    const duration = current.endTime - current.startTime;
    const isTooLong = combined.length > 150;
    const isReasonableChunk = combined.length > 60 && duration > 3;

    if (endsWithPunctuation || isTooLong || isReasonableChunk) {
      merged.push({
        id: `merged_${merged.length}`,
        videoId: sub.videoId,
        text: combined,
        startTime: current.startTime,
        endTime: current.endTime,
      });
      current = {
        texts: [],
        startTime: sub.endTime,
        endTime: sub.endTime,
      };
    }
  }

  // 마지막 남은 조각
  if (current.texts.length > 0) {
    merged.push({
      id: `merged_${merged.length}`,
      videoId: subtitles[0].videoId,
      text: current.texts.join(" ").trim(),
      startTime: current.startTime,
      endTime: current.endTime,
    });
  }

  return merged;
}
