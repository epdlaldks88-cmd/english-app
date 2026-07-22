export default async function handler(req, res) {
  const { videoId } = req.query;

  if (!videoId) {
    return res.status(400).json({ error: "videoId 필요" });
  }

  try {
    // 1단계: YouTube Innertube Player API로 자막 트랙 URL 가져오기
    const playerRes = await fetch(
      "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: {
            client: {
              clientName: "WEB",
              clientVersion: "2.20241210.00.00",
              hl: "en",
              gl: "US",
            },
          },
          videoId,
        }),
      },
    );

    if (!playerRes.ok) {
      throw new Error(`Player API 오류: ${playerRes.status}`);
    }

    const playerData = await playerRes.json();

    const captionTracks =
      playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

    if (!captionTracks?.length) {
      throw new Error("이 영상에 사용 가능한 자막이 없습니다.");
    }

    // 영어 자막 우선
    const enTrack =
      captionTracks.find((t) => t.languageCode === "en") ||
      captionTracks.find((t) => t.languageCode?.startsWith("en")) ||
      captionTracks[0];

    if (!enTrack?.baseUrl) {
      throw new Error("자막 트랙 URL을 찾을 수 없습니다.");
    }

    // 2단계: 자막 데이터 다운로드 (json3 형식)
    const captionUrl = enTrack.baseUrl + "&fmt=json3";
    const captionRes = await fetch(captionUrl);

    if (!captionRes.ok) {
      throw new Error(`자막 다운로드 실패: ${captionRes.status}`);
    }

    const captionData = await captionRes.json();

    if (!captionData?.events?.length) {
      throw new Error("자막 데이터가 비어있습니다.");
    }

    const subtitles = captionData.events
      .filter((e) => e.segs)
      .map((e, i) => ({
        id: `${videoId}_${i}`,
        videoId,
        text: e.segs
          .map((s) => s.utf8 || "")
          .join("")
          .replace(/\n/g, " ")
          .trim(),
        startTime: (e.tStartMs || 0) / 1000,
        duration: (e.dDurationMs || 0) / 1000,
        endTime: ((e.tStartMs || 0) + (e.dDurationMs || 0)) / 1000,
      }))
      .filter((s) => s.text);

    res.status(200).json({ subtitles });
  } catch (err) {
    console.error("자막 추출 실패:", err);
    res.status(500).json({
      error: err.message || "자막을 가져올 수 없습니다.",
    });
  }
}
