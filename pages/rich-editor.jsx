// pages/rich-editor.jsx — contentEditable WYSIWYG editor

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
}

// Render inline markdown (for legacy seed articles that don't have HTML body yet)
function renderInline(text) {
  let s = escapeHtml(text);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => {
    const safeUrl = /^(https?:|mailto:|tel:|\/|#)/i.test(u) ? u : "#";
    return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${t}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|\W)_([^_]+)_(?=\W|$)/g, "$1<em>$2</em>");
  s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/~~([^~]+)~~/g, "<s>$1</s>");
  return s;
}

// Convert legacy blocks to HTML so the rich editor can load them
function blocksToHTML(blocks) {
  if (!blocks) return "";
  return blocks.map(b => {
    const t = b.t || "";
    if (b.s === "h") return `<h3>${renderInline(t)}</h3>`;
    if (t.startsWith("> ")) return `<blockquote>${renderInline(t.slice(2))}</blockquote>`;
    if (t.startsWith("## ")) return `<h4>${renderInline(t.slice(3))}</h4>`;
    // Detect a list inside this block
    const lines = t.split("\n");
    const firstBulletIdx = lines.findIndex(l => /^\s*[-•]\s/.test(l));
    if (firstBulletIdx >= 0) {
      const lead = lines.slice(0, firstBulletIdx).join(" ").trim();
      const items = lines.slice(firstBulletIdx).filter(l => /^\s*[-•]\s/.test(l)).map(l => l.replace(/^\s*[-•]\s*/, ""));
      return (lead ? `<p>${renderInline(lead)}</p>` : "") + `<ul>${items.map(it => `<li>${renderInline(it)}</li>`).join("")}</ul>`;
    }
    // Inline "Sources: - A - B - C" rescue
    if (lines.length === 1 && / - /.test(t)) {
      const parts = t.split(" - ");
      if (parts.length >= 3) {
        const lead = parts[0].trim();
        const items = parts.slice(1);
        return `<p>${renderInline(lead)}</p><ul>${items.map(it => `<li>${renderInline(it.trim())}</li>`).join("")}</ul>`;
      }
    }
    // Plain paragraph
    return `<p>${renderInline(t).replace(/\n/g, "<br/>")}</p>`;
  }).join("");
}

