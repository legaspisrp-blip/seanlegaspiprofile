// pages/rich-editor.jsx — markdown-style toolbar + inline renderer

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
}

// Render inline markdown to safe HTML.
// Supports: **bold**, *italic* or _italic_, `code`, [text](url), ~~strike~~
function renderInline(text) {
  // Escape first to prevent XSS, then re-apply markdown.
  let s = escapeHtml(text);
  // Links: [text](url) — url cannot contain spaces; auto-add target="_blank" rel
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => {
    const safeUrl = /^(https?:|mailto:|tel:|\/|#)/i.test(u) ? u : "#";
    return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${t}</a>`;
  });
  // Bold **text**
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // Italic *text* or _text_
  s = s.replace(/(^|\W)_([^_]+)_(?=\W|$)/g, "$1<em>$2</em>");
  s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  // Inline code `code`
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  // Strike ~~text~~
  s = s.replace(/~~([^~]+)~~/g, "<s>$1</s>");
  return s;
}

// Render a single block (already split by blank lines) into JSX.
function renderBlock(block, key) {
  if (!block || !block.t) return null;
  const text = block.t;

  if (block.s === "h") {
    return <h3 key={key} className="article-h" dangerouslySetInnerHTML={{ __html: renderInline(text) }} />;
  }

  // Block-level markdown:
  // > quote
  if (text.startsWith("> ")) {
    return <blockquote key={key} className="article-quote" dangerouslySetInnerHTML={{ __html: renderInline(text.slice(2)) }} />;
  }
  // ## sub-heading
  if (text.startsWith("## ")) {
    return <h4 key={key} className="article-h2" dangerouslySetInnerHTML={{ __html: renderInline(text.slice(3)) }} />;
  }
  // - bullet list (multi-line block where every line starts with "- ")
  if (/^- /.test(text) && text.split("\n").every(l => /^- /.test(l) || l.trim() === "")) {
    const items = text.split("\n").filter(l => l.startsWith("- ")).map(l => l.slice(2));
    return (
      <ul key={key} className="article-ul">
        {items.map((it, i) => <li key={i} dangerouslySetInnerHTML={{ __html: renderInline(it) }} />)}
      </ul>
    );
  }
  // 1. numbered list
  if (/^\d+\. /.test(text) && text.split("\n").every(l => /^\d+\. /.test(l) || l.trim() === "")) {
    const items = text.split("\n").filter(l => /^\d+\. /.test(l)).map(l => l.replace(/^\d+\.\s*/, ""));
    return (
      <ol key={key} className="article-ol">
        {items.map((it, i) => <li key={i} dangerouslySetInnerHTML={{ __html: renderInline(it) }} />)}
      </ol>
    );
  }

  return <p key={key} dangerouslySetInnerHTML={{ __html: renderInline(text) }} />;
}

// =====================================================
// RICH TOOLBAR
// =====================================================
function RichToolbar({ textareaRef, value, onChange }) {
  const apply = (fn) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const before = value.slice(0, start);
    const selected = value.slice(start, end);
    const after = value.slice(end);
    const result = fn({ before, selected, after, start, end });
    onChange(result.text);
    // Restore selection on next tick
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(result.selStart, result.selEnd);
    });
  };

  const wrap = (chars, placeholder = "text") => () => apply(({ before, selected, after }) => {
    const inner = selected || placeholder;
    const text = `${before}${chars}${inner}${chars}${after}`;
    const selStart = before.length + chars.length;
    const selEnd = selStart + inner.length;
    return { text, selStart, selEnd };
  });

  const prefixLine = (prefix) => () => apply(({ before, selected, after }) => {
    // Find start of current line
    const lineStart = before.lastIndexOf("\n") + 1;
    const lines = (selected || "line").split("\n").map(l => prefix + l).join("\n");
    const text = before.slice(0, lineStart) + prefix + before.slice(lineStart) + selected + after;
    // Simpler: just insert prefix at line start
    const newBefore = before.slice(0, lineStart) + prefix + before.slice(lineStart);
    const newText = newBefore + selected + after;
    return { text: newText, selStart: newBefore.length, selEnd: newBefore.length + selected.length };
  });

  const insertHeading = () => apply(({ before, selected, after }) => {
    const lineStart = before.lastIndexOf("\n\n") + 2;
    const isAtBlockStart = before.slice(lineStart).trim() === "";
    const headingText = selected || "Section heading";
    if (isAtBlockStart) {
      const newText = before + "§ " + headingText + after;
      return { text: newText, selStart: before.length + 2, selEnd: before.length + 2 + headingText.length };
    } else {
      // Insert as new block
      const insertion = (before.endsWith("\n") ? "\n" : "\n\n") + "§ " + headingText + "\n\n";
      const newText = before + insertion + after;
      const pos = before.length + insertion.indexOf("§ ") + 2;
      return { text: newText, selStart: pos, selEnd: pos + headingText.length };
    }
  });

  const insertSubheading = () => apply(({ before, selected, after }) => {
    const headingText = selected || "Sub-heading";
    const insertion = (before.endsWith("\n") || before === "" ? "" : "\n\n") + "## " + headingText + "\n\n";
    const newText = before + insertion + after;
    const pos = before.length + insertion.indexOf("## ") + 3;
    return { text: newText, selStart: pos, selEnd: pos + headingText.length };
  });

  const insertQuote = () => apply(({ before, selected, after }) => {
    const quoteText = selected || "A quote.";
    const insertion = (before.endsWith("\n") || before === "" ? "" : "\n\n") + "> " + quoteText + "\n\n";
    const newText = before + insertion + after;
    const pos = before.length + insertion.indexOf("> ") + 2;
    return { text: newText, selStart: pos, selEnd: pos + quoteText.length };
  });

  const insertList = (numbered) => () => apply(({ before, selected, after }) => {
    const lines = (selected || "First item\nSecond item").split("\n").filter(Boolean);
    const formatted = lines.map((l, i) => (numbered ? `${i + 1}. ` : "- ") + l).join("\n");
    const insertion = (before.endsWith("\n") || before === "" ? "" : "\n\n") + formatted + "\n\n";
    const newText = before + insertion + after;
    return { text: newText, selStart: before.length + insertion.length - 2, selEnd: before.length + insertion.length - 2 };
  });

  const insertLink = () => {
    const url = prompt("Link URL (e.g. https://example.com)");
    if (!url) return;
    apply(({ before, selected, after }) => {
      const linkText = selected || "link text";
      const text = `${before}[${linkText}](${url})${after}`;
      const selStart = before.length + 1;
      const selEnd = selStart + linkText.length;
      return { text, selStart, selEnd };
    });
  };

  return (
    <div className="rt-toolbar">
      <button type="button" className="rt-btn" title="Section heading (§)" onClick={insertHeading}>
        <span className="rt-icon serif">H</span>
      </button>
      <button type="button" className="rt-btn" title="Sub-heading (##)" onClick={insertSubheading}>
        <span className="rt-icon serif" style={{ fontSize: 11 }}>H2</span>
      </button>
      <span className="rt-sep" />
      <button type="button" className="rt-btn" title="Bold (**text**)" onClick={wrap("**", "bold text")}>
        <span className="rt-icon" style={{ fontWeight: 700 }}>B</span>
      </button>
      <button type="button" className="rt-btn" title="Italic (*text*)" onClick={wrap("*", "italic")}>
        <span className="rt-icon" style={{ fontStyle: "italic", fontFamily: "var(--serif)" }}>I</span>
      </button>
      <button type="button" className="rt-btn" title="Strikethrough (~~text~~)" onClick={wrap("~~", "strike")}>
        <span className="rt-icon" style={{ textDecoration: "line-through" }}>S</span>
      </button>
      <button type="button" className="rt-btn" title="Inline code (`code`)" onClick={wrap("`", "code")}>
        <span className="rt-icon mono" style={{ fontSize: 11 }}>{`<>`}</span>
      </button>
      <span className="rt-sep" />
      <button type="button" className="rt-btn" title="Bullet list" onClick={insertList(false)}>
        <span className="rt-icon">•≡</span>
      </button>
      <button type="button" className="rt-btn" title="Numbered list" onClick={insertList(true)}>
        <span className="rt-icon mono" style={{ fontSize: 11 }}>1.≡</span>
      </button>
      <button type="button" className="rt-btn" title="Quote" onClick={insertQuote}>
        <span className="rt-icon">"</span>
      </button>
      <button type="button" className="rt-btn" title="Link" onClick={insertLink}>
        <span className="rt-icon">↗</span>
      </button>
    </div>
  );
}

Object.assign(window, { RichToolbar, renderInline, renderBlock, escapeHtml });
