import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Brand from "../components/ui/Brand.jsx";
import Icon from "../components/ui/Icon.jsx";
import { Avatar, RatingLine, VerifiedBadge } from "../components/ui/index.jsx";
import { LanguageToggle } from "../components/layout/LanguageSwitcher.jsx";
import useAuth from "../hooks/useAuth.js";
import useAsync from "../hooks/useAsync.js";
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
      { g: "★", t: "Student reviews", s: "From completed classes", top: "46%", left: "54%", bg: "var(--mist)", fg: "var(--primary)", anim: "floatB 7s ease-in-out infinite" },
      { g: "⌖", t: "Search nearby", s: "Filter by distance", top: "78%", left: "-2%", bg: "var(--blue)", fg: "#fff", anim: "floatA 8s ease-in-out infinite" },
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
      { g: "✓", t: "Trial bookings", s: "Manage your sessions", top: "66%", left: "56%", bg: "var(--mist)", fg: "var(--primary)", anim: "floatA 7s ease-in-out infinite" },
      { g: "5", t: "Grade 5 Scholarship", s: "Browse available teachers", top: "78%", left: "2%", bg: "var(--lavender)", fg: "var(--ink)", anim: "floatB 8s ease-in-out infinite" },
    ],
  },
  {
    role: "Teachers", eyebrow: "FOR TEACHERS", pre: "Teach on your own", word: "terms",
    sub: "Post subject ads, earn a verified badge and receive interest from matched students.",
    img: "/design/hero-teacher.png", alt: "Teacher holding a tablet",
    blobBg: "var(--primary)", blobRadius: "52% 48% 60% 40% / 42% 58% 42% 58%", ctaLabel: "Become a teacher", ctaTo: "/register?role=teacher",
    placeholder: "Search what other teachers offer",
    chips: [
      { g: "✉", t: "New interests", s: "From matched students", top: "6%", left: "0%", bg: "var(--mist)", fg: "var(--primary)", anim: "floatA 6s ease-in-out infinite" },
      { g: "◷", t: "Set your hours", s: "Weekday evenings", top: "40%", left: "56%", bg: "var(--blue)", fg: "#fff", anim: "floatB 7s ease-in-out infinite" },
      { g: "✓", t: "Verified badge", s: "Unlocks child accounts", top: "78%", left: "-2%", bg: "var(--ink)", fg: "#fff", anim: "floatA 8s ease-in-out infinite" },
    ],
  },
];

const STATS = [
  { v: "✓", l: "Teacher verification" },
  { v: "O/L", l: "School to adult learning" },
  { v: "25", l: "Sri Lankan districts" },
  { v: "3", l: "Content languages: සි · த · EN" },
];

// The second, photo-backed trust section ("Why EduLink") — distinct from
// the assurance strip right under the hero, which stays icon-only.
const WHY_TRUST = [
  { icon: "shield", title: "Verified teachers", sub: "Identity and clearance checked before the badge appears." },
  { icon: "heart", title: "Honest reviews", sub: "Only students who completed classes can review." },
  { icon: "chat", title: "Safe in-app chat", sub: "No phone numbers shared up front." },
  { icon: "users", title: "Parent-first", sub: "Parents manage child accounts and see every conversation." },
];

const CATEGORY_PHOTOS = [
  { name: "Mathematics", img: "cat-maths.png", levels: "Grade 6 to A/L Combined Maths" },
  { name: "Science", img: "cat-science.png", levels: "Physics · Chemistry · Biology" },
  { name: "English", img: "cat-english.png", levels: "Spoken English to IELTS" },
  { name: "ICT", img: "cat-ict.png", levels: "O/L, A/L and programming" },
  { name: "Music", img: "cat-music.png", levels: "Piano, guitar, Eastern music" },
  { name: "Languages", img: "cat-languages.png", levels: "Sinhala, Tamil, Japanese, French" },
];

const CHIPS = ["O/L Maths", "A/L Physics", "Spoken English", "Piano", "Cambridge IGCSE"];

