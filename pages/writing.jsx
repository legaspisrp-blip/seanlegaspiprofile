// pages/writing.jsx - articles with scheduling + owner-gated editing + date filter

const ARTICLES_OVERRIDE_KEY = "sean_articles_overrides_v1";

function parseDate(s) {
  if (!s) return null;
  const d = new Date(s);
  if (!isNaN(d)) return d;
  return null;
}

function loadArticles() {
  const seed = window.SEED_ARTICLES || [];
  let overrides = { edits: {}, deleted: [], added: [] };
  try {
    const raw = localStorage.getItem(ARTICLES_OVERRIDE_KEY);
    if (raw) overrides = { ...overrides, ...JSON.parse(raw) };
  } catch (e) {}
  const merged = seed
    .filter(a => !overrides.deleted.includes(a.id))
    .map(a => ({ ...a, ...(overrides.edits[a.id] || {}) }));
  return [...overrides.added, ...merged];
}

function saveOverrides(overrides) {
  try { localStorage.setItem(ARTICLES_OVERRIDE_KEY, JSON.stringify(overrides)); } catch (e) {}
}

function getOverrides() {
  try {
    const raw = localStorage.getItem(ARTICLES_OVERRIDE_KEY);
    if (raw) return { edits: {}, deleted: [], added: [], ...JSON.parse(raw) };
  } catch (e) {}
  return { edits: {}, deleted: [], added: [] };
}

function todayLabel() {
  return new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function todayIso() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find(p => p.type === "year").value;
  const m = parts.find(p => p.type === "month").value;
  const d = parts.find(p => p.type === "day").value;
  return `${y}-${m}-${d}`;
}

// Build the Manila-anchored publish instant from an article record
function manilaInstant(a) {
  if (!a.date) return null;
  const d = parseDate(a.date);
  if (!d) return null;
  let hh = 0, mm = 0;
  if (a.time) {
    const parts = a.time.split(":").map(Number);
    if (!isNaN(parts[0])) { hh = parts[0]; mm = parts[1] || 0; }
  }
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hStr = String(hh).padStart(2, "0");
  const mStr = String(mm).padStart(2, "0");
  return new Date(`${y}-${mo}-${day}T${hStr}:${mStr}:00+08:00`).getTime();
}

function isScheduled(a) {
  const t = manilaInstant(a);
  if (t === null || isNaN(t)) return false;
  return t > Date.now();
}

function relativeFromNow(targetMs) {
  const diff = targetMs - Date.now();
  if (diff <= 0) return "now";
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `in ${mins} min`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `in ${hrs} hour${hrs === 1 ? "" : "s"}`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `in ${days} day${days === 1 ? "" : "s"}`;
  const months = Math.round(days / 30);
  return `in ${months} month${months === 1 ? "" : "s"}`;
}

function readTimeFromBlocks(blocks) {
  const words = (blocks || []).map(b => (b.t || "").split(/\s+/).filter(Boolean).length).reduce((a,b)=>a+b, 0);
  return Math.max(1, Math.round(words / 220)) + " min read";
}

const CATEGORIES = ["All", "Operations", "Marketing", "Productivity", "Personal Brand", "Strategy", "Sales", "Notes"];

