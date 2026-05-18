// site-settings.jsx — owner-only settings panel (live on site, gated by auth)

const SITE_SETTINGS_KEY = "sean_site_settings_v1";

function loadSiteSettings(defaults) {
  try {
    const raw = localStorage.getItem(SITE_SETTINGS_KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch (e) {}
  return defaults;
}
function saveSiteSettings(settings) {
  try { localStorage.setItem(SITE_SETTINGS_KEY, JSON.stringify(settings)); } catch (e) {}
}

function useSiteSettings(defaults) {
  const [settings, setSettings] = React.useState(() => loadSiteSettings(defaults));
  const set = (key, value) => {
    setSettings(prev => {
      const next = typeof key === "object" ? { ...prev, ...key } : { ...prev, [key]: value };
      saveSiteSettings(next);
      return next;
    });
  };
  return [settings, set];
}

function SiteSettingsPanel({ settings, set, palettes, fontModes, onReset }) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      {/* Floating cog button (only visible when authed via auth gating in parent) */}
      <button
        className={"site-settings-fab" + (open ? " open" : "")}
        onClick={() => setOpen(!open)}
        aria-label="Site settings"
        title="Site settings (owner)"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {/* Panel */}
      <div className={"site-settings-panel" + (open ? " open" : "")}>
        <div className="ssp-head">
          <div>
            <div className="ssp-eyebrow mono">SITE SETTINGS · OWNER</div>
            <h3 className="serif">Make it yours.</h3>
          </div>
          <button className="ssp-close" onClick={() => setOpen(false)} aria-label="Close">✕</button>
        </div>

        <p className="ssp-hint">
          Tweaks apply only on this device. Visitors see the default site.
        </p>

        <div className="ssp-section">
          <h4 className="mono">PALETTE</h4>
          <div className="ssp-swatches">
            {palettes.map((p, i) => {
              const isActive = JSON.stringify(p) === JSON.stringify(settings.palette);
              return (
                <button
                  key={i}
                  className={"ssp-swatch" + (isActive ? " active" : "")}
                  onClick={() => set("palette", p)}
                  title={`Accent ${p[0]}`}
                >
                  <span style={{ background: p[0], width: "60%" }} />
                  <span style={{ background: p[1], width: "20%" }} />
                  <span style={{ background: p[2], width: "20%" }} />
                </button>
              );
            })}
          </div>
        </div>

        <div className="ssp-section">
          <h4 className="mono">APPEARANCE</h4>
          <div className="ssp-row">
            <span>Dark mode</span>
            <button
              className={"ssp-toggle" + (settings.dark ? " on" : "")}
              onClick={() => set("dark", !settings.dark)}
              aria-pressed={!!settings.dark}
            >
              <span className="ssp-knob" />
            </button>
          </div>
        </div>

        <div className="ssp-section">
          <h4 className="mono">TYPOGRAPHY</h4>
          <div className="ssp-seg">
            {Object.entries(fontModes).map(([key, mode]) => (
              <button
                key={key}
                className={"ssp-seg-btn" + (settings.fontMode === key ? " active" : "")}
                onClick={() => set("fontMode", key)}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        <div className="ssp-section">
          <h4 className="mono">DENSITY</h4>
          <div className="ssp-seg">
            {["compact", "regular", "comfy"].map(d => (
              <button
                key={d}
                className={"ssp-seg-btn" + (settings.density === d ? " active" : "")}
                onClick={() => set("density", d)}
              >
                {d[0].toUpperCase() + d.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <button className="ssp-reset mono" onClick={onReset}>RESET TO DEFAULTS</button>
      </div>
    </>
  );
}

Object.assign(window, { SiteSettingsPanel, useSiteSettings, SITE_SETTINGS_KEY });
