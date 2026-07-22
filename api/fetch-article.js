export const config = {
  runtime: "edge",
};

export default async function handler(req) {
  const url = new URL(req.url);
  const articleUrl = url.searchParams.get("url");

  if (!articleUrl) {
    return new Response(JSON.stringify({ error: "url 필요" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const res = await fetch(articleUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!res.ok) throw new Error(`페이지 로드 실패: ${res.status}`);

    const html = await res.text();

    // 제목 추출
    const ogTitleMatch = html.match(/property="og:title"\s+content="([^"]+)"/i);
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    const title = ogTitleMatch?.[1] || titleMatch?.[1] || "제목 없음";

    // 불필요한 영역 제거
    // script/style/noscript만 제거, 나머지는 isArticleContent 필터에 맡김
    const cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "");

    // 본문 영역 우선 추출
    // 본문 영역: 여러 패턴 시도, 결과를 합침
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
      return new Response(
        JSON.stringify({
          title: cleanTitle(title),
          content: cnnParagraphs.join("\n\n"),
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // <p> 태그 내용 수집
    const paragraphs = [];
    const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    let match;

    while ((match = pRegex.exec(targetHtml)) !== null) {
      // 이미지 캡션 클래스 스킵
      if (
        /class="[^"]*(?:caption|credit|image-|photo-|fig|gallery|media)/i.test(
          match[0],
        )
      ) {
        continue;
      }

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

      if (isArticleContent(text)) {
        paragraphs.push(text);
      }
    }

    if (paragraphs.length === 0) {
      throw new Error("기사 본문을 추출할 수 없습니다.");
    }

    return new Response(
      JSON.stringify({
        title: cleanTitle(title),
        content: paragraphs.join("\n\n"),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

function isArticleContent(text) {
  if (text.length < 40) return false;
  if (text.split(" ").length < 8) return false;
  if (!/[a-zA-Z]/.test(text)) return false;

  // UI/네비게이션 텍스트
  if (
    /^(Share|Follow|Subscribe|Sign up|Log in|Read more|Related|Copyright|©|Cookie|Privacy|Terms|Menu|Search|Home)/i.test(
      text,
    )
  )
    return false;

  // 메타 정보
  if (
    /^(Published|Updated|Written by|Edited by|By\s|Source:|Photo:|Image:|Video:)/i.test(
      text,
    )
  )
    return false;

  // CTA
  if (
    /(click here|sign up|newsletter|subscribe|download the app|get the latest|join us)/i.test(
      text,
    )
  )
    return false;

  // 이미지 캡션 / 크레딧
  if (
    /(getty|reuters|ap photo|afp|associated press|shutterstock|stock photo|file photo|courtesy of|pool photo)/i.test(
      text,
    ) &&
    text.length < 150
  )
    return false;
  if (/^\(.*\)$/.test(text)) return false; // (Getty Images) 같은 형태

  // Related article 패턴
  if (/^(Related:|See also:|More:|Read:|RELATED)/i.test(text)) return false;
  if (
    /^(Here's|Here are|Check out|Don't miss|You may also)/i.test(text) &&
    text.length < 100
  )
    return false;

  // CNN 특유의 related article 링크
  if (/^[A-Z][^.]*CNN[^.]*$/i.test(text) && text.length < 100) return false;

  // 광고/프로모션
  if (
    /(sponsored|advertisement|promoted|paid content|partner content)/i.test(
      text,
    )
  )
    return false;

  return true;
}

function cleanTitle(title) {
  return title
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(
      /\s*[-|]\s*(BBC|CNN|Reuters|AP|NPR|The Guardian|Washington Post|New York Times).*$/i,
      "",
    )
    .trim();
}
