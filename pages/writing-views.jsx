// pages/writing-views.jsx - Reader and Composer for articles

function ArticleReader({ article, ownerMode, scheduled, onBack, onEdit, onDelete, onToggleFeatured }) {
  return (
    <div className="page-enter container article-reader">
      <span className="case-back mono" onClick={onBack}>← Back to Journal</span>

      <div className="article-head">
        <div className="article-meta mono">
          <span className="article-cat">{article.category}</span>
          <span className="article-dot">·</span>
          <span>{article.date}{article.time ? ` · ${article.time}` : ""}</span>
          <span className="article-dot">·</span>
          <span>{window.readTimeFromBlocks(article.blocks)}</span>
          {scheduled && <span className="article-feat mono" style={{ color: "#8a6500" }}>◴ SCHEDULED · PREVIEW ONLY</span>}
          {!scheduled && article.featured && <span className="article-feat mono">★ FEATURED</span>}
        </div>
        <h1 className="article-title">{article.title}</h1>
        {article.subtitle && <p className="article-sub serif">{article.subtitle}</p>}
      </div>

      <figure className="article-cover">
        <img src={article.cover} alt={article.title} />
      </figure>

      <article className="article-body">
        {(article.blocks || []).map((b, i) => {
          if (b.s === "h") return <h3 key={i} className="article-h">{b.t}</h3>;
          return <p key={i}>{b.t}</p>;
        })}
      </article>

      {ownerMode && (
        <div className="article-actions owner-actions">
          <button className="btn btn-ghost" onClick={onEdit}>Edit article</button>
          <button className="btn btn-ghost" onClick={onToggleFeatured}>
            {article.featured ? "★ Unfeature" : "☆ Feature"}
          </button>
          <button className="btn btn-ghost article-delete" onClick={onDelete}>Delete</button>
          <span className="mono owner-tag">OWNER MODE</span>
        </div>
      )}

      <div className="article-foot">
        <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>
          Written by
        </div>
        <div className="serif" style={{ fontSize: 24 }}>Sean Rovick P. Legaspi</div>
        <p style={{ marginTop: 8, color: "var(--muted)", fontSize: 14 }}>
          Operations & Administrative Specialist · Metro Manila, PH
        </p>
      </div>
    </div>
  );
}

