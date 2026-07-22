export function mergeSubtitles(subtitles) {
  if (!subtitles?.length) return [];

  // 1단계: 전체 텍스트를 하나로 합치면서 타임스탬프 매핑
  const segments = [];
  for (const sub of subtitles) {
    segments.push({
      text: sub.text,
      startTime: sub.startTime,
      endTime: sub.endTime,
      videoId: sub.videoId,
    });
  }

  // 2단계: 전체 텍스트에서 문장 분리
  const fullParts = [];
  for (const seg of segments) {
    const words = seg.text.split(/\s+/);
    for (const word of words) {
      fullParts.push({
        word,
        startTime: seg.startTime,
        endTime: seg.endTime,
        videoId: seg.videoId,
      });
    }
  }

  // 3단계: 문장 경계에서 분리
  const merged = [];
  let currentWords = [];
  let startTime = fullParts[0]?.startTime || 0;

  for (let i = 0; i < fullParts.length; i++) {
    const part = fullParts[i];
    currentWords.push(part.word);

    const combined = currentWords.join(" ");
    const lastWord = part.word;

    // 문장 끝 감지: 단어가 .?! 로 끝남
    const endsWithPunctuation = /[.?!]$/.test(lastWord);

    // [Music] 등 태그는 스킵
    const isTag = /^\[.*\]$/.test(lastWord);

    // 강제 분리: 15초 이상 또는 250자 이상
    const duration = part.endTime - startTime;
    const forceSplit = duration >= 15 || combined.length >= 250;

    if (
      (endsWithPunctuation && combined.length >= 20 && !isTag) ||
      forceSplit
    ) {
      const text = currentWords
        .join(" ")
        .replace(/\[music\]/gi, "")
        .replace(/\[.*?\]/g, "")
        .replace(/\s+/g, " ")
        .trim();

      if (text) {
        merged.push({
          id: `merged_${merged.length}`,
          videoId: part.videoId,
          text,
          startTime,
          endTime: part.endTime,
        });
      }

      currentWords = [];
      startTime = fullParts[i + 1]?.startTime || part.endTime;
    }
  }

  // 마지막 남은 조각
  if (currentWords.length > 0) {
    const text = currentWords
      .join(" ")
      .replace(/\[music\]/gi, "")
      .replace(/\[.*?\]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (text) {
      merged.push({
        id: `merged_${merged.length}`,
        videoId: fullParts[fullParts.length - 1].videoId,
        text,
        startTime,
        endTime: fullParts[fullParts.length - 1].endTime,
      });
    }
  }

  return merged;
}
