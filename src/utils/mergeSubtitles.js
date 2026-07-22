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

    // 1순위: 문장 끝(.?!) 감지
    const endsWithPunctuation = /[.?!]$/.test(combined);

    // 2순위: 너무 길면 강제 분리 (마침표 없는 구어체 대응)
    const isTooLong = combined.length > 300;

    if (endsWithPunctuation || isTooLong) {
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
