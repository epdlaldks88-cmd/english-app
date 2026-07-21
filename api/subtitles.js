import { YoutubeTranscript } from "youtube-transcript";

export default async function handler(req, res) {
  const { videoId } = req.query;

  if (!videoId) {
    return res.status(400).json({ error: "videoId 필요" });
  }

  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId, {
      lang: "en",
    });

    const subtitles = transcript.map((item, i) => ({
      id: `${videoId}_${i}`,
      videoId,
      text: item.text,
      startTime: item.offset / 1000,
      duration: item.duration / 1000,
      endTime: (item.offset + item.duration) / 1000,
    }));

    res.status(200).json({ subtitles });
  } catch (err) {
    console.error("자막 추출 실패:", err);
    res
      .status(500)
      .json({
        error:
          "자막을 가져올 수 없습니다. 영어 자막이 없는 영상일 수 있습니다.",
      });
  }
}
