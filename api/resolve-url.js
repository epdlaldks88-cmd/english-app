export const config = {
  runtime: "edge",
};

export default async function handler(req) {
  const url = new URL(req.url);
  const targetUrl = url.searchParams.get("url");

  if (!targetUrl) {
    return new Response(JSON.stringify({ error: "url 필요" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Google News URL 처리
    if (targetUrl.includes("news.google.com")) {
      const res = await fetch(targetUrl, {
        redirect: "manual",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
        },
      });

      // 리다이렉트 URL 확인
      const location = res.headers.get("location");
      if (location && !location.includes("news.google.com")) {
        return new Response(JSON.stringify({ resolvedUrl: location }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // 리다이렉트 없으면 HTML에서 추출
      const html = await res.text();

      // data-n-au 속성에서 실제 URL 추출
      const nauMatch = html.match(/data-n-au="([^"]+)"/);
      if (nauMatch) {
        return new Response(JSON.stringify({ resolvedUrl: nauMatch[1] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // jsarticle 에서 추출
      const jsMatch = html.match(
        /window\.location\.replace\(['"]([^'"]+)['"]\)/,
      );
      if (jsMatch) {
        return new Response(JSON.stringify({ resolvedUrl: jsMatch[1] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // a태그 href에서 추출
      const hrefMatch = html.match(
        /<a[^>]+href="(https?:\/\/(?!news\.google)[^"]+)"[^>]*>/,
      );
      if (hrefMatch) {
        return new Response(JSON.stringify({ resolvedUrl: hrefMatch[1] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // 일반 URL: 리다이렉트 따라가기
    const res = await fetch(targetUrl, {
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
      },
    });

    return new Response(JSON.stringify({ resolvedUrl: res.url }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ resolvedUrl: targetUrl, error: err.message }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }
}
