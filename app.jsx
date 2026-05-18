// app.jsx — root + router

const DEFAULT_SETTINGS = {
  palette: ["#c2502a", "#1a1815", "#ebe7df"],
  density: "regular",
  dark: false,
  fontMode: "editorial",
};

const FONT_MODES = {
  editorial: {
    serif: '"Newsreader", "Cormorant Garamond", Georgia, serif',
    sans: '"Geist", ui-sans-serif, system-ui, sans-serif',
    label: "Editorial",
  },
  technical: {
    serif: '"Instrument Serif", Georgia, serif',
    sans: '"Geist Mono", "JetBrains Mono", monospace',
    label: "Technical",
  },
  classic: {
    serif: '"Cormorant Garamond", Georgia, serif',
    sans: '"Inter Tight", "Helvetica Neue", system-ui, sans-serif',
    label: "Classic",
  },
};

const PALETTES = [
  ["#c2502a", "#1a1815", "#ebe7df"], // terracotta (default)
  ["#3a5a40", "#1a1815", "#ebe7df"], // forest
  ["#2b4eff", "#0d1117", "#eef0f4"], // electric blue
  ["#d4b04a", "#1a1815", "#ebe7df"], // brass
  ["#b04a52", "#1f1a1a", "#f0e9e1"], // claret
];

function App() {
  const [settings, setSetting] = useSiteSettings(DEFAULT_SETTINGS);
  const [route, setRoute] = React.useState({ name: "home" });
  const auth = useAuth();

  React.useEffect(() => {
    const root = document.documentElement;
    const [accent] = settings.palette || PALETTES[0];
    root.style.setProperty("--accent", accent);
    root.dataset.theme = settings.dark ? "dark" : "light";
    root.dataset.density = settings.density;
    const fm = FONT_MODES[settings.fontMode] || FONT_MODES.editorial;
    root.style.setProperty("--serif", fm.serif);
    root.style.setProperty("--sans", fm.sans);
  }, [settings]);

  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [route]);

  const setDark = (v) => setSetting("dark", v);

  const resetSettings = () => {
    if (!confirm("Reset all site settings to defaults?")) return;
    setSetting(DEFAULT_SETTINGS);
  };

  return (
    <>
      <Nav route={route} setRoute={setRoute} dark={!!settings.dark} setDark={setDark} />
      <main>
        {route.name === "home" && <HomePage setRoute={setRoute} tweaks={settings} />}
        {route.name === "work" && <WorkPage setRoute={setRoute} />}
        {route.name === "case" && <CasePage id={route.id} setRoute={setRoute} />}
        {route.name === "about" && <AboutPage setRoute={setRoute} />}
        {route.name === "writing" && (
          <WritingPage
            setRoute={setRoute}
            ownerMode={auth.authed}
            onLogout={auth.logout}
            onLogin={() => auth.setOpen(true)}
          />
        )}
        {route.name === "contact" && <ContactPage setRoute={setRoute} />}
      </main>
      <Footer setRoute={setRoute} onLoginClick={() => auth.setOpen(true)} authed={auth.authed} />

      <LoginModal open={auth.open} onClose={() => auth.setOpen(false)} onLogin={auth.login} />

      {/* Owner-only floating settings panel */}
      {auth.authed && (
        <SiteSettingsPanel
          settings={settings}
          set={setSetting}
          palettes={PALETTES}
          fontModes={FONT_MODES}
          onReset={resetSettings}
        />
      )}
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
