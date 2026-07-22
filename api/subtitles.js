export default async function handler(req, res) {
  const { videoId } = req.query;

  if (!videoId) {
    return res.status(400).json({ error: "videoId 필요" });
  }

  const clients = [
    {
      name: "ANDROID",
      version: "19.09.37",
      headers: {
        "User-Agent":
          "com.google.android.youtube/19.09.37 (Linux; U; Android 12) gzip",
        "X-YouTube-Client-Name": "3",
        "X-YouTube-Client-Version": "19.09.37",
      },
      body: {
        context: {
          client: {
            clientName: "ANDROID",
            clientVersion: "19.09.37",
            androidSdkVersion: 31,
            hl: "en",
            gl: "US",
          },
        },
        videoId,
      },
    },
    {
      name: "TVHTML5",
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
      body: {
        context: {
          client: {
            clientName: "TVHTML5_SIMPLY_EMBEDDED_PLAYER",
            clientVersion: "2.0",
            hl: "en",
            gl: "US",
          },
          thirdParty: {
            embedUrl: "https://www.google.com",
          },
        },
        videoId,
      },
    },
    {
      name: "WEB",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
      },
      body: {
        context: {
          client: {
            clientName: "WEB",
            clientVersion: "2.20241210.00.00",
            hl: "en",
            gl: "US",
          },
        },
        videoId,
      },
    },
  ];

  for (const client of clients) {
    try {
      console.log(`[${client.name}] 시도 중...`);

      const playerRes = await fetch(
        "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...client.headers,
          },
          body: JSON.stringify(client.body),
        },
      );

      if (!playerRes.ok) {
        console.log(`[${client.name}] HTTP 오류: ${playerRes.status}`);
        continue;
      }

      const playerData = await playerRes.json();

      const captionTracks =
        playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

      if (!captionTracks?.length) {
        console.log(`[${client.name}] 자막 트랙 없음`);
        continue;
      }

      const enTrack =
        captionTracks.find((t) => t.languageCode === "en") ||
        captionTracks.find((t) => t.languageCode?.startsWith("en")) ||
        captionTracks[0];

      if (!enTrack?.baseUrl) {
        console.log(`[${client.name}] baseUrl 없음`);
        continue;
      }

      const captionRes = await fetch(enTrack.baseUrl + "&fmt=json3");
      if (!captionRes.ok) {
        console.log(`[${client.name}] 자막 다운로드 실패`);
        continue;
      }

      const captionData = await captionRes.json();
      if (!captionData?.events?.length) {
        console.log(`[${client.name}] 이벤트 없음`);
        continue;
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

      console.log(`[${client.name}] 성공: ${subtitles.length}개`);
      return res.status(200).json({ subtitles });
    } catch (err) {
      console.log(`[${client.name}] 에러:`, err.message);
    }
  }

  res.status(500).json({
    error:
      "자막을 가져올 수 없습니다. 서버에서 YouTube 접근이 제한되어 있습니다.",
    fallback: true,
  });
}