const TRUST = [
  { icon: "shield", title: "Verified teachers", sub: "Identity and qualifications checked before the badge appears." },
  { icon: "heart", title: "Honest reviews", sub: "Only students who completed classes can leave a review." },
  { icon: "chat", title: "Safe in-app chat", sub: "Talk on EduLink first. No phone numbers shared up front." },
  { icon: "users", title: "Parent-first", sub: "Parents manage child accounts and see every conversation." },
];

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
  { name: "Scholarship prep", role: "PRIMARY SCHOOL", quote: "Explore teachers for Grade 5 scholarship subjects and find a class that fits your child.", img: "/design/cat-maths.png", to: "/browse?subject=Mathematics", bg: "var(--lavender)" },
  { name: "A/L science", role: "SECONDARY SCHOOL", quote: "Compare Physics, Chemistry and Biology classes by medium, location and price.", img: "/design/cat-science.png", to: "/browse?subject=Science", bg: "var(--blue)" },
  { name: "Adult learning", role: "LIFELONG LEARNING", quote: "Find language and practical skills classes that work around your schedule.", img: "/design/cat-languages.png", to: "/browse?subject=Languages", bg: "var(--periwinkle)" },
  { name: "Parent-managed", role: "FAMILY ACCOUNTS", quote: "Manage your child's requests, conversations and bookings from your account.", img: "/design/trust-parent.png", to: "/register?role=parent", bg: "var(--primary)" },
];

const FOOTER = [
  { h: "LEARN", links: [["Browse teachers", "/browse"], ["Subjects", "/browse"], ["For parents", "/register?role=parent"]] },
  { h: "TEACH", links: [["Become a teacher", "/register?role=teacher"], ["Verification", "/verification"], ["Post a class ad", "/listings/new"]] },
  { h: "EDULINK", links: [["Report a problem", "mailto:safety@edulink.lk"], ["Contact", "mailto:hello@edulink.lk"]] },
];

const browseTo = (q) => `/browse?q=${encodeURIComponent(q)}`;

const LandingHeader = () => {
  const { status } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const authed = status === "authenticated";
  return (
    <header className="sticky top-0 z-40 border-b border-line" style={{ background: "rgba(251,250,253,.92)", backdropFilter: "blur(10px)" }}>
      <div className="shell flex items-center gap-[clamp(16px,2.4vw,32px)] whitespace-nowrap" style={{ height: 80 }}>
        <Brand />
        <nav className="hidden gap-1 text-[15px] font-medium md:flex">
          <Link to="/browse" className="landing-nav-link rounded-lg px-3.5 py-[9px] hover:bg-mist">Explore</Link>
          <a href="#parents" className="landing-nav-link rounded-lg px-3.5 py-[9px] hover:bg-mist">For parents</a>
          <a href="#teach" className="landing-nav-link rounded-lg px-3.5 py-[9px] hover:bg-mist">For teachers</a>
        </nav>
        <div className="flex-1" />
        <span className="hidden sm:block">
          <LanguageToggle />
        </span>
        <button type="button" className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-lavender text-primary md:hidden" aria-label={mobileOpen ? "Close menu" : "Open menu"} aria-expanded={mobileOpen} aria-controls="landing-mobile-menu" onClick={() => setMobileOpen((open) => !open)}><Icon name={mobileOpen ? "x" : "menu"} size={20} /></button>
        {authed ? (
          <Link to="/dashboard" className="btn btn-primary flex-none rounded-full"><span className="hidden sm:inline">Go to dashboard</span><span className="sm:hidden">Dashboard</span></Link>
        ) : (
          <>
            <Link to="/login" className="hidden flex-none text-[15px] font-semibold text-ink hover:text-primary md:block">Sign in</Link>
            <Link to="/register" className="btn btn-primary flex-none rounded-full"><span className="max-[379px]:hidden">Join for free</span><span className="min-[380px]:hidden">Join</span></Link>
          </>
        )}
      </div>
      {mobileOpen && <nav id="landing-mobile-menu" className="popover absolute right-4 top-[72px] flex w-[min(300px,calc(100vw-32px))] flex-col gap-1 p-4 md:hidden" aria-label="Mobile navigation">
        <Link to="/browse" onClick={() => setMobileOpen(false)} className="landing-nav-link rounded-lg px-3 py-2 hover:bg-mist">Explore classes</Link>
        <a href="#parents" onClick={() => setMobileOpen(false)} className="landing-nav-link rounded-lg px-3 py-2 hover:bg-mist">For parents</a>
        <a href="#teach" onClick={() => setMobileOpen(false)} className="landing-nav-link rounded-lg px-3 py-2 hover:bg-mist">For teachers</a>
        {!authed && <Link to="/login" onClick={() => setMobileOpen(false)} className="landing-nav-link rounded-lg px-3 py-2 hover:bg-mist">Sign in</Link>}
        <div className="border-t border-line px-3 pt-3"><LanguageToggle /></div>
      </nav>}
    </header>
  );
};

