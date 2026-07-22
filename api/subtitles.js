export default async function handler(req, res) {
  const { videoId } = req.query;

  if (!videoId) {
    return res.status(400).json({ error: "videoId 필요" });
  }

  try {
    // YouTube 내장 API 직접 호출
    const apiRes = await fetch(
      "https://www.youtube.com/youtubei/v1/get_transcript?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName: "WEB",
              clientVersion: "2.20240101.00.00",
            },
          },
          params: generateTranscriptParams(videoId),
        }),
      },
    );

    if (!apiRes.ok) {
      throw new Error(`YouTube API 응답 오류: ${apiRes.status}`);
    }

    const data = await apiRes.json();

    // transcript 데이터 추출
    const transcriptRenderer =
      data?.actions?.[0]?.updateEngagementPanelAction?.content
        ?.transcriptRenderer?.body?.transcriptBodyRenderer?.cueGroups;

    if (!transcriptRenderer?.length) {
      // 폴백: 페이지 파싱 방식
      const subtitles = await fallbackFetch(videoId);
      return res.status(200).json({ subtitles });
    }

    const subtitles = transcriptRenderer
      .map((group, i) => {
        const cue =
          group.transcriptCueGroupRenderer?.cues?.[0]?.transcriptCueRenderer;
        if (!cue) return null;

        const startMs = parseInt(cue.startOffsetMs || "0", 10);
        const durationMs = parseInt(cue.durationMs || "0", 10);
        const text = cue.cue?.simpleText || "";

        return {
          id: `${videoId}_${i}`,
          videoId,
          text: text.trim(),
          startTime: startMs / 1000,
          duration: durationMs / 1000,
          endTime: (startMs + durationMs) / 1000,
        };
      })
      .filter((s) => s && s.text);

    res.status(200).json({ subtitles });
  } catch (err) {
    console.error("자막 추출 실패:", err);

    // 최종 폴백
    try {
      const subtitles = await fallbackFetch(videoId);
      res.status(200).json({ subtitles });
    } catch (err2) {
      console.error("폴백도 실패:", err2);
      res.status(500).json({
        error: "자막을 가져올 수 없습니다. 자막이 있는 영상인지 확인해주세요.",
      });
    }
  }
}

// videoId → transcript params (protobuf 인코딩)
function generateTranscriptParams(videoId) {
  // 간단한 base64 인코딩된 protobuf params
  const innerParams = `\n\x0b${videoId}\x12\x02en`;
  const outerParams = `\n${String.fromCharCode(innerParams.length)}${innerParams}`;
  return Buffer.from(outerParams, "binary").toString("base64");
}

// 폴백: timedtext API 직접 호출
async function fallbackFetch(videoId) {
  // 1단계: 영상 페이지에서 자막 URL 추출
  const pageRes = await fetch(
    `https://www.youtube.com/watch?v=${videoId}&hl=en`,
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        Cookie: "CONSENT=YES+1",
      },
    },
  );

  const html = await pageRes.text();

  // timedtext URL 추출
  const timedtextMatch = html.match(
    /https:\/\/www\.youtube\.com\/api\/timedtext[^"\\]*/,
  );

  if (timedtextMatch) {
    const timedtextUrl = timedtextMatch[0]
      .replace(/\\u0026/g, "&")
      .replace(/\\"/g, '"');

    const captionRes = await fetch(timedtextUrl + "&fmt=json3");
    if (captionRes.ok) {
      const captionData = await captionRes.json();
      return captionData.events
        .filter((e) => e.segs)
        .map((e, i) => ({
          id: `${videoId}_${i}`,
          videoId,
          text: e.segs
            .map((s) => s.utf8)
            .join("")
            .trim(),
          startTime: (e.tStartMs || 0) / 1000,
          duration: (e.dDurationMs || 0) / 1000,
          endTime: ((e.tStartMs || 0) + (e.dDurationMs || 0)) / 1000,
        }))
        .filter((s) => s.text);
    }
  }

  // captionTracks 방식
  const captionMatch = html.match(/"captionTracks":\s*(\[.*?\])/);
  if (captionMatch) {
    const tracks = JSON.parse(captionMatch[1]);
    const enTrack =
      tracks.find((t) => t.languageCode === "en") ||
      tracks.find((t) => t.languageCode?.startsWith("en")) ||
      tracks[0];

    if (enTrack?.baseUrl) {
      const captionRes = await fetch(
        enTrack.baseUrl.replace(/\\u0026/g, "&") + "&fmt=json3",
      );
      if (captionRes.ok) {
        const captionData = await captionRes.json();
        return captionData.events
          .filter((e) => e.segs)
          .map((e, i) => ({
            id: `${videoId}_${i}`,
            videoId,
            text: e.segs
              .map((s) => s.utf8)
              .join("")
              .trim(),
            startTime: (e.tStartMs || 0) / 1000,
            duration: (e.dDurationMs || 0) / 1000,
            endTime: ((e.tStartMs || 0) + (e.dDurationMs || 0)) / 1000,
          }))
          .filter((s) => s.text);
      }
    }
  }

  throw new Error("자막을 찾을 수 없습니다.");
}
