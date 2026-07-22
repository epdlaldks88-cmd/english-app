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
      {
        name: "api-news",
        configureServer(server) {
          server.middlewares.use("/api/news", async (req, res) => {
            const url = new URL(req.url, "http://localhost");
            const topic = url.searchParams.get("topic") || "world";

            const sections = {
              world: "https://edition.cnn.com/world",
              business: "https://edition.cnn.com/business",
              technology: "https://edition.cnn.com/tech",
              science: "https://edition.cnn.com/science",
              health: "https://edition.cnn.com/health",
              sports: "https://edition.cnn.com/sport",
              entertainment: "https://edition.cnn.com/entertainment",
            };

            try {
              const sectionUrl = sections[topic] || sections.world;

              const fetchRes = await fetch(sectionUrl, {
                headers: {
                  "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
                  "Accept-Language": "en-US,en;q=0.9",
                },
              });

              if (!fetchRes.ok)
                throw new Error(`CNN 로드 실패: ${fetchRes.status}`);

              const html = await fetchRes.text();
              const articles = [];
              const seen = new Set();

              // 기사 링크 + 제목 추출
              const patterns = [
                /data-link="(\/\d{4}\/\d{2}\/\d{2}\/[^"]+)"[^>]*>[\s\S]*?<span[^>]*class="[^"]*container__headline-text[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
                /<a[^>]+href="(\/\d{4}\/\d{2}\/\d{2}\/[^"]+)"[^>]*>[\s\S]*?<span[^>]*class="[^"]*headline[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
              ];

              for (const regex of patterns) {
                let match;
                while (
                  (match = regex.exec(html)) !== null &&
                  articles.length < 20
                ) {
                  const path = match[1];
                  const title = match[2]
                    .replace(/<[^>]+>/g, "")
                    .replace(/\s+/g, " ")
                    .trim();
                  if (title && !seen.has(path)) {
                    seen.add(path);
                    const dateMatch = path.match(
                      /\/(\d{4})\/(\d{2})\/(\d{2})\//,
                    );
                    articles.push({
                      title,
                      url: `https://edition.cnn.com${path}`,
                      thumbnail: "",
                      pubDate: dateMatch
                        ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`
                        : "",
                      source: "CNN",
                      description: "",
                    });
                  }
                }
              }

              console.log("CNN articles found:", articles.length);

              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ articles: articles.slice(0, 15) }));
            } catch (err) {
              console.log("news error:", err.message);
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
        },
      },
      {
        name: "api-resolve-url",
        configureServer(server) {
          server.middlewares.use("/api/resolve-url", async (req, res) => {
            const url = new URL(req.url, "http://localhost");
            const targetUrl = url.searchParams.get("url");

            if (!targetUrl) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "url 필요" }));
              return;
            }

            try {
              // Google News URL: 브라우저처럼 페이지 로드
              const fetchRes = await fetch(targetUrl, {
                redirect: "follow",
                headers: {
                  "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
                  Accept: "text/html",
                  "Accept-Language": "en-US,en;q=0.9",
                },
              });

              // 최종 URL이 Google News가 아니면 성공
              if (!fetchRes.url.includes("news.google.com")) {
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ resolvedUrl: fetchRes.url }));
                return;
              }

              // HTML에서 실제 URL 추출
              const html = await fetchRes.text();

              // 방법들 순차 시도
              const patterns = [
                /data-n-au="([^"]+)"/,
                /<a[^>]+href="(https?:\/\/(?!news\.google|accounts\.google|support\.google)[^"]+)"[^>]*data-n-au/,
                /window\.location\.replace\(['"]([^'"]+)['"]\)/,
                /<meta[^>]+http-equiv="refresh"[^>]+url=([^"'\s>]+)/i,
                /<link[^>]+rel="canonical"[^>]+href="(https?:\/\/(?!news\.google)[^"]+)"/,
                /property="og:url"[^>]+content="([^"]+)"/,
                /content="([^"]+)"[^>]+property="og:url"/,
              ];

              for (const pattern of patterns) {
                const match = html.match(pattern);
                if (match?.[1] && !match[1].includes("news.google.com")) {
                  const resolved = match[1].replace(/&amp;/g, "&");
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({ resolvedUrl: resolved }));
                  return;
                }
              }

              // 모든 href에서 외부 URL 찾기
              const allUrls = html.match(
                /href="(https?:\/\/(?!news\.google|accounts\.google|support\.google|play\.google|consent\.google)[^"]+)"/g,
              );
              if (allUrls) {
                for (const u of allUrls) {
                  const urlMatch = u.match(/href="([^"]+)"/);
                  if (urlMatch) {
                    res.setHeader("Content-Type", "application/json");
                    res.end(
                      JSON.stringify({
                        resolvedUrl: urlMatch[1].replace(/&amp;/g, "&"),
                      }),
                    );
                    return;
                  }
                }
              }

              // 실패
              console.log("Google News URL 해결 실패, HTML 길이:", html.length);
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ resolvedUrl: targetUrl, failed: true }));
            } catch (err) {
              console.log("resolve-url 에러:", err.message);
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ resolvedUrl: targetUrl }));
            }
          });
        },
      },
    ],
  };
});