function isoToHuman(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function humanToIso(human) {
  const d = new Date(human);
  if (isNaN(d)) return "";
  return d.toISOString().slice(0, 10);
}

function nowTime() {
  const d = new Date();
  return d.toTimeString().slice(0, 5); // HH:MM
}

function ArticleComposer({ initial, onCancel, onSave }) {
  const initialIso = initial?.date ? humanToIso(initial.date) || window.todayIso() : window.todayIso();
  const initialTime = initial?.time || nowTime();

  const [draft, setDraft] = React.useState({
    id: initial?.id || "",
    isNew: !initial,
    cover: initial?.cover || "",
    title: initial?.title || "",
    subtitle: initial?.subtitle || "",
    category: initial?.category || "Operations",
    dateIso: initialIso,
    time: initialTime,
    featured: !!initial?.featured,
    blocks: initial?.blocks || [],
  });

  // Custom category state
  const [addingCategory, setAddingCategory] = React.useState(false);
  const [newCategory, setNewCategory] = React.useState("");

  // Live list of categories: defaults + any custom ones already present in stored articles
  const allCategories = React.useMemo(() => {
    const defaults = window.CATEGORIES.filter(c => c !== "All");
    const fromArticles = window.loadArticles().map(a => a.category).filter(Boolean);
    return Array.from(new Set([...defaults, ...fromArticles]));
  }, [draft.category]);

  const blocksToText = (blocks) => (blocks || []).map(b => b.s === "h" ? "§ " + b.t : b.t).join("\n\n");
  const textToBlocks = (text) => text.split(/\n\n+/).map(seg => {
    const t = seg.trim();
    if (!t) return null;
    if (t.startsWith("§")) return { s: "h", t: t.replace(/^§\s*/, "") };
    return { s: "p", t };
  }).filter(Boolean);

  const [bodyText, setBodyText] = React.useState(blocksToText(draft.blocks));
  const onField = (k) => (e) => setDraft({ ...draft, [k]: e.target.value });

  const wordCount = (bodyText || "").split(/\s+/).filter(Boolean).length;
  const readTime = Math.max(1, Math.round(wordCount / 220)) + " min";

  // Combine date + time
  const publishDateTime = new Date(`${draft.dateIso}T${draft.time || "00:00"}:00`);
  const isScheduled = publishDateTime instanceof Date && !isNaN(publishDateTime) && publishDateTime.getTime() > Date.now() + 60 * 1000;

  // Handle cover image upload
  const onCoverUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please choose an image file.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      alert("Image is over 4 MB. For best performance, use one under 1 MB. (Continuing anyway…)");
    }
    const reader = new FileReader();
    reader.onload = () => setDraft(d => ({ ...d, cover: reader.result }));
    reader.readAsDataURL(file);
  };

  const removeCover = () => setDraft({ ...draft, cover: "" });

  const onCategoryChange = (e) => {
    const v = e.target.value;
    if (v === "__add_new__") {
      setAddingCategory(true);
      setNewCategory("");
    } else {
      setDraft({ ...draft, category: v });
    }
  };

  const confirmNewCategory = () => {
    const trimmed = (newCategory || "").trim();
    if (!trimmed) { setAddingCategory(false); return; }
    setDraft({ ...draft, category: trimmed });
    setAddingCategory(false);
  };

  const save = (overrides = {}) => {
    const date = isoToHuman(draft.dateIso) || window.todayLabel();
    onSave({ ...draft, ...overrides, date, blocks: textToBlocks(bodyText) });
  };

  const publishNow = () => {
    const today = window.todayIso();
    const time = nowTime();
    setDraft({ ...draft, dateIso: today, time });
    setTimeout(() => save({ dateIso: today, time, date: isoToHuman(today) }), 50);
  };

  // Format the scheduled-for label
  const schedLabel = publishDateTime.toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });

  return (
    <div className="page-enter container composer">
      <span className="case-back mono" onClick={onCancel}>← {draft.isNew ? "Cancel" : "Cancel edit"}</span>

      <div className="composer-head">
        <div className="eyebrow mono">
          {draft.isNew ? "NEW ARTICLE" : "EDITING ARTICLE"}
          {isScheduled && <span style={{ color: "#8a6500", marginLeft: 8 }}>· SCHEDULED FOR {schedLabel.toUpperCase()}</span>}
        </div>
        <h1 className="composer-h">{draft.isNew ? "New post." : "Edit."}</h1>
      </div>

      <div className="composer-grid">
        <div className="composer-main">
          <input
            className="composer-title"
            placeholder="Article title…"
            value={draft.title}
            onChange={onField("title")}
          />
          <input
            className="composer-subtitle"
            placeholder="One-line subtitle / hook…"
            value={draft.subtitle}
            onChange={onField("subtitle")}
          />
          <textarea
            className="composer-body"
            placeholder={`Write your article…\n\nTips:\n• Lines starting with § become section headings.\n• Blank lines separate paragraphs.`}
            rows={22}
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
          />
        </div>

        <aside className="composer-side">
          {/* COVER UPLOADER */}
          <div className="composer-side-card">
            <h4 className="mono">COVER IMAGE</h4>
            {draft.cover ? (
              <div className="cover-preview">
                <img src={draft.cover} alt="Cover preview" />
                <div className="cover-preview-actions">
                  <label className="btn btn-ghost cover-replace-btn">
                    Replace
                    <input type="file" accept="image/*" onChange={onCoverUpload} hidden />
                  </label>
                  <button type="button" className="btn btn-ghost cover-remove-btn" onClick={removeCover}>Remove</button>
                </div>
              </div>
            ) : (
              <label className="cover-dropzone">
                <input type="file" accept="image/*" onChange={onCoverUpload} hidden />
                <div className="cover-dropzone-icon">⬆</div>
                <div className="cover-dropzone-text">Click to upload</div>
                <div className="cover-dropzone-sub mono">JPG, PNG or WebP · up to 4 MB</div>
              </label>
            )}
          </div>

          {/* SCHEDULE */}
          <div className="composer-side-card">
            <h4 className="mono">PUBLISH</h4>
            <div className="form-row">
              <label>Date</label>
              <input type="date" value={draft.dateIso} onChange={onField("dateIso")} />
            </div>
            <div className="form-row">
              <label>Time (24-hour)</label>
              <input type="time" value={draft.time} onChange={onField("time")} />
            </div>
            <span className="mono" style={{ fontSize: 10, color: isScheduled ? "#8a6500" : "var(--accent)", marginTop: 4 }}>
              {isScheduled
                ? `◴ Scheduled · goes live ${schedLabel}`
                : `✓ Will publish immediately on save`}
            </span>
          </div>

          {/* META */}
          <div className="composer-side-card">
            <h4 className="mono">META</h4>
            <div className="form-row">
              <label>Category</label>
              {addingCategory ? (
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    autoFocus
                    placeholder="e.g. Tech, Travel, Career"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirmNewCategory(); } if (e.key === "Escape") setAddingCategory(false); }}
                    style={{ flex: 1 }}
                  />
                  <button type="button" className="btn btn-primary" style={{ padding: "8px 12px", fontSize: 11 }} onClick={confirmNewCategory}>Add</button>
                </div>
              ) : (
                <select value={draft.category} onChange={onCategoryChange}>
                  {allCategories.map(c => <option key={c}>{c}</option>)}
                  <option value="__add_new__">+ Add new category…</option>
                </select>
              )}
            </div>
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: "var(--ink-2)" }}>
              <input type="checkbox" checked={draft.featured} onChange={(e) => setDraft({ ...draft, featured: e.target.checked })} />
              Featured (show on top of journal)
            </label>
            <div className="composer-stats mono">
              <div><span>Words</span><b>{wordCount}</b></div>
              <div><span>Read</span><b>{readTime}</b></div>
            </div>
          </div>

          <button
            className="btn btn-primary"
            style={{ width: "100%", justifyContent: "center" }}
            onClick={() => save()}
          >
            {isScheduled ? "Schedule" : (draft.isNew ? "Publish now" : "Save changes")} <span className="arrow">→</span>
          </button>

          {isScheduled && (
            <button
              className="btn btn-ghost"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={publishNow}
            >
              or publish now
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}

Object.assign(window, { ArticleReader, ArticleComposer, isoToHuman, humanToIso, nowTime });
