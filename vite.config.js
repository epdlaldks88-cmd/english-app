import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: "autoUpdate",
        manifest: false, // public/manifest.json 사용
        workbox: {
          globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/api\.dictionaryapi\.dev\/.*/i,
              handler: "CacheFirst",
              options: {
                cacheName: "dictionary-cache",
                expiration: {
                  maxEntries: 500,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
              },
            },
            {
              urlPattern: /^https:\/\/img\.youtube\.com\/.*/i,
              handler: "CacheFirst",
              options: {
                cacheName: "youtube-thumbnails",
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 7,
                },
              },
            },
          ],
        },
      }),
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
                { lang: "en" },
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
      {
        name: "api-translate",
        configureServer(server) {
          server.middlewares.use("/api/translate", async (req, res) => {
            if (req.method !== "POST") {
              res.statusCode = 405;
              res.end(JSON.stringify({ error: "POST만 허용" }));
              return;
            }

            let body = "";
            req.on("data", (chunk) => (body += chunk));
            req.on("end", async () => {
              try {
                const { texts } = JSON.parse(body);

                if (!texts?.length) {
                  res.statusCode = 400;
                  res.end(JSON.stringify({ error: "texts 배열 필요" }));
                  return;
                }

                const apiKey = env.DEEPL_API_KEY;
                if (!apiKey) {
                  res.statusCode = 500;
                  res.end(
                    JSON.stringify({
                      error: "DEEPL_API_KEY가 .env에 없습니다.",
                    }),
                  );
                  return;
                }

                const host = apiKey.endsWith(":fx")
                  ? "https://api-free.deepl.com"
                  : "https://api.deepl.com";

                const response = await fetch(`${host}/v2/translate`, {
                  method: "POST",
                  headers: {
                    Authorization: `DeepL-Auth-Key ${apiKey}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    text: texts,
                    source_lang: "EN",
                    target_lang: "KO",
                  }),
                });

                if (!response.ok) {
                  const errText = await response.text();
                  throw new Error(
                    `DeepL API 오류: ${response.status} ${errText}`,
                  );
                }

                const data = await response.json();
                const translations = data.translations.map((t) => t.text);

                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ translations }));
              } catch (err) {
                console.error("번역 실패:", err);
                res.statusCode = 500;
                res.end(JSON.stringify({ error: err.message }));
              }
            });
          });
        },
      },
    ],
  };
});
