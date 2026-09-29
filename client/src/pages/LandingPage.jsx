import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Brand from "../components/ui/Brand.jsx";
import Icon from "../components/ui/Icon.jsx";
import { Avatar, RatingLine, VerifiedBadge } from "../components/ui/index.jsx";
import { LanguageToggle } from "../components/layout/LanguageSwitcher.jsx";
import useAuth from "../hooks/useAuth.js";
import useAsync from "../hooks/useAsync.js";
import useClickOutside from "../hooks/useClickOutside.js";
import { useReducedMotion } from "../hooks/useReducedMotion.js";
import { listingsApi } from "../api/endpoints.js";
import { formatPrice, mediumLabel } from "../lib/format.js";

const SCENE_MS = 7000;

// The hero's three rotating role-scenes, from "EduLink Landing v2" — each
// with its own headline, search placeholder, CTA and a couple of floating
// stat chips over a role photo (client/public/design/hero-*.png).
const HERO_SCENES = [
  {
    role: "Students", eyebrow: "FOR STUDENTS", pre: "Learn from teachers you can", word: "trust",
    sub: "Verified teachers across Sri Lanka for O/L, A/L, languages and more, searchable by subject and distance.",
    img: "/design/hero-student.png", alt: "Smiling student holding exercise books",
    blobBg: "var(--lavender)", blobRadius: "58% 42% 52% 48% / 46% 54% 46% 54%", ctaLabel: "Find a teacher", ctaTo: "/browse",
    placeholder: "What do you want to learn? e.g. A/L Physics",
    chips: [
      { g: "✓", t: "Fully verified", s: "ID + police clearance", top: "4%", left: "0%", bg: "var(--primary)", fg: "#fff", anim: "floatA 6s ease-in-out infinite" },
      { g: "★", t: "4.9 · 126 reviews", s: "A/L Physics, Kandy", top: "46%", left: "54%", bg: "var(--mist)", fg: "var(--primary)", anim: "floatB 7s ease-in-out infinite" },
      { g: "⌖", t: "2.1 km away", s: "Sinhala medium", top: "78%", left: "-2%", bg: "var(--blue)", fg: "#fff", anim: "floatA 8s ease-in-out infinite" },
    ],
  },
  {
    role: "Parents", eyebrow: "FOR PARENTS", pre: "Find classes your child will", word: "love",
    sub: "Link your child to your account, choose only fully verified teachers, and see every message and booking.",
    img: "/design/hero-parent.png", alt: "Mother standing with her son",
    blobBg: "var(--blue)", blobRadius: "46% 54% 40% 60% / 58% 42% 58% 42%", ctaLabel: "Add your child", ctaTo: "/children",
    placeholder: "e.g. Grade 5 scholarship maths near Galle",
    chips: [
      { g: "♥", t: "You see every message", s: "Parent-managed account", top: "6%", left: "-2%", bg: "var(--primary)", fg: "#fff", anim: "floatB 6s ease-in-out infinite" },
      { g: "✓", t: "Deposit protected", s: "Refunded if cancelled", top: "66%", left: "56%", bg: "var(--mist)", fg: "var(--primary)", anim: "floatA 7s ease-in-out infinite" },
      { g: "5", t: "Grade 5 Scholarship", s: "32 verified teachers", top: "78%", left: "2%", bg: "var(--lavender)", fg: "var(--ink)", anim: "floatB 8s ease-in-out infinite" },
    ],
  },
  {
    role: "Teachers", eyebrow: "FOR TEACHERS", pre: "Teach on your own", word: "terms",
    sub: "Post subject ads, earn a verified badge and receive interest from matched students.",
    img: "/design/hero-teacher.png", alt: "Teacher holding a tablet",
    blobBg: "var(--primary)", blobRadius: "52% 48% 60% 40% / 42% 58% 42% 58%", ctaLabel: "Become a teacher", ctaTo: "/register?role=teacher",
    placeholder: "Search what other teachers offer",
    chips: [
      { g: "+12", t: "New interests", s: "This week", top: "6%", left: "0%", bg: "var(--mist)", fg: "var(--primary)", anim: "floatA 6s ease-in-out infinite" },
      { g: "◷", t: "Set your hours", s: "Weekday evenings", top: "40%", left: "56%", bg: "var(--blue)", fg: "#fff", anim: "floatB 7s ease-in-out infinite" },
      { g: "✓", t: "Verified badge", s: "Unlocks child accounts", top: "78%", left: "-2%", bg: "var(--ink)", fg: "#fff", anim: "floatA 8s ease-in-out infinite" },
    ],
  },
];

