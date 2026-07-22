export const config = {
  runtime: "edge",
};

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST만 허용" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { texts } = await req.json();

  if (!texts?.length) {
    return new Response(JSON.stringify({ error: "texts 배열 필요" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "DEEPL_API_KEY 미설정" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
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

    if (!response.ok) throw new Error(`DeepL ${response.status}`);

    const data = await response.json();
    const translations = data.translations.map((t) => t.text);

    return new Response(JSON.stringify({ translations }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("번역 실패:", err);
    return new Response(JSON.stringify({ error: "번역 실패" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
