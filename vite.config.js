import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "api-subtitles",
      configureServer(server) {
        server.middlewares.use("/api/subtitles", async (req, res) => {
          const url = new URL(req.url, "http://localhost");
          const videoId = url.searchParams.get("videoId");

          if (!videoId) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: "videoId 필요" }));
            return;
          }

          try {
            const { YoutubeTranscript } = await import("youtube-transcript");
            const transcript = await YoutubeTranscript.fetchTranscript(
              videoId,
              {
                lang: "en",
              },
            );

            const subtitles = transcript.map((item, i) => ({
              id: `${videoId}_${i}`,
              videoId,
              text: item.text,
              startTime: item.offset / 1000,
              duration: item.duration / 1000,
              endTime: (item.offset + item.duration) / 1000,
            }));

            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ subtitles }));
          } catch (err) {
            console.error("자막 추출 실패:", err);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: "자막을 가져올 수 없습니다." }));
          }
        });
      },
    },
  ],
});