function WritingPage({ setRoute, ownerMode, onLogout, onLogin }) {
  const [articles, setArticles] = React.useState(loadArticles);
  const [view, setView] = React.useState({ mode: "list" });
  const [category, setCategory] = React.useState("All");
  const [showScheduled, setShowScheduled] = React.useState(false);
  // Date filter: "all" | yyyy or yyyy-mm
  const [dateFilter, setDateFilter] = React.useState("all");
  // Re-render every 60s so scheduled articles auto-flip to published when their time arrives
  const [, forceTick] = React.useState(0);
  React.useEffect(() => {
    const i = setInterval(() => forceTick(n => n + 1), 60000);
    return () => clearInterval(i);
  }, []);

  // Sort all articles by Manila publish instant (or parsed date), newest first.
  // We compute this once at the top so all hooks run consistently regardless of view.
  const sortedArticles = React.useMemo(() => {
    return [...articles].sort((a, b) => {
      const ta = manilaInstant(a) ?? (parseDate(a.date)?.getTime() ?? 0);
      const tb = manilaInstant(b) ?? (parseDate(b.date)?.getTime() ?? 0);
      return tb - ta;
    });
  }, [articles]);

  // Build year + year-month options once (must be unconditional to satisfy hook rules)
  const dateOptions = React.useMemo(() => {
    const years = new Set();
    const yearMonths = new Set();
    sortedArticles.forEach(a => {
      const d = parseDate(a.date);
      if (!d) return;
      years.add(d.getFullYear());
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      yearMonths.add(`${y}-${m}`);
    });
    const sortedYears = [...years].sort((a, b) => b - a);
    const sortedYearMonths = [...yearMonths].sort().reverse();
    const monthName = (ym) => {
      const [y, m] = ym.split("-").map(Number);
      return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    };
    return { years: sortedYears, monthsByYear: sortedYearMonths.map(ym => ({ ym, label: monthName(ym) })) };
  }, [sortedArticles]);

  const onSave = (draft) => {
    const overrides = getOverrides();
    if (draft.isNew) {
      const id = "user-" + Date.now();
      const newArt = {
        id,
        cover: draft.cover || (window.SEED_ARTICLES[0]?.cover || ""),
        title: draft.title || "Untitled",
        date: draft.date || todayLabel(),
        time: draft.time || "",
        subtitle: draft.subtitle || "",
        category: draft.category || "Notes",
        featured: !!draft.featured,
        body: draft.body || "",
        blocks: draft.blocks || [],
        userAdded: true,
      };
      overrides.added = [newArt, ...overrides.added];
      saveOverrides(overrides);
      setArticles(loadArticles());
      if (isScheduled(newArt)) {
        setShowScheduled(true);
        setDateFilter("all");
        setCategory("All");
        setView({ mode: "list" });
        setTimeout(() => alert(`Article scheduled.\n\nIt will publish on ${newArt.date}${newArt.time ? " at " + newArt.time : ""} (Manila time).\n\nUntil then, only you (owner) can see it.`), 50);
      } else {
        setView({ mode: "read", id });
      }
    } else {
      const isUser = articles.find(a => a.id === draft.id)?.userAdded;
      const patch = {
        title: draft.title, subtitle: draft.subtitle, category: draft.category,
        date: draft.date, time: draft.time, featured: draft.featured,
        body: draft.body, blocks: draft.blocks, cover: draft.cover,
      };
      if (isUser) {
        overrides.added = overrides.added.map(a => a.id === draft.id ? { ...a, ...patch } : a);
      } else {
        overrides.edits[draft.id] = patch;
      }
      saveOverrides(overrides);
      setArticles(loadArticles());
      const updated = { ...articles.find(a => a.id === draft.id), ...patch };
      if (isScheduled(updated)) {
        setShowScheduled(true);
        setDateFilter("all");
        setCategory("All");
        setView({ mode: "list" });
        setTimeout(() => alert(`Changes saved · article is scheduled.\n\nIt will publish on ${updated.date}${updated.time ? " at " + updated.time : ""} (Manila time).`), 50);
      } else {
        setView({ mode: "read", id: draft.id });
      }
    }
  };

  const onDelete = (id) => {
    if (!confirm("Delete this article?")) return;
    const overrides = getOverrides();
    if (overrides.added.find(a => a.id === id)) {
      overrides.added = overrides.added.filter(a => a.id !== id);
    } else {
      overrides.deleted = [...new Set([...overrides.deleted, id])];
      delete overrides.edits[id];
    }
    saveOverrides(overrides);
    setArticles(loadArticles());
    setView({ mode: "list" });
  };

  const onResetAll = () => {
    if (!confirm("Reset all article edits, deletions, and additions to defaults?")) return;
    localStorage.removeItem(ARTICLES_OVERRIDE_KEY);
    setArticles(loadArticles());
  };

  const onToggleFeatured = (id) => {
    const a = articles.find(x => x.id === id);
    if (!a) return;
    onSave({ ...a, featured: !a.featured });
  };

  if (view.mode === "compose" || view.mode === "edit") {
    if (!ownerMode) return null; // safety
    const editing = view.mode === "edit" ? sortedArticles.find(a => a.id === view.id) : null;
    return <ArticleComposer initial={editing} onCancel={() => setView(editing ? { mode: "read", id: editing.id } : { mode: "list" })} onSave={onSave} />;
  }
  if (view.mode === "read") {
    const a = sortedArticles.find(x => x.id === view.id);
    if (!a) return null;
    if (!ownerMode && isScheduled(a)) {
      return (
        <div className="page-enter container" style={{ padding: "80px 0", textAlign: "center" }}>
          <div className="eyebrow mono" style={{ justifyContent: "center", display: "flex", marginBottom: 18 }}>ARTICLE NOT YET PUBLISHED</div>
          <h1 className="serif" style={{ fontSize: 36 }}>Coming soon.</h1>
          <p style={{ color: "var(--muted)", marginTop: 12 }}>This article goes live on {a.date}.</p>
          <button className="btn btn-ghost" style={{ marginTop: 24 }} onClick={() => setView({ mode: "list" })}>← Back to Journal</button>
        </div>
      );
    }
    const baseVisible = ownerMode ? sortedArticles : sortedArticles.filter(x => !isScheduled(x));
    const filteredVisible = category === "All" ? baseVisible : baseVisible.filter(x => x.category === category);
    const navList = filteredVisible.length > 1 ? filteredVisible : baseVisible;
    const aIdx = navList.findIndex(x => x.id === a.id);
    const prev = aIdx > 0 ? navList[aIdx - 1] : navList[navList.length - 1];
    const next = aIdx >= 0 && aIdx < navList.length - 1 ? navList[aIdx + 1] : navList[0];
    return <ArticleReader article={a}
      ownerMode={ownerMode}
      scheduled={isScheduled(a)}
      manilaPublishMs={manilaInstant(a)}
      prev={prev}
      next={next}
      onPrev={() => setView({ mode: "read", id: prev.id })}
      onNext={() => setView({ mode: "read", id: next.id })}
      onBack={() => setView({ mode: "list" })}
      onEdit={() => setView({ mode: "edit", id: a.id })}
      onDelete={() => onDelete(a.id)}
      onToggleFeatured={() => onToggleFeatured(a.id)} />;
  }

  // List view
  const visible = ownerMode
    ? (showScheduled ? sortedArticles.filter(isScheduled) : sortedArticles)
    : sortedArticles.filter(a => !isScheduled(a));

  // Date filter
  const dateFiltered = visible.filter(a => {
    if (dateFilter === "all") return true;
    const d = parseDate(a.date);
    if (!d) return false;
    if (dateFilter.includes("-")) {
      const [fy, fm] = dateFilter.split("-").map(Number);
      return d.getFullYear() === fy && d.getMonth() + 1 === fm;
    }
    return d.getFullYear() === Number(dateFilter);
  });

  const filtered = dateFiltered.filter(a => category === "All" || a.category === category);
  const featured = visible.filter(a => a.featured);

  const scheduledCount = sortedArticles.filter(isScheduled).length;

  return (
    <div className="page-enter">
      <section className="section">
        <div className="container">
          <SectionHead
            eyebrow={`§ JOURNAL · ${visible.length} ARTICLES${ownerMode ? ` · ${scheduledCount} SCHEDULED` : ""}`}
            title="What I've been <em>thinking about</em>."
            desc="Practical operations and administrative notes: SOPs, inbox routines, documentation systems, and the back-office work that keeps teams running. Click an article to read."
          />

          {ownerMode && (
            <div className="journal-bar owner-bar">
              <button className="btn btn-primary" onClick={() => setView({ mode: "compose" })}>
                + Write a new article
              </button>
              <button
                className={"btn btn-ghost" + (showScheduled ? " active-tone" : "")}
                onClick={() => setShowScheduled(!showScheduled)}
                title="Show only articles scheduled for the future"
              >
                {showScheduled ? "Showing scheduled only" : `Scheduled (${scheduledCount})`}
              </button>
              <button className="btn btn-ghost" onClick={onResetAll}>Reset to defaults</button>
              <span className="mono owner-tag">OWNER · </span>
              <button className="mono owner-tag-link" onClick={onLogout}>LOG OUT</button>
            </div>
          )}

          {!ownerMode && featured.length > 0 && category === "All" && dateFilter === "all" && (
            <div className="featured-block">
              <div className="featured-head">
                <h3 className="featured-h serif">Featured</h3>
                <span className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  {featured.length} hand-picked
                </span>
              </div>
              <div className="featured-grid">
                {featured.slice(0, 3).map((a, i) => (
                  <article key={a.id} className={"feat-article " + (i === 0 ? "feat-hero" : "")} onClick={() => setView({ mode: "read", id: a.id })}>
                    <div className="feat-cover" style={{ backgroundImage: `url(${a.cover})` }}>
                      <span className="feat-cat mono">{a.category}</span>
                    </div>
                    <div className="feat-body">
                      <div className="feat-date mono">{a.date}</div>
                      <h4 className="feat-title">{a.title}</h4>
                      <p className="feat-sub">{a.subtitle}</p>
                      <span className="feat-read mono">Read article →</span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          {/* Filter bar */}
          <div className="cat-bar">
            <div className="cat-pills">
              {CATEGORIES.map(c => {
                const count = c === "All" ? dateFiltered.length : dateFiltered.filter(a => a.category === c).length;
                if (c !== "All" && count === 0) return null;
                return (
                  <button
                    key={c}
                    className={"cat-pill" + (category === c ? " active" : "")}
                    onClick={() => setCategory(c)}
                  >
                    {c} <span className="mono">{String(count).padStart(2, "0")}</span>
                  </button>
                );
              })}
            </div>
            <div className="date-filter">
              <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
                <option value="all">All dates</option>
                <optgroup label="By year">
                  {dateOptions.years.map(y => <option key={y} value={String(y)}>{y}</option>)}
                </optgroup>
                <optgroup label="By month">
                  {dateOptions.monthsByYear.map(({ ym, label }) => <option key={ym} value={ym}>{label}</option>)}
                </optgroup>
              </select>
              {dateFilter !== "all" && (
                <button className="date-clear mono" onClick={() => setDateFilter("all")}>CLEAR ✕</button>
              )}
            </div>
          </div>

          <div className="articles-grid">
            {filtered.map(a => {
              const sched = isScheduled(a);
              const liveIn = sched ? relativeFromNow(manilaInstant(a)) : null;
              return (
                <article key={a.id} className={"art-card" + (sched ? " art-scheduled" : "")} onClick={() => setView({ mode: "read", id: a.id })}>
                  <div className="art-cover" style={{ backgroundImage: `url(${a.cover})` }}>
                    {sched && <span className="art-flag art-flag-sched mono">◴ SCHEDULED · {liveIn.toUpperCase()}</span>}
                    {!sched && a.featured && <span className="art-flag mono">★ Featured</span>}
                  </div>
                  <div className="art-body">
                    <div className="art-meta mono">
                      <span>{a.category}</span>
                      <span>{a.date}{a.time ? ` · ${a.time}` : ""}</span>
                    </div>
                    <h4 className="art-title">{a.title}</h4>
                    <p className="art-sub">{a.subtitle}</p>
                  </div>
                </article>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div className="empty-state mono">
              No articles match this filter.
              {(category !== "All" || dateFilter !== "all") && (
                <>
                  {" "}
                  <button className="date-clear mono" onClick={() => { setCategory("All"); setDateFilter("all"); }}>RESET FILTERS</button>
                </>
              )}
            </div>
          )}

          <div className="journal-card">
            <div>
              <div className="mono" style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>Find me on</div>
              <div className="serif" style={{ fontSize: 22 }}>{window.PROFILE.linkedin}</div>
            </div>
            <button className="btn btn-ghost" onClick={() => window.open(window.PROFILE.linkedinUrl, "_blank")}>
              Visit LinkedIn <span className="arrow">↗</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

Object.assign(window, { WritingPage, loadArticles, getOverrides, saveOverrides, todayLabel, todayIso, readTimeFromBlocks, CATEGORIES, isScheduled, parseDate, manilaInstant, relativeFromNow });
