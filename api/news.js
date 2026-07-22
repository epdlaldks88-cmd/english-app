export const config = {
  runtime: "edge",
};

const TOPICS = {
  world: "WORLD",
  business: "BUSINESS",
  technology: "TECHNOLOGY",
  science: "SCIENCE",
  health: "HEALTH",
  sports: "SPORTS",
  entertainment: "ENTERTAINMENT",
};

export default async function handler(req) {
  const url = new URL(req.url);
  const topic = url.searchParams.get("topic") || "world";

  const corsHeaders = {
    "Content-Type": "application/json",
  };

  try {
    const googleTopic = TOPICS[topic] || "WORLD";
    const rssUrl = `https://news.google.com/rss/headlines/section/topic/${googleTopic}?hl=en-US&gl=US&ceid=US:en`;

    const res = await fetch(rssUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
      },
    });

    if (!res.ok) throw new Error(`RSS 로드 실패: ${res.status}`);

    const xml = await res.text();

    // RSS XML 파싱
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match;

    while ((match = itemRegex.exec(xml)) !== null && items.length < 15) {
      const itemXml = match[1];

      const titleMatch =
        itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
        itemXml.match(/<title>(.*?)<\/title>/);
      const linkMatch = itemXml.match(/<link>(.*?)<\/link>/);
      const pubDateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/);
      const sourceMatch = itemXml.match(/<source[^>]*>(.*?)<\/source>/);
      const descMatch =
        itemXml.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) ||
        itemXml.match(/<description>(.*?)<\/description>/);

      if (!titleMatch || !linkMatch) continue;

      let title = titleMatch[1].trim();
      const link = linkMatch[1].trim();
      const pubDate = pubDateMatch?.[1] || "";
      const source = sourceMatch?.[1]?.trim() || "";

      // Google News 제목에서 " - Source" 제거
      if (source && title.endsWith(` - ${source}`)) {
        title = title.slice(0, -source.length - 3).trim();
      }

      // description에서 썸네일 추출
      let thumbnail = "";
      if (descMatch) {
        const imgMatch = descMatch[1].match(/src="([^"]+)"/);
        if (imgMatch) {
          thumbnail = imgMatch[1];
        }
      }

      // Google News 리다이렉트 URL에서 실제 URL 추출 시도
      let realUrl = link;
      if (link.includes("news.google.com")) {
        // Google News URL은 리다이렉트됨, 나중에 실제 URL로 변환
        realUrl = link;
      }

      items.push({
        title,
        url: realUrl,
        thumbnail,
        pubDate,
        source,
      });
    }

    return new Response(JSON.stringify({ articles: items }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}
