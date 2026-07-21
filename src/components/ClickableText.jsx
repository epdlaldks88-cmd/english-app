export default function ClickableText({ text, onWordClick }) {
  // 단어 단위로 분리, 구두점은 단어에 포함하지 않음
  const tokens = text.split(/(\s+)/);

  return (
    <span>
      {tokens.map((token, i) => {
        const trimmed = token.replace(/[^a-zA-Z'-]/g, "");
        if (!trimmed) return <span key={i}>{token}</span>;

        return (
          <span
            key={i}
            onClick={(e) => {
              e.stopPropagation();
              onWordClick(trimmed);
            }}
            className="cursor-pointer hover:text-accent hover:bg-accent/10 rounded px-0.5 transition-colors"
          >
            {token}
          </span>
        );
      })}
    </span>
  );
}
