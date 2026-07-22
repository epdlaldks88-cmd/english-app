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
              // 로컬에서는 기존 패키지 사용 (더 안정적)
              const { YoutubeTranscript } = await import("youtube-transcript");
              let transcript;
              try {
                transcript = await YoutubeTranscript.fetchTranscript(videoId, {
                  lang: "en",
                });
              } catch {
                try {
                  transcript = await YoutubeTranscript.fetchTranscript(videoId);
                } catch {
                  transcript = await YoutubeTranscript.fetchTranscript(
                    videoId,
                    { lang: "en-US" },
                  );
                }
              }

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
      {
        name: "api-fetch-article",
        configureServer(server) {
          server.middlewares.use("/api/fetch-article", async (req, res) => {
            const url = new URL(req.url, "http://localhost");
            const articleUrl = url.searchParams.get("url");

            if (!articleUrl) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "url 필요" }));
              return;
            }

            try {
              const fetchRes = await fetch(articleUrl, {
                headers: {
                  "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
                  "Accept-Language": "en-US,en;q=0.9",
                },
              });

              const html = await fetchRes.text();

              const ogTitleMatch = html.match(
                /property="og:title"\s+content="([^"]+)"/i,
              );
              const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
              const rawTitle =
                ogTitleMatch?.[1] || titleMatch?.[1] || "제목 없음";

              const cleaned = html
                .replace(/<script[\s\S]*?<\/script>/gi, "")
                .replace(/<style[\s\S]*?<\/style>/gi, "")
                .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
                .replace(/<!--[\s\S]*?-->/g, "");

              const targetHtml = cleaned;

              // CNN 등 data-component-name="paragraph" 전용 추출
              const cnnParagraphs = [];
              const cnnRegex =
                /<p[^>]*data-component-name="paragraph"[^>]*>([\s\S]*?)<\/p>/gi;
              let cnnMatch;
              while ((cnnMatch = cnnRegex.exec(targetHtml)) !== null) {
                const text = cnnMatch[1]
                  .replace(/<[^>]+>/g, "")
                  .replace(/&amp;/g, "&")
                  .replace(/&lt;/g, "<")
                  .replace(/&gt;/g, ">")
                  .replace(/&quot;/g, '"')
                  .replace(/&#39;/g, "'")
                  .replace(/&nbsp;/g, " ")
                  .replace(/\s+/g, " ")
                  .trim();
                if (text.length >= 20) cnnParagraphs.push(text);
              }

              if (cnnParagraphs.length > 0) {
                res.setHeader("Content-Type", "application/json");
                res.end(
                  JSON.stringify({
                    title: rawTitle
                      .replace(/&amp;/g, "&")
                      .replace(/&quot;/g, '"')
                      .replace(/&#39;/g, "'")
                      .replace(/\s*[-|]\s*(BBC|CNN|Reuters).*$/i, "")
                      .trim(),
                    content: cnnParagraphs.join("\n\n"),
                  }),
                );
                return;
              }

              const paragraphs = [];
              const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
              let match;

              while ((match = pRegex.exec(targetHtml)) !== null) {
                if (
                  /class="[^"]*(?:caption|credit|image-|photo-|fig|gallery|media)/i.test(
                    match[0],
                  )
                )
                  continue;

                const text = match[1]
                  .replace(/<[^>]+>/g, "")
                  .replace(/&amp;/g, "&")
                  .replace(/&lt;/g, "<")
                  .replace(/&gt;/g, ">")
                  .replace(/&quot;/g, '"')
                  .replace(/&#39;/g, "'")
                  .replace(/&nbsp;/g, " ")
                  .replace(/\s+/g, " ")
                  .trim();

                if (text.length < 40 || text.split(" ").length < 8) continue;
                if (!/[a-zA-Z]/.test(text)) continue;
                if (
                  /^(Share|Follow|Subscribe|Sign up|Log in|Read more|Related|Copyright|©)/i.test(
                    text,
                  )
                )
                  continue;
                if (
                  /^(Published|Updated|Written by|Edited by|By\s)/i.test(text)
                )
                  continue;
                if (
                  /(click here|sign up|newsletter|subscribe|download the app)/i.test(
                    text,
                  )
                )
                  continue;
                if (
                  /(getty|reuters|ap photo|afp|associated press|shutterstock)/i.test(
                    text,
                  ) &&
                  text.length < 150
                )
                  continue;
                if (/^(Related:|See also:|More:|Read:|RELATED)/i.test(text))
                  continue;
                if (/(sponsored|advertisement|promoted)/i.test(text)) continue;

                paragraphs.push(text);
              }

              if (paragraphs.length === 0)
                throw new Error("기사 본문을 추출할 수 없습니다.");

              const title = rawTitle
                .replace(/&amp;/g, "&")
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/\s*[-|]\s*(BBC|CNN|Reuters).*$/i, "")
                .trim();

              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({ title, content: paragraphs.join("\n\n") }),
              );
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
        },
      },
    ],
  };
});
