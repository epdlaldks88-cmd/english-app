export const config = {
  runtime: "edge",
};

export default async function handler(req) {
  const url = new URL(req.url);
  const videoId = url.searchParams.get("videoId");

  if (!videoId) {
    return new Response(JSON.stringify({ error: "videoId 필요" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // YouTube Innertube Player API 호출
    const playerRes = await fetch(
      "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        },
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

    const playerData = await playerRes.json();

    const captionTracks =
      playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

    if (!captionTracks?.length) {
      throw new Error("이 영상에 자막이 없습니다.");
    }

    const enTrack =
      captionTracks.find((t) => t.languageCode === "en") ||
      captionTracks.find((t) => t.languageCode?.startsWith("en")) ||
      captionTracks[0];

    if (!enTrack?.baseUrl) {
      throw new Error("자막 URL을 찾을 수 없습니다.");
    }

    const captionRes = await fetch(enTrack.baseUrl + "&fmt=json3");
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

    return new Response(JSON.stringify({ subtitles }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("자막 추출 실패:", err);
    return new Response(
      JSON.stringify({
        error: err.message || "자막을 가져올 수 없습니다.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
