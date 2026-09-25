import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Brand from "../components/ui/Brand.jsx";
import Icon from "../components/ui/Icon.jsx";
import { Avatar, RatingLine, VerifiedBadge } from "../components/ui/index.jsx";
import { LanguageToggle } from "../components/layout/LanguageSwitcher.jsx";
import HeroVideo from "../components/HeroVideo.jsx";
import useAuth from "../hooks/useAuth.js";
import useAsync from "../hooks/useAsync.js";
import useClickOutside from "../hooks/useClickOutside.js";
import { listingsApi } from "../api/endpoints.js";
import { formatPrice, mediumLabel } from "../lib/format.js";

const MENU_SUBJECTS = ["Mathematics", "Science", "English", "ICT", "Music", "Languages"];
const MENU_LEVELS = ["Primary (Grades 1–5)", "Grades 6–9", "O/L", "A/L", "Adult learners"];
const CHIPS = ["O/L Maths", "A/L Physics", "Spoken English", "Piano", "Cambridge IGCSE"];

const TRUST = [
  { g: "✓", title: "Verified teachers", sub: "Identity and qualifications checked before the badge appears." },
  { g: "★", title: "Honest reviews", sub: "Only students who completed classes can leave a review." },
  { g: "◎", title: "Safe in-app chat", sub: "Talk on EduLink first. No phone numbers shared up front." },
  { g: "♥", title: "Parent-first", sub: "Parents manage child accounts and see every conversation." },
];

const EXPLORE = ["Mathematics", "Physics", "Chemistry", "Biology", "English", "ICT", "Sinhala", "Tamil", "Music", "Art", "Accounting", "Economics"];

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

const LandingPage = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("Mathematics");
  const [role, setRole] = useState("Students");

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

      {/* Hero */}
      <section className="shell-narrow grid items-center gap-16 pb-14 pt-[72px]" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 460px), 1fr))" }}>
        <div className="flex flex-col gap-7">
          <span className="eyebrow">Sri Lanka's education marketplace</span>
          <h1 style={{ font: "400 clamp(44px,5.6vw,72px)/1.02 var(--font-display)", letterSpacing: "-.02em", textWrap: "balance" }}>
            Find the right teacher.<br />
            <em className="text-primary">Learn with confidence.</em>
          </h1>
          <p className="lede max-w-[540px]">
            EduLink connects verified teachers with students and parents across Sri Lanka — safely, transparently, and without the middleman.
          </p>
          <div className="flex max-w-[580px] flex-col gap-3">
            <form
              onSubmit={submit}
              role="search"
              className="flex items-center rounded-xl border-[1.5px] bg-white py-1.5 pl-[18px] pr-1.5 transition-colors focus-within:border-primary"
              style={{ borderColor: "var(--lavender)", boxShadow: "0 8px 24px -12px rgba(61,82,160,.35)" }}
            >
              <Icon name="search" size={21} strokeWidth={2} className="text-primary" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="What do you want to learn? e.g. O/L maths near Kandy"
                aria-label="What do you want to learn?"
                className="min-w-0 flex-1 border-0 bg-transparent p-3 text-base font-medium text-ink outline-none"
              />
              <button type="submit" className="btn btn-primary px-[22px] py-[13px]">Search</button>
            </form>
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-0.5 text-[13px] text-ink-2">Popular:</span>
              {CHIPS.map((c) => (
                <Link key={c} to={browseTo(c)} className="chip">{c}</Link>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link to="/browse" className="btn btn-primary btn-lg">Find a tutor</Link>
            <Link to="/register?role=teacher" className="btn btn-outline btn-lg">Become a teacher</Link>
            <Link to="/register?role=parent" className="p-2 text-[15px] font-semibold text-ink underline decoration-lavender underline-offset-4 hover:text-primary">
              Signing up for your child?
            </Link>
          </div>
        </div>

        <div className="relative pb-10 pl-10">
          <div className="absolute rounded-3xl bg-mist" style={{ top: 32, right: -16, bottom: 8, left: 8 }} />
          <div className="relative overflow-hidden rounded-[20px]" style={{ height: 520, boxShadow: "0 30px 60px -30px rgba(22,27,63,.45)" }}>
            <HeroVideo />
          </div>
          <div className="pointer-events-none absolute bottom-0 left-0 flex max-w-[80%] flex-col gap-3 rounded-[14px] bg-white px-6 py-[22px]" style={{ width: 320, boxShadow: "0 20px 40px -16px rgba(22,27,63,.3)" }}>
            <span className="serif text-lg italic leading-snug">“I found a Physics teacher ten minutes from home. My A/L results speak for themselves.”</span>
            <div className="flex items-center gap-2.5">
              <Avatar name="Tharushi W" size={34} />
              <div>
                <div className="text-sm font-semibold">Tharushi W.</div>
                <div className="text-xs text-ink-2">A/L student · Kandy</div>
              </div>
            </div>
          </div>
          <div className="pointer-events-none absolute flex items-center gap-2.5 rounded-xl bg-white px-4 py-3" style={{ top: 28, right: 20, boxShadow: "var(--shadow-float)" }}>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">✓</span>
            <div>
              <div className="text-[13px] font-bold">Fully verified</div>
              <div className="text-xs text-ink-2">ID + clearance checked</div>
            </div>
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

      {/* Explore by subject */}
      <section className="shell-narrow flex flex-col gap-9 pb-10 pt-24">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2.5">
            <span className="eyebrow">Explore</span>
            <h2 className="h-section">Explore by subject</h2>
          </div>
          <Link to="/browse" className="text-[15px] font-semibold">Browse all subjects →</Link>
        </div>
        <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
          {EXPLORE.map((name) => (
            <Link key={name} to={`/browse?subject=${encodeURIComponent(name)}`} className="card card-hover flex items-center gap-4 rounded-xl px-5 py-[18px] text-ink hover:text-ink">
              <div className="serif flex h-12 w-12 flex-none items-center justify-center rounded-[10px] bg-mist text-[22px] font-bold italic text-primary">{name[0]}</div>
              <span className="serif flex-1 text-lg font-bold">{name}</span>
              <span className="text-lg text-primary">→</span>
            </Link>
          ))}
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
          <div className="relative overflow-hidden rounded-2xl" style={{ height: 380, background: "linear-gradient(135deg, var(--ink), var(--primary))" }}>
            <div className="absolute inset-0 flex flex-col justify-end gap-3 p-8 text-white">
              <span className="eyebrow text-lavender">Your teacher dashboard</span>
              {["New request · A/L Physics", "Booking confirmed · Sat 4:00 pm", "New 5-star review"].map((t, i) => (
                <div key={t} className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3 text-sm font-medium backdrop-blur" style={{ marginLeft: i * 24 }}>
                  <span className="h-2 w-2 rounded-full bg-blue" /> {t}
                </div>
              ))}
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
