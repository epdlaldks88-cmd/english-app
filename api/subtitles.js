export default async function handler(req, res) {
  const { videoId } = req.query;

  if (!videoId) {
    return res.status(400).json({ error: "videoId 필요" });
  }

  try {
    // YouTube 페이지에서 자막 URL 추출
    const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!pageRes.ok) throw new Error("YouTube 페이지 로드 실패");

    const html = await pageRes.text();

    // playerResponse에서 자막 트랙 정보 추출
    const captionMatch = html.match(/"captionTracks":\s*(\[.*?\])/);
    if (!captionMatch) {
      throw new Error("이 영상에 사용 가능한 자막이 없습니다.");
    }

    let captionTracks;
    try {
      captionTracks = JSON.parse(captionMatch[1]);
    } catch {
      throw new Error("자막 정보 파싱 실패");
    }

    // 영어 자막 우선, 없으면 첫 번째 자막
    const enTrack =
      captionTracks.find((t) => t.languageCode === "en") ||
      captionTracks.find((t) => t.languageCode?.startsWith("en")) ||
      captionTracks[0];

    if (!enTrack?.baseUrl) {
      throw new Error("영어 자막 트랙을 찾을 수 없습니다.");
    }

    // 자막 XML 가져오기
    const captionRes = await fetch(enTrack.baseUrl + "&fmt=json3");
    if (!captionRes.ok) throw new Error("자막 데이터 로드 실패");

    const captionData = await captionRes.json();

    const subtitles = captionData.events
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

    res.status(200).json({ subtitles });
  } catch (err) {
    console.error("자막 추출 실패:", err);
    res
      .status(500)
      .json({ error: err.message || "자막을 가져올 수 없습니다." });
  }
}