// =====================================================
// WYSIWYG EDITOR
// =====================================================
function RichEditor({ initialHTML, onChange, onReady }) {
  const editorRef = React.useRef(null);
  const [active, setActive] = React.useState({});
  const [linkOpen, setLinkOpen] = React.useState(false);
  const [linkUrl, setLinkUrl] = React.useState("");
  const savedSelection = React.useRef(null);

  // Set the initial HTML exactly once (uncontrolled)
  React.useEffect(() => {
    if (editorRef.current && !editorRef.current.dataset.init) {
      editorRef.current.innerHTML = initialHTML || "<p></p>";
      editorRef.current.dataset.init = "1";
      if (onReady) onReady(editorRef.current);
    }
  }, []);

  const updateActive = () => {
    try {
      setActive({
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        underline: document.queryCommandState("underline"),
        strike: document.queryCommandState("strikeThrough"),
        ul: document.queryCommandState("insertUnorderedList"),
        ol: document.queryCommandState("insertOrderedList"),
      });
    } catch (e) {}
  };

  const fireChange = () => {
    if (editorRef.current && onChange) {
      onChange(editorRef.current.innerHTML);
    }
    updateActive();
  };

  const exec = (cmd, value = null) => {
    editorRef.current?.focus();
    try { document.execCommand(cmd, false, value); } catch (e) {}
    fireChange();
  };

  const insertHeading = (tag) => exec("formatBlock", `<${tag}>`);

  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedSelection.current = sel.getRangeAt(0).cloneRange();
    }
  };
  const restoreSelection = () => {
    if (savedSelection.current) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedSelection.current);
    }
  };

  const openLink = () => {
    saveSelection();
    setLinkUrl("");
    setLinkOpen(true);
  };
  const insertLink = () => {
    if (!linkUrl) { setLinkOpen(false); return; }
    restoreSelection();
    const safe = /^(https?:|mailto:|tel:|\/|#)/i.test(linkUrl) ? linkUrl : `https://${linkUrl}`;
    exec("createLink", safe);
    // make the newly-created link open in a new tab
    requestAnimationFrame(() => {
      const a = editorRef.current?.querySelectorAll("a");
      a?.forEach(el => {
        if (!el.target) { el.target = "_blank"; el.rel = "noopener noreferrer"; }
      });
      fireChange();
    });
    setLinkOpen(false);
  };

  const handleKeyDown = (e) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && !e.shiftKey && e.key.toLowerCase() === "b") { e.preventDefault(); exec("bold"); }
    else if (mod && !e.shiftKey && e.key.toLowerCase() === "i") { e.preventDefault(); exec("italic"); }
    else if (mod && !e.shiftKey && e.key.toLowerCase() === "u") { e.preventDefault(); exec("underline"); }
    else if (mod && !e.shiftKey && e.key.toLowerCase() === "k") { e.preventDefault(); openLink(); }
    else if (mod && e.shiftKey && e.key === "7") { e.preventDefault(); exec("insertOrderedList"); }
    else if (mod && e.shiftKey && e.key === "8") { e.preventDefault(); exec("insertUnorderedList"); }
    else if (mod && e.altKey && e.key === "1") { e.preventDefault(); insertHeading("H3"); }
    else if (mod && e.altKey && e.key === "2") { e.preventDefault(); insertHeading("H4"); }
    else if (mod && e.altKey && e.key === "0") { e.preventDefault(); insertHeading("P"); }
    else if (e.key === "Tab") {
      // Tab/Shift+Tab indent/outdent — works inside lists like Word
      e.preventDefault();
      exec(e.shiftKey ? "outdent" : "indent");
    }
  };

  // Strip rich formatting on paste — keep only plain text.
  // (Users can format after pasting; this prevents copied background/font garbage.)
  const handlePaste = (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData("text/plain");
    document.execCommand("insertText", false, text);
    fireChange();
  };

  const btn = (label, opts) => (
    <button
      type="button"
      className={"rt-btn" + (opts.active ? " rt-active" : "")}
      title={opts.title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={opts.onClick}
      style={opts.style}
    >
      {label}
    </button>
  );

  return (
    <div className="rich-editor">
      <div className="rt-toolbar">
        {btn("H1", { title: "Section heading (Cmd+Alt+1)", onClick: () => insertHeading("H3"), style: { fontFamily: "var(--serif)" } })}
        {btn("H2", { title: "Sub-heading (Cmd+Alt+2)", onClick: () => insertHeading("H4"), style: { fontFamily: "var(--serif)" } })}
        {btn("¶", { title: "Paragraph (Cmd+Alt+0)", onClick: () => insertHeading("P") })}
        <span className="rt-sep" />
        {btn("B", { title: "Bold (Cmd+B)", active: active.bold, onClick: () => exec("bold"), style: { fontWeight: 700 } })}
        {btn("I", { title: "Italic (Cmd+I)", active: active.italic, onClick: () => exec("italic"), style: { fontStyle: "italic", fontFamily: "var(--serif)" } })}
        {btn("U", { title: "Underline (Cmd+U)", active: active.underline, onClick: () => exec("underline"), style: { textDecoration: "underline" } })}
        {btn("S", { title: "Strikethrough", active: active.strike, onClick: () => exec("strikeThrough"), style: { textDecoration: "line-through" } })}
        <span className="rt-sep" />
        {btn("•", { title: "Bullet list (Cmd+Shift+8)", active: active.ul, onClick: () => exec("insertUnorderedList"), style: { fontSize: 17 } })}
        {btn("1.", { title: "Numbered list (Cmd+Shift+7)", active: active.ol, onClick: () => exec("insertOrderedList"), style: { fontFamily: "var(--mono)", fontSize: 11 } })}
        {btn("⇤", { title: "Decrease indent (Shift+Tab)", onClick: () => exec("outdent") })}
        {btn("⇥", { title: "Increase indent (Tab)", onClick: () => exec("indent") })}
        <span className="rt-sep" />
        {btn("\u201C", { title: "Quote", onClick: () => exec("formatBlock", "<BLOCKQUOTE>"), style: { fontFamily: "var(--serif)", fontSize: 18 } })}
        {btn("↗", { title: "Link (Cmd+K)", onClick: openLink })}
        {btn("⨯", { title: "Clear formatting", onClick: () => exec("removeFormat") })}
      </div>

      <div
        ref={editorRef}
        className="rich-editor-content article-body"
        contentEditable="true"
        suppressContentEditableWarning
        onInput={fireChange}
        onKeyUp={updateActive}
        onMouseUp={updateActive}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        data-placeholder="Write your article…"
        spellCheck="true"
      />

      {linkOpen && (
        <div className="link-popover">
          <input
            autoFocus
            placeholder="https://example.com"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); insertLink(); } if (e.key === "Escape") setLinkOpen(false); }}
          />
          <button type="button" className="btn btn-primary" onClick={insertLink}>Insert</button>
          <button type="button" className="btn btn-ghost" onClick={() => setLinkOpen(false)}>Cancel</button>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { RichEditor, blocksToHTML, renderInline, escapeHtml });
