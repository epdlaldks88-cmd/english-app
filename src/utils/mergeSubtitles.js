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

    // 문장 끝 감지: . ? ! 로 끝나는 경우
    const combined = current.texts.join(" ");
    if (/[.?!]$/.test(combined.trim())) {
      merged.push({
        id: `merged_${merged.length}`,
        videoId: sub.videoId,
        text: combined.trim(),
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