const STATS = [
  { v: "1,200+", l: "Verified teachers" },
  { v: "40", l: "Subjects taught" },
  { v: "25", l: "Districts covered" },
  { v: "3", l: "Languages: සි · த · EN" },
];

// The second, photo-backed trust section ("Why EduLink") — distinct from
// the assurance strip right under the hero, which stays icon-only.
const WHY_TRUST = [
  { title: "Verified teachers", sub: "Identity and clearance checked before the badge appears." },
  { title: "Honest reviews", sub: "Only students who completed classes can review." },
  { title: "Safe in-app chat", sub: "No phone numbers shared up front." },
  { title: "Parent-first", sub: "Parents manage child accounts and see every conversation." },
];

const CATEGORY_PHOTOS = [
  { name: "Mathematics", img: "cat-maths.png", levels: "Grade 6 to A/L Combined Maths", fee: "LKR 6,000" },
  { name: "Science", img: "cat-science.png", levels: "Physics · Chemistry · Biology", fee: "LKR 7,500" },
  { name: "English", img: "cat-english.png", levels: "Spoken English to IELTS", fee: "LKR 5,000" },
  { name: "ICT", img: "cat-ict.png", levels: "O/L, A/L and programming", fee: "LKR 5,500" },
  { name: "Music", img: "cat-music.png", levels: "Piano, guitar, Eastern music", fee: "LKR 6,500" },
  { name: "Languages", img: "cat-languages.png", levels: "Sinhala, Tamil, Japanese, French", fee: "LKR 4,500" },
];

const MENU_SUBJECTS = ["Mathematics", "Science", "English", "ICT", "Music", "Languages"];
const MENU_LEVELS = ["Primary (Grades 1–5)", "Grades 6–9", "O/L", "A/L", "Adult learners"];
const CHIPS = ["O/L Maths", "A/L Physics", "Spoken English", "Piano", "Cambridge IGCSE"];

const TRUST = [
  { g: "✓", title: "Verified teachers", sub: "Identity and qualifications checked before the badge appears." },
  { g: "★", title: "Honest reviews", sub: "Only students who completed classes can leave a review." },
  { g: "◎", title: "Safe in-app chat", sub: "Talk on EduLink first. No phone numbers shared up front." },
  { g: "♥", title: "Parent-first", sub: "Parents manage child accounts and see every conversation." },
];

const TABS = {
  Mathematics: "From Grade 6 foundations to A/L Combined Maths. Local, Cambridge and Edexcel syllabuses in all three mediums.",
  Science: "Physics, Chemistry and Biology for O/L and A/L, with practical-focused teachers across the island.",
  English: "Spoken English, literature, and exam prep from primary school through IELTS for adults.",
  ICT: "O/L and A/L ICT, programming basics and computer literacy for all ages.",
  Music: "Piano, guitar, violin and Eastern music, including Trinity and ABRSM grade exams.",
  Languages: "Sinhala, Tamil, Japanese, French and more — for school, work, or travel.",
};

const ROLES = {
  Students: [
    ["Create your account", "Sign up as a student. Verify your email and phone — it takes under two minutes."],
    ["Browse or search", "Filter by subject, grade, medium and distance, or just describe what you need."],
    ["Connect & learn", "Send an interest request. All communication stays on the platform — safe and traceable."],
  ],
  Parents: [
    ["Add your child", "Create a parent account and link your child. Your child never logs in on their own."],
    ["Choose a verified teacher", "Only fully verified teachers can accept requests for child accounts."],
    ["Stay in the loop", "Every message, booking and payment runs through your account."],
  ],
  Teachers: [
    ["Build your profile", "Subjects, grades, qualifications, and the areas you teach in."],
    ["Get verified", "ID and clearance checks earn a badge and unlock child-linked students."],
    ["Post ads & get leads", "Receive interest requests and student ads matched to what you teach."],
  ],
};

const STORIES = [
  { ph: "Grade 5 scholarship", name: "Senuri, 10", role: "Grade 5 scholarship", quote: "My maths teacher makes every class feel like a game." },
  { ph: "A/L Physical Science", name: "Tharushi W.", role: "A/L Physical Science", quote: "I found a Physics teacher ten minutes from home." },
  { ph: "IELTS preparation", name: "Mahesh, 34", role: "IELTS preparation", quote: "Evening classes that fit around my job. I got the band I needed." },
  { ph: "Parent of two", name: "Dilini R.", role: "Parent of two", quote: "I can see every message. That peace of mind matters." },
];

