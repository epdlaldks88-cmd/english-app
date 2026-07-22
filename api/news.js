export const config = {
  runtime: "edge",
};

const CNN_SECTIONS = {
  world: "https://edition.cnn.com/world",
  business: "https://edition.cnn.com/business",
  technology: "https://edition.cnn.com/tech",
  science: "https://edition.cnn.com/science",
  health: "https://edition.cnn.com/health",
  sports: "https://edition.cnn.com/sport",
  entertainment: "https://edition.cnn.com/entertainment",
};

export default async function handler(req) {
  const url = new URL(req.url);
  const topic = url.searchParams.get("topic") || "world";

  try {
    const sectionUrl = CNN_SECTIONS[topic] || CNN_SECTIONS.world;

    const res = await fetch(sectionUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!res.ok) throw new Error(`CNN 로드 실패: ${res.status}`);

    const html = await res.text();
    const articles = extractArticles(html);

    return new Response(JSON.stringify({ articles }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

function extractArticles(html) {
  const articles = [];
  const seen = new Set();

  // CNN 기사 링크 + 제목 추출
  // 패턴 1: data-link 속성
  const dataLinkRegex =
    /data-link="(\/\d{4}\/\d{2}\/\d{2}\/[^"]+)"[^>]*>[\s\S]*?<span[^>]*class="[^"]*container__headline-text[^"]*"[^>]*>([\s\S]*?)<\/span>/gi;
  let match;

  while ((match = dataLinkRegex.exec(html)) !== null && articles.length < 20) {
    const path = match[1];
    const title = match[2]
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (title && !seen.has(path)) {
      seen.add(path);
      articles.push({ path, title });
    }
  }

  // 패턴 2: a href로 기사 링크
  const linkRegex =
    /<a[^>]+href="(\/\d{4}\/\d{2}\/\d{2}\/[^"]+)"[^>]*>[\s\S]*?<span[^>]*class="[^"]*headline[^"]*"[^>]*>([\s\S]*?)<\/span>/gi;

  while ((match = linkRegex.exec(html)) !== null && articles.length < 20) {
    const path = match[1];
    const title = match[2]
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (title && !seen.has(path)) {
      seen.add(path);
      articles.push({ path, title });
    }
  }

  // 패턴 3: 더 넓은 범위
  const broadRegex =
    /href="(\/\d{4}\/\d{2}\/\d{2}\/[^"]+\/index\.html)"[^>]*>/gi;

  while ((match = broadRegex.exec(html)) !== null && articles.length < 20) {
    const path = match[1];
    if (!seen.has(path)) {
      seen.add(path);

      // 주변에서 제목 찾기
      const nearbyTitle = html.slice(
        Math.max(0, match.index - 500),
        match.index + 500,
      );
      const titleMatch = nearbyTitle.match(
        /class="[^"]*headline[^"]*"[^>]*>([\s\S]*?)<\/span>/,
      );
      const title = titleMatch
        ? titleMatch[1]
            .replace(/<[^>]+>/g, "")
            .replace(/\s+/g, " ")
            .trim()
        : "";

      if (title) {
        articles.push({ path, title });
      }
    }
  }

  // 이미지 추출 + URL 조합
  return articles.slice(0, 15).map((a) => {
    const fullUrl = `https://edition.cnn.com${a.path}`;

    // 경로에서 날짜 추출
    const dateMatch = a.path.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
    const pubDate = dateMatch
      ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`
      : "";

    return {
      title: a.title,
      url: fullUrl,
      thumbnail: "",
      pubDate,
      source: "CNN",
      description: "",
    };
  });
}
