export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST만 허용" });
  }

  const { texts } = req.body;

  if (!texts?.length) {
    return res.status(400).json({ error: "texts 배열 필요" });
  }

  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "DEEPL_API_KEY 미설정" });
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

    if (!response.ok) {
      throw new Error(`DeepL ${response.status}`);
    }

    const data = await response.json();
    const translations = data.translations.map((t) => t.text);

    res.status(200).json({ translations });
  } catch (err) {
    console.error("번역 실패:", err);
    res.status(500).json({ error: "번역 실패" });
  }
}