const photoForSubject = (subject = "") => {
  const matched = CATEGORY_PHOTOS.find((category) => subject.toLowerCase().includes(category.name.toLowerCase()));
  return `/design/${matched?.img || "cat-science.png"}`;
};

const TeacherCard = ({ listing }) => {
  const owner = listing.owner || {};
  const verified = ["id_verified", "fully_verified"].includes(owner.verificationStatus);
  return (
    <Link to={`/listings/${listing._id}`} className="landing-class-card text-ink hover:text-ink">
      <div className="relative h-[190px] overflow-hidden rounded-[14px] bg-mist">
        <DesignPhoto src={photoForSubject(listing.subject)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <span className="absolute left-2.5 top-2.5 rounded-full bg-white px-3 py-1 text-xs font-bold text-primary">{listing.mode || "Class available"}</span>
      </div>
      <div className="flex flex-1 flex-col gap-2.5 px-2.5 pb-2 pt-4">
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-2"><span className="font-bold text-primary">{listing.subject}</span><span>{listing.grade}</span><span>{mediumLabel(listing.medium)} medium</span></div>
        <span className="serif text-xl font-bold leading-tight">{listing.title || `${listing.subject} for ${listing.grade}`}</span>
        <span className="flex items-center gap-2 text-[13px] text-ink-2"><Avatar name={owner.name} src={owner.photoUrl} size={26} />{owner.name || "Teacher"}{verified && <VerifiedBadge tier={owner.verificationStatus} />}</span>
        <RatingLine avgRating={owner.avgRating} reviewCount={owner.reviewCount} />
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-mist pt-3">
          <span className="serif text-xl">{formatPrice(listing.price) || "Ask for fee"}</span>
          <span className="rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-white">View class</span>
        </div>
      </div>
    </Link>
  );
};

const SubjectCard = ({ category }) => (
  <Link to={`/browse?subject=${encodeURIComponent(category.name)}`} className="landing-class-card text-ink hover:text-ink">
    <div className="relative h-[190px] overflow-hidden rounded-[14px] bg-mist">
      <DesignPhoto src={`/design/${category.img}`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      <span className="absolute left-2.5 top-2.5 rounded-full bg-white px-3 py-1 text-xs font-bold text-primary">Explore subject</span>
    </div>
    <div className="flex flex-1 flex-col gap-2.5 px-2.5 pb-2 pt-4">
      <span className="text-xs font-bold text-primary">{category.name}</span>
      <span className="serif text-xl font-bold leading-tight">Find your {category.name.toLowerCase()} class</span>
      <p className="text-sm leading-relaxed text-ink-2">{category.levels}</p>
      <div className="mt-auto flex items-center justify-between border-t border-mist pt-3"><span className="text-sm text-ink-2">Browse teachers</span><span className="rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-white">Explore →</span></div>
    </div>
  </Link>
);

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
  const [role, setRole] = useState("Students");
  const [storyIndex, setStoryIndex] = useState(0);
  const [scene, setScene] = useState(0);
  const [sceneElapsed, setSceneElapsed] = useState(0);
  const [scenePaused, setScenePaused] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [hoverCat, setHoverCat] = useState(0);
  const railRef = useRef(null);
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

  const { data: top, loading } = useAsync(
    () => listingsApi.browse({ sort: "rating", limit: 6 }),
    []
  );
  const liveClasses = (top?.listings || []).filter((listing) => listing.type === "teacher_ad");
  const extraSubjects = CATEGORY_PHOTOS.filter((category) =>
    !liveClasses.some((listing) => listing.subject?.toLowerCase() === category.name.toLowerCase())
  ).slice(0, Math.max(0, 6 - liveClasses.length));
  const currentStory = STORIES[storyIndex];

  const moveRail = (direction) => {
    const rail = railRef.current;
    if (!rail) return;
    const card = rail.querySelector(".landing-class-card");
    rail.scrollBy({ left: direction * ((card?.getBoundingClientRect().width || 320) + 20), behavior: reducedMotion ? "instant" : "smooth" });
  };
  const moveStory = (direction) => setStoryIndex((index) => (index + direction + STORIES.length) % STORIES.length);

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
        <div className="shell-narrow relative grid items-center gap-12 pb-[72px] pt-[clamp(40px,6vw,80px)]" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 480px), 1fr))" }}>
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
              <Link to={currentScene.ctaTo} className="flex items-center gap-2.5 rounded-full px-[26px] py-3.5 text-[15px] font-semibold hover:opacity-90" style={{ background: "var(--ink)", color: "#fff" }}>
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
            <svg width="92" height="40" viewBox="0 0 92 40" fill="none" stroke="var(--primary)" strokeWidth="1.6" strokeLinecap="round" className="pointer-events-none absolute left-0 top-[16%]" aria-hidden="true"><path d="M2 30c10-18 18 8 28-6s16-18 24-4 14 10 22-4 8-12 14-10" /></svg>
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
      <section className="border-y border-line bg-white">
        <div className="shell-narrow grid py-[26px]" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {TRUST.map((t, index) => (
            <div key={t.title} className="flex items-center gap-3.5 border-l px-[22px] py-1.5" style={{ borderColor: index === 0 ? "transparent" : "var(--line)" }}>
              <Icon name={t.icon} size={26} strokeWidth={1.4} className="text-primary" />
              <div className="flex flex-col gap-[3px]">
                <span className="serif text-base font-bold">{t.title}</span>
                <span className="text-[13px] leading-snug text-ink-2">{t.sub}</span>
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
              <span className="text-[11px] font-bold tracking-[.12em] text-ink-2">EXPLORE SUBJECT</span>
              <span className="serif text-2xl">{CATEGORY_PHOTOS[hoverCat].name}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="shell-narrow flex flex-col gap-8 pb-20 pt-24">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-3">
            <span className="eyebrow flex items-center gap-2"><span className="h-[1.5px] w-[22px] bg-primary" />EXPLORE CLASSES</span>
            <h2 className="h-section">Classes to <em className="text-primary">explore</em> this term</h2>
          </div>
          <div className="flex gap-2.5">
            <button type="button" onClick={() => moveRail(-1)} aria-label="Previous classes" className="flex h-12 w-12 items-center justify-center rounded-full border-[1.5px] border-lavender bg-white text-ink hover:border-primary hover:text-primary"><Icon name="arrowLeft" size={19} /></button>
            <button type="button" onClick={() => moveRail(1)} aria-label="Next classes" className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white hover:bg-primary-hover"><Icon name="arrowRight" size={19} /></button>
          </div>
        </div>
        <div ref={railRef} className="landing-class-rail no-scrollbar">
          {loading ? [0, 1, 2].map((index) => <div key={index} className="skeleton h-[440px] rounded-[20px]" />) : (
            <>
              {liveClasses.map((listing) => <TeacherCard key={listing._id} listing={listing} />)}
              {extraSubjects.map((category) => <SubjectCard key={category.name} category={category} />)}
            </>
          )}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="bg-mist">
        <div className="shell-narrow flex flex-col gap-12 py-24">
          <div className="flex flex-col items-center gap-[18px] text-center">
            <span className="eyebrow flex items-center gap-2"><span className="h-[1.5px] w-[22px] bg-primary" />HOW IT WORKS<span className="h-[1.5px] w-[22px] bg-primary" /></span>
            <h2 className="h-section">Three steps to <em className="text-primary">better learning</em></h2>
            <div className="flex rounded-full border border-lavender bg-white p-1" role="tablist">
              {Object.keys(ROLES).map((label) => {
                const on = label === role;
                return (
                  <button
                    key={label}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => setRole(label)}
                    className="rounded-full border-0 px-5 py-2.5 text-[15px] font-semibold transition-colors"
                    style={{ background: on ? "var(--primary)" : "transparent", color: on ? "#fff" : "var(--ink)" }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="landing-steps relative grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))" }}>
            <div className="landing-step-line pointer-events-none absolute left-[16%] right-[16%] top-11 border-t-[1.5px] border-dashed border-periwinkle" />
            {ROLES[role].map(([title, desc], i) => (
              <div key={title} className="relative flex flex-col items-center gap-3.5 px-3 text-center">
                <span className="serif flex h-[88px] w-[88px] items-center justify-center rounded-full border-[6px] border-mist text-[36px] italic" style={{ background: i === 1 ? "var(--primary)" : "var(--lavender)", color: i === 1 ? "#fff" : "var(--ink)", boxShadow: "0 16px 32px -16px rgba(22,27,63,.45)" }}>0{i + 1}</span>
                <span className="serif text-[23px] font-bold leading-tight">{title}</span>
                <span className="max-w-[320px] text-[15px] leading-relaxed text-ink-2">{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why EduLink — the photo-backed trust section */}
      <section id="parents" className="shell-narrow py-[104px]">
        <div className="grid items-center gap-16" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 440px), 1fr))" }}>
          <div className="relative" style={{ height: "clamp(420px,42vw,540px)" }}>
            <div className="absolute overflow-hidden rounded-3xl bg-lavender" style={{ left: 0, top: 0, width: "52%", height: "62%" }}>
              <DesignPhoto src="/design/trust-parent.png" alt="Mother and daughter looking at a phone together" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 30%", display: "block" }} />
            </div>
            <div className="absolute overflow-hidden rounded-3xl border-8" style={{ right: 0, bottom: 0, width: "58%", height: "70%", background: "var(--blue)", borderColor: "var(--page)" }}>
              <DesignPhoto src="/design/trust-student-v2.png" alt="Student following an online Physics lesson" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 62%", display: "block" }} />
            </div>
            <svg width="80" height="60" viewBox="0 0 80 60" fill="none" stroke="var(--primary)" strokeWidth="1.6" strokeLinecap="round" className="pointer-events-none absolute left-[44%] top-[6%]" aria-hidden="true"><path d="M4 50C14 20 40 8 70 12" /><path d="m62 4 9 8-9 8" /></svg>
            <div className="pointer-events-none absolute flex flex-col gap-0.5 rounded-2xl bg-white px-5 py-4" style={{ left: "4%", bottom: "6%", boxShadow: "0 20px 40px -18px rgba(22,27,63,.4)", animation: "floatA 7s ease-in-out infinite" }}>
              <span className="serif text-[34px] leading-none text-primary">✓</span>
              <span className="text-[13px] text-ink-2">Teacher verification</span>
            </div>
            <div className="pointer-events-none absolute flex items-center gap-2.5 rounded-full bg-white py-2.5 pl-2.5 pr-4" style={{ right: "6%", top: "12%", boxShadow: "0 18px 36px -16px rgba(22,27,63,.4)", animation: "floatB 6s ease-in-out infinite" }}>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">✓</span>
              <span className="flex flex-col leading-tight">
                <span className="text-[13px] font-bold">Trial bookings</span>
                <span className="text-[11px] text-ink-2">Keep track of your sessions</span>
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-7">
            <div className="flex flex-col gap-3">
              <span className="eyebrow flex items-center gap-2"><span className="h-[1.5px] w-[22px] bg-primary" />WHY EDULINK</span>
              <h2 className="h-section">Built on trust, designed for <em className="text-primary">peace of mind</em></h2>
            </div>
            <p className="lede max-w-[520px]">Teacher verification is clearly marked, conversations stay on the platform, and parents stay in control of their child's account.</p>
            <div className="grid gap-[22px]" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              {WHY_TRUST.map((t) => (
                <div key={t.title} className="flex items-start gap-3.5">
                  <span className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-2xl bg-mist text-primary"><Icon name={t.icon} size={22} strokeWidth={1.5} /></span>
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

      <section className="relative overflow-hidden bg-mist">
        <span className="serif pointer-events-none absolute -top-10 right-[4%] text-[360px] italic leading-none text-lavender opacity-45" aria-hidden="true">“</span>
        <div className="shell-narrow relative grid items-center gap-14 py-24" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))" }}>
          <div className="col-span-full flex flex-col gap-3"><span className="eyebrow flex items-center gap-2"><span className="h-[1.5px] w-[22px] bg-primary" />WAYS TO LEARN</span><h2 className="h-section">A path for <em className="text-primary">every learner</em></h2></div>
          <div className="relative flex items-center justify-center" style={{ height: "clamp(320px,32vw,420px)" }}>
            <div className="absolute aspect-square max-h-full w-[88%] rounded-full transition-colors duration-700" style={{ background: currentStory.bg }} />
            <div className="relative aspect-square max-h-[86%] w-[74%] overflow-hidden rounded-full border-8 border-white" style={{ boxShadow: "0 30px 60px -30px rgba(22,27,63,.5)" }}>
              {STORIES.map((story, index) => <div key={story.name} className="absolute inset-0 transition-opacity duration-700" style={{ opacity: index === storyIndex ? 1 : 0 }}><DesignPhoto src={story.img} alt={index === storyIndex ? `${story.name} learning path` : ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>)}
            </div>
          </div>
          <div className="flex flex-col gap-6" aria-live="polite">
            <span className="eyebrow">{currentStory.role}</span>
            <h3 className="serif text-[clamp(30px,3vw,42px)] leading-tight">{currentStory.name}</h3>
            <p className="serif max-w-[480px] text-[clamp(24px,2.4vw,32px)] italic leading-[1.4]">{currentStory.quote}</p>
            <Link to={currentStory.to} className="self-start text-[15px] font-semibold text-primary hover:text-primary-hover">Explore this path →</Link>
            <div className="flex items-center gap-4">
              <button type="button" onClick={() => moveStory(-1)} aria-label="Previous learning path" className="flex h-12 w-12 items-center justify-center rounded-full border-[1.5px] border-periwinkle bg-white text-ink hover:border-primary"><Icon name="arrowLeft" size={19} /></button>
              <button type="button" onClick={() => moveStory(1)} aria-label="Next learning path" className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white hover:bg-primary-hover"><Icon name="arrowRight" size={19} /></button>
              <span className="serif text-[17px] italic text-ink-2">{storyIndex + 1} / {STORIES.length}</span>
            </div>
          </div>
        </div>
      </section>

      {/* For teachers */}
      <section id="teach" className="shell-narrow py-[104px]">
        <div className="relative grid items-center gap-10 overflow-hidden rounded-[32px] bg-primary p-[clamp(32px,5vw,64px)] text-white" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 380px), 1fr))" }}>
          <div className="pointer-events-none absolute -bottom-[120px] -right-20 h-[420px] w-[420px] rounded-full bg-blue opacity-50" />
          <div className="pointer-events-none absolute -top-[60px] right-[120px] h-40 w-40 rounded-full border-[1.5px] border-dashed border-lavender" />
          <div className="relative flex flex-col gap-[22px]">
            <span className="eyebrow flex items-center gap-2 text-lavender"><span className="h-[1.5px] w-[22px] bg-lavender" />FOR TEACHERS</span>
            <h2 style={{ font: "400 clamp(36px,4vw,52px)/1.08 var(--font-display)", letterSpacing: "-.01em" }}>Share what you know. <em className="text-mist">Teach on EduLink.</em></h2>
            <p className="serif max-w-[480px] text-[19px] leading-relaxed text-mist">
              Post your subject ads, get verified, and receive interest from students and parents who match what you teach.
            </p>
            <div className="flex flex-col gap-2.5 text-[15px]">
              {["Free to create a profile and post ads", "Matched student leads, delivered to your dashboard", "Set weekly availability; students book trial classes"].map((t) => (
                <span key={t} className="flex gap-2.5"><span className="text-lavender">✓</span>{t}</span>
              ))}
            </div>
            <div className="mt-1.5 flex flex-wrap gap-3">
              <Link to="/register?role=teacher" className="btn btn-light btn-lg rounded-full">Become a teacher</Link>
              <Link to="/verification" className="btn btn-lg rounded-full border-lavender bg-transparent hover:border-white" style={{ color: "#fff" }}>How verification works</Link>
            </div>
          </div>
          <div className="relative" style={{ height: "clamp(320px,34vw,420px)" }}>
            <div className="absolute rounded-[50%_50%_24px_24px] bg-lavender" style={{ inset: "8% 6% 0" }} />
            <div className="absolute overflow-hidden rounded-b-3xl" style={{ inset: "0 6% 0" }}>
              <DesignPhoto src="/design/teach-panel.png" alt="Smiling teacher holding a folder" style={{ position: "absolute", left: 0, right: 0, bottom: 0, width: "100%", height: "100%", objectFit: "contain", objectPosition: "center bottom", filter: "drop-shadow(0 20px 28px rgba(22,27,63,.3))" }} />
            </div>
            <div className="pointer-events-none absolute flex items-center gap-2.5 rounded-full bg-white py-2.5 pl-2.5 pr-4 text-ink" style={{ left: 0, bottom: "14%", boxShadow: "0 18px 36px -16px rgba(22,27,63,.5)", animation: reducedMotion ? "none" : "floatA 6s ease-in-out infinite" }}>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-mist text-sm font-bold text-primary">✉</span>
              <span className="flex flex-col leading-tight"><span className="text-[13px] font-bold">New interests</span><span className="text-[11px] text-ink-2">From matched students</span></span>
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
                  <a key={label} href={to} className="landing-footer-link">{label}</a>
                ) : (
                  <Link key={label} to={to} className="landing-footer-link">{label}</Link>
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