const FOOTER = [
  { h: "LEARN", links: [["Browse teachers", "/browse"], ["Subjects", "/browse"], ["For parents", "/register?role=parent"]] },
  { h: "TEACH", links: [["Become a teacher", "/register?role=teacher"], ["Verification", "/verification"], ["Post a class ad", "/listings/new"]] },
  { h: "EDULINK", links: [["Safety", "mailto:safety@edulink.lk"], ["Privacy", "mailto:hello@edulink.lk"], ["Contact", "mailto:hello@edulink.lk"]] },
];

const browseTo = (q) => `/browse?q=${encodeURIComponent(q)}`;

const LandingHeader = () => {
  const { status } = useAuth();
  const [menu, setMenu] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setMenu(false));
  const authed = status === "authenticated";
  return (
    <header className="sticky top-0 z-40 border-b border-line" style={{ background: "rgba(251,250,253,.92)", backdropFilter: "blur(10px)" }}>
      <div className="shell flex items-center gap-[clamp(16px,2.4vw,32px)] whitespace-nowrap" style={{ height: 80 }}>
        <Brand />
        <div className="relative hidden flex-none text-[15px] font-medium md:block" ref={ref}>
          <button
            type="button"
            onClick={() => setMenu((m) => !m)}
            aria-expanded={menu}
            className="flex items-center gap-1.5 rounded-md border-0 bg-transparent px-3 py-2 text-ink hover:bg-mist"
          >
            Explore <span className="text-[10px]">▾</span>
          </button>
          {menu && (
            <div className="popover absolute left-0 grid grid-cols-2 gap-6 p-6" style={{ top: 46, width: 520 }}>
              {[["SUBJECTS", MENU_SUBJECTS], ["BY LEVEL", MENU_LEVELS]].map(([h, items]) => (
                <div key={h} className="flex flex-col gap-1">
                  <span className="eyebrow-muted mb-1.5 text-[11px]">{h}</span>
                  {items.map((m) => (
                    <Link key={m} to={browseTo(m)} className="rounded-md px-2.5 py-[7px] text-[15px] text-ink hover:bg-mist hover:text-primary">
                      {m}
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
        <nav className="hidden gap-2 text-[15px] font-medium lg:flex">
          <Link to="/register?role=parent" className="rounded-lg px-3.5 py-[9px] text-ink hover:bg-mist hover:text-ink">For parents</Link>
          <Link to="/register?role=teacher" className="rounded-lg px-3.5 py-[9px] text-ink hover:bg-mist hover:text-ink">For teachers</Link>
        </nav>
        <div className="flex-1" />
        <span className="hidden sm:block">
          <LanguageToggle />
        </span>
        {authed ? (
          <Link to="/dashboard" className="btn btn-primary flex-none">Go to dashboard</Link>
        ) : (
          <>
            <Link to="/login" className="flex-none text-[15px] font-semibold text-ink hover:text-primary">Sign in</Link>
            <Link to="/register" className="btn btn-primary flex-none">Join for free</Link>
          </>
        )}
      </div>
    </header>
  );
};

const TeacherCard = ({ listing }) => {
  const owner = listing.owner || {};
  return (
    <Link to={`/listings/${listing._id}`} className="card card-hover flex flex-col overflow-hidden text-ink hover:text-ink">
      <div className="h-1 bg-blue" />
      <div className="flex flex-1 flex-col gap-3.5 p-[22px]">
        <div className="flex items-center gap-3">
          <Avatar name={owner.name} src={owner.photoUrl} size={56} />
          <div className="flex flex-col gap-[3px]">
            <span className="serif text-[19px] font-bold">{owner.name}</span>
            <VerifiedBadge tier={owner.verificationStatus} />
          </div>
        </div>
        <div className="text-[15px] font-semibold">{listing.subject} · {listing.grade}</div>
        <div className="flex flex-wrap gap-1.5">
          <span className="tag">{mediumLabel(listing.medium)} medium</span>
          {listing.curriculum && <span className="tag">{listing.curriculum === "local" ? "Local syllabus" : listing.curriculum}</span>}
        </div>
        <RatingLine avgRating={owner.avgRating} reviewCount={owner.reviewCount} />
        <div className="mt-auto flex items-center justify-between border-t border-mist pt-3.5">
          <span className="serif text-xl">{formatPrice(listing.price) || "Ask for fee"}</span>
          <span className="text-sm font-semibold text-primary">View →</span>
        </div>
      </div>
    </Link>
  );
};

// A design photo that quietly disappears (revealing its colored backdrop)
// instead of showing a broken-image icon if the asset isn't there yet.
const DesignPhoto = ({ src, alt, style, className }) => {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return <img src={src} alt={alt} style={style} className={className} onError={() => setFailed(true)} />;
};

const LandingPage = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("Mathematics");
  const [role, setRole] = useState("Students");
  const [scene, setScene] = useState(0);
  const [sceneElapsed, setSceneElapsed] = useState(0);
  const [scenePaused, setScenePaused] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [hoverCat, setHoverCat] = useState(0);
  const reducedMotion = useReducedMotion();

  // Rotate the hero's role-scene every 7s — paused on hover/focus, and
  // skipped entirely under prefers-reduced-motion (scene 0 just stays put).
  useEffect(() => {
    if (reducedMotion) return undefined;
    const iv = setInterval(() => {
      if (scenePaused || searchFocused || document.hidden) return;
      setSceneElapsed((e) => {
        if (e + 100 >= SCENE_MS) {
          setScene((s) => (s + 1) % HERO_SCENES.length);
          return 0;
        }
        return e + 100;
      });
    }, 100);
    return () => clearInterval(iv);
  }, [scenePaused, searchFocused, reducedMotion]);

  const goScene = (i) => { setScene(i); setSceneElapsed(0); };
  const scenePct = reducedMotion ? 0 : Math.min(100, (sceneElapsed / SCENE_MS) * 100);
  const currentScene = HERO_SCENES[scene];

  // Top-rated active teacher ads for the selected subject tab. "Science" and
  // "Languages" are umbrella tabs, so they fall back to the overall top rated.
  const tabSubject = ["Science", "Languages"].includes(tab) ? undefined : tab;
  const { data: top, loading } = useAsync(
    () => listingsApi.browse({ subject: tabSubject, sort: "rating", limit: 3 }),
    [tabSubject]
  );

  const submit = (e) => {
    e.preventDefault();
    navigate(query.trim() ? browseTo(query.trim()) : "/browse");
  };

  return (
    <div className="flex min-h-screen flex-col">
      <LandingHeader />

      {/* Hero — rotates through Students / Parents / Teachers scenes every 7s */}
      <section className="relative overflow-hidden" onMouseEnter={() => setScenePaused(true)} onMouseLeave={() => setScenePaused(false)}>
        <div className="pointer-events-none absolute rounded-full bg-mist" style={{ top: -160, right: -120, width: 620, height: 620, opacity: 0.55 }} />
        <div className="shell-narrow relative grid items-center gap-12 pb-8 pt-[72px]" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 460px), 1fr))" }}>
          <div className="flex min-w-0 flex-col gap-6">
            <div className="grid">
              {HERO_SCENES.map((sc, i) => {
                const on = i === scene;
                const past = i === (scene + HERO_SCENES.length - 1) % HERO_SCENES.length;
                return (
                  <div
                    key={sc.role}
                    aria-hidden={!on}
                    className="flex flex-col gap-[22px]"
                    style={{
                      gridArea: "1/1", alignSelf: "end", opacity: on ? 1 : 0,
                      transform: on ? "none" : past ? "translateY(-14px)" : "translateY(14px)",
                      transition: "opacity .8s ease, transform .8s ease", pointerEvents: on ? "auto" : "none",
                    }}
                  >
                    <span className="eyebrow flex items-center gap-2">
                      <span className="h-[1.5px] w-[22px] bg-primary" />
                      {sc.eyebrow}
                    </span>
                    <h1 style={{ font: "400 clamp(44px,5.4vw,70px)/1.08 var(--font-display)", letterSpacing: "-.02em", textWrap: "balance" }}>
                      {sc.pre}{" "}
                      <span className="relative inline-block whitespace-nowrap">
                        <em className="relative z-[1] text-primary">{sc.word}</em>
                        <svg viewBox="0 0 200 20" preserveAspectRatio="none" fill="none" className="pointer-events-none absolute" style={{ left: "-2%", right: "-2%", bottom: "-.12em", width: "104%", height: ".32em", overflow: "visible" }}>
                          <path d="M3 14C48 5 120 3 197 9" stroke="var(--blue)" strokeWidth="3" strokeLinecap="round" />
                          <path d="M30 17C80 11 140 10 186 13" stroke="var(--lavender)" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      </span>
                    </h1>
                    <p className="lede max-w-[520px]">{sc.sub}</p>
                  </div>
                );
              })}
            </div>

            <div className="flex max-w-[560px] flex-col gap-3">
              <form
                onSubmit={submit}
                role="search"
                className="flex items-center rounded-full border-[1.5px] bg-white py-1.5 pl-5 pr-1.5 transition-colors"
                style={{ borderColor: searchFocused ? "var(--primary)" : "var(--lavender)", boxShadow: "0 14px 34px -16px rgba(61,82,160,.45)" }}
              >
                <Icon name="search" size={20} strokeWidth={2} className="text-primary" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  placeholder={currentScene.placeholder}
                  aria-label="What do you want to learn?"
                  className="min-w-0 flex-1 border-0 bg-transparent p-3 text-base font-medium text-ink outline-none"
                />
                <button type="submit" className="btn btn-primary rounded-full px-6 py-[13px]">Search</button>
              </form>
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-0.5 text-[13px] text-ink-2">Popular:</span>
                {CHIPS.map((c) => (
                  <Link key={c} to={browseTo(c)} className="chip">{c}</Link>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-5">
              <Link to={currentScene.ctaTo} className="flex items-center gap-2.5 rounded-full px-[26px] py-3.5 text-[15px] font-semibold text-white hover:opacity-90" style={{ background: "var(--ink)" }}>
                {currentScene.ctaLabel} <span>→</span>
              </Link>
              <div className="flex items-end gap-[18px]">
                {HERO_SCENES.map((sc, i) => (
                  <button key={sc.role} type="button" onClick={() => goScene(i)} className="flex w-[72px] flex-col gap-[7px] border-0 bg-transparent p-0 text-left">
                    <span className="text-xs font-bold tracking-[.06em] transition-colors" style={{ color: i === scene ? "var(--ink)" : "var(--periwinkle)" }}>{sc.role}</span>
                    <span className="relative h-0.5 overflow-hidden rounded-sm bg-line">
                      <span className="absolute inset-y-0 left-0 bg-primary" style={{ width: i === scene ? `${scenePct}%` : "0%", transition: "width .1s linear" }} />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="relative" style={{ height: "clamp(420px,46vw,580px)" }}>
            <div className="pointer-events-none absolute rounded-full" style={{ inset: "4% 2% 0 6%", border: "1.5px dashed var(--lavender)", animation: reducedMotion ? "none" : "spin 60s linear infinite" }} />
            <div className="absolute" style={{ left: "10%", right: "8%", top: "12%", bottom: 0, borderRadius: currentScene.blobRadius, background: currentScene.blobBg, boxShadow: "0 40px 80px -40px rgba(22,27,63,.45)", transition: "border-radius 1.2s cubic-bezier(.6,0,.3,1), background 1.2s ease" }} />
            <div className="absolute overflow-hidden" style={{ left: "10%", right: "8%", top: 0, bottom: 0, borderRadius: "0 0 46% 46% / 0 0 30% 30%" }}>
              {HERO_SCENES.map((sc, i) => (
                <div key={sc.role} className="absolute inset-0" style={{ opacity: i === scene ? 1 : 0, transform: i === scene ? "none" : "translateY(24px) scale(.97)", transition: "opacity .9s ease, transform 1.2s cubic-bezier(.3,0,.2,1)" }}>
                  <DesignPhoto
                    src={sc.img}
                    alt={sc.alt}
                    style={{ position: "absolute", left: 0, right: 0, bottom: 0, width: "100%", height: "100%", objectFit: "contain", objectPosition: "center bottom", filter: "drop-shadow(0 24px 30px rgba(22,27,63,.22))" }}
                  />
                </div>
              ))}
            </div>
            {HERO_SCENES.map((sc, i) => (
              <div key={sc.role} aria-hidden={i !== scene} className="pointer-events-none absolute inset-0" style={{ opacity: i === scene ? 1 : 0, transition: "opacity .8s ease" }}>
                {sc.chips.map((ch) => (
                  <div key={ch.t} className="absolute" style={{ left: ch.left, top: ch.top, animation: reducedMotion ? "none" : ch.anim }}>
                    <div className="flex items-center gap-2.5 whitespace-nowrap rounded-full bg-white py-2.5 pl-2.5 pr-4" style={{ boxShadow: "0 18px 36px -16px rgba(22,27,63,.4)" }}>
                      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-sm font-bold" style={{ background: ch.bg, color: ch.fg }}>{ch.g}</span>
                      <span className="flex flex-col leading-tight">
                        <span className="text-[13px] font-bold">{ch.t}</span>
                        <span className="text-[11px] text-ink-2">{ch.s}</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="shell-narrow relative">
          <div className="grid gap-5 rounded-t-[32px] bg-mist px-[clamp(20px,4vw,48px)] py-7" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
            {STATS.map((s) => (
              <div key={s.l} className="flex flex-col gap-1 border-l-[1.5px] pl-[18px]" style={{ borderColor: "var(--lavender)" }}>
                <span className="serif text-[38px] leading-none text-primary">{s.v}</span>
                <span className="text-sm text-ink-2">{s.l}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="bg-mist">
        <div className="shell-narrow grid gap-7 py-9" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          {TRUST.map((t) => (
            <div key={t.title} className="flex items-start gap-3.5">
              <div className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-white text-lg font-bold text-primary">{t.g}</div>
              <div className="flex flex-col gap-[3px]">
                <span className="serif text-lg font-bold">{t.title}</span>
                <span className="text-sm leading-snug text-ink-2">{t.sub}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Explore by subject — category list with a hover-swap photo panel */}
      <section className="bg-mist">
        <div className="shell-narrow grid items-center gap-14 py-24" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 440px), 1fr))" }}>
          <div className="flex flex-col gap-7">
            <div className="flex flex-col gap-3">
              <span className="eyebrow flex items-center gap-2"><span className="h-[1.5px] w-[22px] bg-primary" />SUBJECTS</span>
              <h2 className="h-section">Browse subjects to find exactly <em className="text-primary">your class</em></h2>
            </div>
            <div className="flex flex-col">
              {CATEGORY_PHOTOS.map((c, i) => {
                const on = i === hoverCat;
                return (
                  <Link
                    key={c.name}
                    to={`/browse?subject=${encodeURIComponent(c.name)}`}
                    onMouseEnter={() => setHoverCat(i)}
                    className="flex items-center gap-[18px] border-b px-1 py-[18px] text-ink hover:pl-3"
                    style={{ borderColor: "var(--lavender)", transition: "padding .25s ease" }}
                  >
                    <span className="serif italic text-[15px]" style={{ width: 24, color: "var(--periwinkle)" }}>0{i + 1}</span>
                    <span className="flex flex-1 flex-col gap-0.5">
                      <span className="serif text-xl font-bold transition-colors" style={{ color: on ? "var(--primary)" : "var(--ink)" }}>{c.name}</span>
                      <span className="text-[13px] text-ink-2">{c.levels}</span>
                    </span>
                    <span
                      className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-base transition-all"
                      style={{ border: `1.5px solid ${on ? "var(--primary)" : "var(--periwinkle)"}`, background: on ? "var(--primary)" : "transparent", color: on ? "#fff" : "var(--primary)" }}
                    >
                      ↗
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="relative" style={{ height: "clamp(380px,40vw,520px)" }}>
            <div className="absolute rounded-[28px]" style={{ inset: "24px -12px -12px 24px", background: "var(--lavender)" }} />
            <div className="absolute inset-0 overflow-hidden rounded-[28px] bg-white">
              {CATEGORY_PHOTOS.map((c, i) => (
                <div key={c.name} className="absolute inset-0" style={{ opacity: i === hoverCat ? 1 : 0, transform: i === hoverCat ? "scale(1)" : "scale(1.04)", transition: "opacity .6s ease, transform .8s ease" }}>
                  <DesignPhoto src={`/design/${c.img}`} alt={`${c.name} class photo`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                </div>
              ))}
            </div>
            <div className="pointer-events-none absolute flex flex-col gap-0.5 rounded-2xl bg-white px-5 py-4" style={{ left: -18, bottom: 28, boxShadow: "0 20px 40px -18px rgba(22,27,63,.4)" }}>
              <span className="text-[11px] font-bold tracking-[.12em] text-ink-2">TYPICAL FEE</span>
              <span className="serif text-2xl">
                {CATEGORY_PHOTOS[hoverCat].fee} <span className="font-sans text-[13px] text-ink-2">/ month</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Top rated, by subject */}
      <section className="shell-narrow flex flex-col gap-7 pb-24 pt-16">
        <div className="flex flex-col gap-2.5">
          <span className="eyebrow">Popular now</span>
          <h2 className="h-section">Top-rated teachers, by subject</h2>
        </div>
        <div className="flex flex-wrap gap-2" role="tablist">
          {Object.keys(TABS).map((label) => {
            const on = label === tab;
            return (
              <button
                key={label}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setTab(label)}
                className="rounded-lg border px-[18px] py-2.5 text-[15px] font-semibold transition-colors"
                style={{ background: on ? "var(--ink)" : "#fff", color: on ? "#fff" : "var(--ink)", borderColor: on ? "var(--ink)" : "var(--line)" }}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))" }}>
          <div className="card-dark flex flex-col gap-4 p-8">
            <span className="serif text-[34px] leading-tight">{tab}</span>
            <p className="text-[15px] leading-relaxed text-on-dark">{TABS[tab]}</p>
            <Link to={tabSubject ? `/browse?subject=${encodeURIComponent(tab)}` : browseTo(tab)} className="btn btn-light mt-auto">
              See all {tab} teachers
            </Link>
          </div>
          {loading &&
            [0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ minHeight: 300, borderRadius: 16 }} />)}
          {!loading && top?.listings?.map((l) => <TeacherCard key={l._id} listing={l} />)}
          {!loading && top?.listings?.length === 0 && (
            <div className="card flex flex-col items-center justify-center gap-2 p-8 text-center" style={{ gridColumn: "span 2" }}>
              <span className="serif text-[22px]">Teachers are joining now</span>
              <span className="text-sm text-ink-2">Be one of the first {tab} teachers on EduLink.</span>
              <Link to="/register?role=teacher" className="btn btn-outline btn-sm mt-2">Become a teacher</Link>
            </div>
          )}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-mist">
        <div className="shell-narrow flex flex-col gap-10 py-24">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div className="flex flex-col gap-2.5">
              <span className="eyebrow">How it works</span>
              <h2 className="h-section">Three steps to better learning</h2>
            </div>
            <div className="flex rounded-[10px] border bg-white p-1" style={{ borderColor: "var(--lavender)" }} role="tablist">
              {Object.keys(ROLES).map((label) => {
                const on = label === role;
                return (
                  <button
                    key={label}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => setRole(label)}
                    className="rounded-[7px] border-0 px-[18px] py-2.5 text-[15px] font-semibold transition-colors"
                    style={{ background: on ? "var(--primary)" : "transparent", color: on ? "#fff" : "var(--ink)" }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))" }}>
            {ROLES[role].map(([title, desc], i) => (
              <div key={title} className="flex flex-col gap-3.5 rounded-2xl bg-white p-8">
                <span className="serif text-[52px] italic leading-none text-lavender">0{i + 1}</span>
                <span className="serif text-[23px] font-bold leading-tight">{title}</span>
                <span className="text-[15px] leading-relaxed text-ink-2">{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why EduLink — the photo-backed trust section */}
      <section className="shell-narrow py-24">
        <div className="grid items-center gap-16" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 440px), 1fr))" }}>
          <div className="relative" style={{ height: "clamp(420px,42vw,540px)" }}>
            <div className="absolute overflow-hidden rounded-3xl bg-lavender" style={{ left: 0, top: 0, width: "52%", height: "62%" }}>
              <DesignPhoto src="/design/trust-parent.png" alt="Mother and daughter looking at a phone together" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 30%", display: "block" }} />
            </div>
            <div className="absolute overflow-hidden rounded-3xl border-8" style={{ right: 0, bottom: 0, width: "58%", height: "70%", background: "var(--blue)", borderColor: "var(--page)" }}>
              <DesignPhoto src="/design/trust-student-v2.png" alt="Student following an online Physics lesson" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 62%", display: "block" }} />
            </div>
            <div className="pointer-events-none absolute flex flex-col gap-0.5 rounded-2xl bg-white px-5 py-4" style={{ left: "4%", bottom: "6%", boxShadow: "0 20px 40px -18px rgba(22,27,63,.4)", animation: "floatA 7s ease-in-out infinite" }}>
              <span className="serif text-[34px] leading-none text-primary">1,200+</span>
              <span className="text-[13px] text-ink-2">Verified teachers</span>
            </div>
            <div className="pointer-events-none absolute flex items-center gap-2.5 rounded-full bg-white py-2.5 pl-2.5 pr-4" style={{ right: "6%", top: "12%", boxShadow: "0 18px 36px -16px rgba(22,27,63,.4)", animation: "floatB 6s ease-in-out infinite" }}>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">✓</span>
              <span className="flex flex-col leading-tight">
                <span className="text-[13px] font-bold">Deposit protected</span>
                <span className="text-[11px] text-ink-2">Refunded if a class is cancelled</span>
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-7">
            <div className="flex flex-col gap-3">
              <span className="eyebrow flex items-center gap-2"><span className="h-[1.5px] w-[22px] bg-primary" />WHY EDULINK</span>
              <h2 className="h-section">Built on trust, designed for <em className="text-primary">peace of mind</em></h2>
            </div>
            <p className="lede max-w-[520px]">Every teacher is checked, every conversation stays on the platform, and parents stay in control of their child's account.</p>
            <div className="grid gap-[22px]" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              {WHY_TRUST.map((t) => (
                <div key={t.title} className="flex items-start gap-3.5">
                  <span className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-2xl bg-mist text-primary">✓</span>
                  <div className="flex flex-col gap-[3px]">
                    <span className="serif text-lg font-bold">{t.title}</span>
                    <span className="text-sm leading-snug text-ink-2">{t.sub}</span>
                  </div>
                </div>
              ))}
            </div>
            <Link to="/register" className="btn btn-primary btn-lg self-start">Create a free account →</Link>
          </div>
        </div>
      </section>

      {/* Stories */}
      <section className="shell-narrow flex flex-col gap-9 py-24">
        <div className="flex max-w-[640px] flex-col gap-2.5">
          <span className="eyebrow">Stories</span>
          <h2 className="h-section">Learners of every age, one place to start</h2>
        </div>
        <div className="grid gap-[18px]" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))" }}>
          {STORIES.map((p, i) => (
            <div key={p.name} className="relative overflow-hidden rounded-2xl bg-ink" style={{ height: 420 }}>
              <div
                className="absolute inset-0"
                style={{ background: `linear-gradient(${150 + i * 25}deg, var(--primary), var(--blue) 55%, var(--lavender))` }}
                aria-hidden="true"
              />
              <div className="serif absolute right-5 top-4 text-[120px] italic leading-none text-white opacity-15" aria-hidden="true">“</div>
              <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2.5 px-[22px] pb-[22px] pt-20 text-white" style={{ background: "linear-gradient(to top, rgba(22,27,63,.94) 45%, rgba(22,27,63,0))" }}>
                <span className="serif text-[17px] italic leading-snug">“{p.quote}”</span>
                <div>
                  <div className="serif text-xl font-bold">{p.name}</div>
                  <div className="text-[13px] text-lavender">{p.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* For teachers */}
      <section className="bg-mist">
        <div className="shell-narrow grid items-center gap-14 py-[88px]" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))" }}>
          <div className="relative" style={{ height: "clamp(320px,34vw,420px)" }}>
            <div className="absolute rounded-[50%_50%_24px_24px] bg-lavender" style={{ inset: "8% 6% 0" }} />
            <div className="absolute overflow-hidden rounded-b-3xl bg-gradient-to-br from-ink to-primary" style={{ inset: "0 6% 0" }}>
              <DesignPhoto
                src="/design/teach-panel.png"
                alt="Smiling teacher holding a folder"
                style={{ position: "absolute", left: 0, right: 0, bottom: 0, width: "100%", height: "100%", objectFit: "contain", objectPosition: "center bottom", filter: "drop-shadow(0 20px 28px rgba(22,27,63,.3))" }}
              />
            </div>
            <div className="pointer-events-none absolute flex items-center gap-2.5 rounded-full bg-white py-2.5 pl-2.5 pr-4 text-ink" style={{ left: 0, bottom: "14%", boxShadow: "0 18px 36px -16px rgba(22,27,63,.5)", animation: "floatA 6s ease-in-out infinite" }}>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-mist text-sm font-bold text-primary">+12</span>
              <span className="flex flex-col leading-tight">
                <span className="text-[13px] font-bold">New interests</span>
                <span className="text-[11px] text-ink-2">This week</span>
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-[22px]">
            <span className="eyebrow">For teachers</span>
            <h2 style={{ font: "400 48px/1.08 var(--font-display)", letterSpacing: "-.01em" }}>Teach on EduLink</h2>
            <p className="max-w-[480px] text-[19px] leading-relaxed text-ink-2 serif">
              Post your subject ads, get verified, and receive interest from students and parents who match what you teach.
            </p>
            <div className="flex flex-col gap-2.5 text-[15px]">
              {["Free to create a profile and post ads", "Matched student leads, delivered to your dashboard", "Set weekly availability; students book trial classes"].map((t) => (
                <span key={t} className="flex gap-2.5"><span className="text-primary">✓</span>{t}</span>
              ))}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-3">
              <Link to="/register?role=teacher" className="btn btn-primary btn-lg">Become a teacher</Link>
              <Link to="/verification" className="btn btn-outline btn-lg">How verification works</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-ink text-white">
        <div className="shell-narrow grid gap-9 pb-8 pt-14" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          <div className="flex flex-col gap-3.5">
            <Brand onDark mark={false} />
            <span className="serif text-base leading-normal text-lavender">Verified teachers for every learner in Sri Lanka.</span>
          </div>
          {FOOTER.map((col) => (
            <div key={col.h} className="flex flex-col gap-2.5 text-[15px]">
              <span className="mb-1 text-xs font-bold tracking-[.12em]">{col.h}</span>
              {col.links.map(([label, to]) =>
                to.startsWith("mailto:") ? (
                  <a key={label} href={to} className="text-lavender hover:text-white">{label}</a>
                ) : (
                  <Link key={label} to={to} className="text-lavender hover:text-white">{label}</Link>
                )
              )}
            </div>
          ))}
        </div>
        <div className="shell-narrow flex flex-wrap items-center justify-between gap-4 border-t pb-8 pt-5 text-[13px] text-lavender" style={{ borderColor: "rgba(173,187,218,.25)" }}>
          <span>© {new Date().getFullYear()} EduLink. All rights reserved.</span>
          <LanguageToggle onDark />
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
