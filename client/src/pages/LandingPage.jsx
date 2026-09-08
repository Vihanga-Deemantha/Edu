import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import HeroVideo from "../components/HeroVideo.jsx";
import { useReducedMotion } from "../hooks/useReducedMotion.js";

/* ── Static data ── */
const SUBJECTS = [
  { emoji: "📐", name: "Mathematics" },
  { emoji: "🔬", name: "Science" },
  { emoji: "📚", name: "English" },
  { emoji: "🌍", name: "Geography" },
  { emoji: "🎨", name: "Art" },
  { emoji: "🎸", name: "Music" },
  { emoji: "💻", name: "ICT" },
  { emoji: "⚗️", name: "Chemistry" },
  { emoji: "🌱", name: "Biology" },
  { emoji: "📖", name: "Sinhala" },
];

const STEPS = [
  {
    icon: "📝",
    title: "Create your account",
    desc: "Sign up as a teacher, student, or parent. Verify your email and phone — takes under two minutes.",
  },
  {
    icon: "🔍",
    title: "Browse or post",
    desc: "Teachers post their subject ads. Students and parents browse by subject, grade, and location.",
  },
  {
    icon: "🤝",
    title: "Connect & learn",
    desc: "Send an interest request. All communication through the platform — safe, traceable, simple.",
  },
];

/* ── Scroll-reveal helper ── */
const useScrollReveal = (reducedMotion) => {
  const ref = useRef(null);
  useEffect(() => {
    if (reducedMotion || !ref.current) return;
    const els = ref.current.querySelectorAll(".reveal");
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("visible"); } }),
      { threshold: 0.15 }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [reducedMotion]);
  return ref;
};

const LandingPage = () => {
  const reducedMotion = useReducedMotion();
  const pageRef = useScrollReveal(reducedMotion);

  return (
    <div ref={pageRef} style={{ overflowX: "hidden", backgroundColor: "var(--bg-main)" }}>

      {/* ── HERO — Video full bleed like Phase 1 ── */}
      <section className="relative flex items-end overflow-hidden" aria-label="Hero" style={{ minHeight: "calc(100vh - 4.5rem)" }}>
        
        {/* Full bleed video */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}>
          <HeroVideo />
          {/* Overlay gradient only at the bottom so text is readable, leaving the top half of the video 100% visible */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, var(--bg-main) 0%, rgba(250, 251, 255, 0.95) 20%, rgba(250, 251, 255, 0) 60%)", zIndex: 1 }}></div>
        </div>

        <div className="relative z-20 container pb-20 reveal" style={{ paddingTop: "12rem" }}>
          <div style={{ maxWidth: "40rem" }}>
            <p className="reveal" style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.25rem 0.875rem", borderRadius: "9999px", backgroundColor: "var(--white)", border: "1px solid var(--secondary)", color: "var(--primary)", fontSize: "0.75rem", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "1.5rem", boxShadow: "var(--shadow-sm)" }}>
              <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "var(--primary)" }}></span>
              Sri Lanka&apos;s education marketplace
            </p>
            <h1 className="text-4xl sm-text-6xl font-bold tracking-tight mb-6 reveal" style={{ color: "var(--text-main)", transitionDelay: "100ms" }}>
              Find the right teacher.<br />
              <span style={{ color: "var(--primary)" }}>Learn with confidence.</span>
            </h1>
            <p className="text-lg reveal" style={{ color: "var(--text-main)", fontWeight: "500", marginBottom: "2.5rem", transitionDelay: "200ms", textShadow: "0 2px 4px rgba(255,255,255,0.5)" }}>
              EduLink connects verified teachers with students and parents across Sri Lanka —
              safely, transparently, and without the middleman.
            </p>
            <div className="flex items-center gap-4 reveal" style={{ flexWrap: "wrap", transitionDelay: "300ms" }}>
              <Link to="/register?role=student" className="btn btn-primary btn-lg">
                Find a Tutor
              </Link>
              <Link to="/register?role=teacher" className="btn btn-outline btn-lg" style={{ backgroundColor: "var(--white)" }}>
                Become a Teacher →
              </Link>
            </div>
            <div className="reveal" style={{ marginTop: "2rem", transitionDelay: "400ms" }}>
              <Link to="/register?role=parent" style={{ fontSize: "0.875rem", fontWeight: "600", color: "var(--text-main)", display: "inline-flex", alignItems: "center", gap: "0.5rem" }} onMouseEnter={(e) => e.target.style.color = "var(--primary)"} onMouseLeave={(e) => e.target.style.color = "var(--text-main)"}>
                <span style={{ width: "24px", height: "24px", borderRadius: "50%", backgroundColor: "var(--secondary)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)" }}>👨‍👩‍👧</span>
                Signing up for your child? Start here
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS (Teacher Cards Style) ── */}
      <section style={{ padding: "6rem 0", backgroundColor: "var(--white)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }} aria-label="How it works">
        <div className="container">
          <div className="reveal text-center" style={{ maxWidth: "48rem", margin: "0 auto" }}>
            <h2 className="text-3xl font-bold tracking-tight mb-4" style={{ color: "var(--text-main)" }}>Three steps to better learning</h2>
            <p className="text-lg" style={{ color: "var(--text-secondary)" }}>
              Whether you&apos;re a teacher posting your first ad or a parent finding tuition for your child — the process is simple.
            </p>
          </div>

          <div className="flex flex-col md-flex-row md-grid-cols-3 gap-8" style={{ marginTop: "4rem", display: "grid" }}>
            {STEPS.map((step, i) => (
              <div key={step.title} className="pinned-card washi-tape reveal" style={{ transitionDelay: `${i * 80}ms` }}>
                <div className="flex flex-col gap-3">
                  <div style={{ position: "absolute", top: "-10px", right: "-10px", width: "24px", height: "24px", borderRadius: "50%", backgroundColor: "var(--accent)", color: "var(--white)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: "bold", zIndex: 10, boxShadow: "var(--shadow-sm)" }}>
                    {i + 1}
                  </div>
                  <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
                    {step.icon}
                  </div>
                  <h3 className="text-xl font-bold" style={{ color: "var(--text-main)", fontFamily: "var(--font-display)" }}>{step.title}</h3>
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TRUST & SAFETY ── */}
      <section style={{ padding: "6rem 0", backgroundColor: "#EFF6FF" }} aria-label="Trust and safety">
        <div className="container">
          <div className="reveal text-center" style={{ maxWidth: "48rem", margin: "0 auto" }}>
            <h2 className="text-3xl font-bold tracking-tight mb-4" style={{ color: "var(--text-main)" }}>
              Learning feels better when you trust your teacher.
            </h2>
          </div>

          <div className="flex flex-col lg-flex-row lg-grid-cols-2 gap-12 md-items-center reveal" style={{ marginTop: "4rem", display: "grid" }}>
            
            <div className="flex flex-col gap-8">
              <div className="flex items-start gap-5">
                <div style={{ flexShrink: 0, width: "3rem", height: "3rem", borderRadius: "50%", backgroundColor: "var(--verified-light)", color: "var(--verified)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.25rem" }}>
                  ✓
                </div>
                <div>
                  <h4 className="text-lg font-bold mb-1" style={{ color: "var(--text-main)" }}>Verified Teachers</h4>
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Real identities and qualifications.</p>
                </div>
              </div>
              <div className="flex items-start gap-5">
                <div style={{ flexShrink: 0, width: "3rem", height: "3rem", borderRadius: "50%", backgroundColor: "rgba(245, 185, 66, 0.15)", color: "var(--rating)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.25rem" }}>
                  ⭐
                </div>
                <div>
                  <h4 className="text-lg font-bold mb-1" style={{ color: "var(--text-main)" }}>Student Reviews</h4>
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>See what other students experienced.</p>
                </div>
              </div>
              <div className="flex items-start gap-5">
                <div style={{ flexShrink: 0, width: "3rem", height: "3rem", borderRadius: "50%", backgroundColor: "var(--secondary)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.25rem" }}>
                  🎯
                </div>
                <div>
                  <h4 className="text-lg font-bold mb-1" style={{ color: "var(--text-main)" }}>Better Matches</h4>
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Find teachers suited to your goals.</p>
                </div>
              </div>
            </div>

            {/* Teacher Card Example */}
            <div style={{ position: "relative" }}>
               {/* Background accents */}
               <div style={{ position: "absolute", top: "-2rem", right: "2rem", width: "4rem", height: "4rem", borderRadius: "50%", backgroundColor: "var(--highlight)", opacity: 0.4, zIndex: 0, filter: "blur(10px)" }}></div>
               <div style={{ position: "absolute", bottom: "-1rem", left: "1rem", width: "5rem", height: "5rem", borderRadius: "50%", backgroundColor: "var(--accent)", opacity: 0.3, zIndex: 0, filter: "blur(15px)" }}></div>
               
               <div className="pinned-card washi-tape" style={{ zIndex: 10, padding: "2rem" }}>
                  <div className="flex items-center gap-4" style={{ marginBottom: "1.5rem" }}>
                    <div style={{ width: "4rem", height: "4rem", borderRadius: "50%", backgroundColor: "var(--primary)", color: "var(--white)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", fontWeight: "700", fontFamily: "var(--font-display)" }}>
                      KP
                    </div>
                    <div>
                      <h3 className="text-xl font-bold" style={{ color: "var(--text-main)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        Kasun Perera
                      </h3>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", color: "var(--verified)", fontSize: "0.75rem", fontWeight: "700" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "14px", height: "14px", borderRadius: "50%", backgroundColor: "var(--verified)", color: "var(--white)", fontSize: "9px" }}>✓</span>
                        Verified Teacher
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ marginBottom: "1.5rem" }}>
                    <p style={{ fontWeight: "700", color: "var(--text-main)", marginBottom: "0.25rem" }}>Mathematics</p>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                      <span style={{ color: "var(--rating)", fontWeight: "700" }}>⭐ 4.9</span>
                      <span>·</span>
                      <span>126 reviews</span>
                    </div>
                  </div>

                  <div className="flex gap-2" style={{ marginBottom: "1.5rem", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: "600", padding: "0.25rem 0.75rem", borderRadius: "9999px", backgroundColor: "var(--bg-secondary)", color: "var(--text-secondary)" }}>Grade 9–11</span>
                    <span style={{ fontSize: "0.75rem", fontWeight: "600", padding: "0.25rem 0.75rem", borderRadius: "9999px", backgroundColor: "var(--bg-secondary)", color: "var(--text-secondary)" }}>Algebra</span>
                  </div>

                  <button className="btn btn-outline btn-full">
                    View Profile →
                  </button>
               </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── SUBJECTS ── */}
      <section style={{ padding: "6rem 0", backgroundColor: "var(--bg-main)" }} aria-label="Subject categories">
        <div className="container">
          <div className="reveal text-center" style={{ maxWidth: "48rem", margin: "0 auto" }}>
            <h2 className="text-3xl font-bold tracking-tight mb-4" style={{ color: "var(--text-main)" }}>Explore by subject</h2>
            <p className="text-lg mb-10" style={{ color: "var(--text-secondary)" }}>
              Find exactly what you&apos;re looking for.
            </p>
          </div>
          <div className="flex gap-4 reveal" style={{ overflowX: "auto", paddingBottom: "1.5rem", paddingTop: "0.5rem", scrollSnapType: "x mandatory", scrollbarWidth: "none", msOverflowStyle: "none" }} role="list">
            {SUBJECTS.map((s, i) => (
              <div key={s.name} className="subject-chip" role="listitem">
                <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>{s.emoji}</div>
                <div style={{ fontSize: "0.875rem", fontWeight: "700", color: "var(--text-main)" }}>{s.name}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section style={{ padding: "4rem 1.5rem" }} className="reveal">
        <div className="container" style={{ background: "linear-gradient(135deg, var(--primary) 0%, #667EEA 100%)", borderRadius: "var(--radius-xl)", padding: "4rem 2rem", textAlign: "center", position: "relative", overflow: "hidden" }}>
          {/* Decorative glass elements */}
          <div style={{ position: "absolute", top: "-2rem", left: "-2rem", width: "8rem", height: "8rem", borderRadius: "50%", backgroundColor: "var(--white)", opacity: 0.1, filter: "blur(1px)" }}></div>
          <div style={{ position: "absolute", bottom: "-4rem", right: "-2rem", width: "12rem", height: "12rem", borderRadius: "50%", backgroundColor: "var(--accent)", opacity: 0.4, filter: "blur(20px)" }}></div>
          
          <div style={{ position: "relative", zIndex: 10, maxWidth: "32rem", margin: "0 auto" }}>
            <h2 className="text-3xl font-bold tracking-tight mb-4" style={{ color: "var(--white)" }}>Ready to start learning?</h2>
            <p className="text-lg mb-8" style={{ color: "var(--secondary)" }}>
              Join thousands of students and teachers already using EduLink.
            </p>
            <Link to="/register" className="btn btn-lg" style={{ backgroundColor: "var(--white)", color: "var(--primary)" }}>
              Create an account
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ padding: "3rem 0", backgroundColor: "var(--white)", borderTop: "1px solid var(--border)" }} aria-label="Site footer">
        <div className="container">
          <div className="flex flex-col md-flex-row md-items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <img src="/edulink-friendly-logo.png" alt="EduLink Logo" style={{ height: "32px", width: "32px", borderRadius: "8px" }} />
              <span style={{ fontFamily: "var(--font-display)", fontSize: "1.5rem", fontWeight: "700", color: "var(--text-main)", letterSpacing: "-0.025em" }}>
                Edu<span style={{ color: "var(--primary)" }}>Link</span>
              </span>
            </div>
            <nav className="flex gap-6" style={{ flexWrap: "wrap" }} aria-label="Footer navigation">
              <Link to="/login" style={{ fontSize: "0.875rem", fontWeight: "600", color: "var(--text-secondary)" }} onMouseEnter={(e) => e.target.style.color = "var(--primary)"} onMouseLeave={(e) => e.target.style.color = "var(--text-secondary)"}>Sign in</Link>
              <Link to="/register" style={{ fontSize: "0.875rem", fontWeight: "600", color: "var(--text-secondary)" }} onMouseEnter={(e) => e.target.style.color = "var(--primary)"} onMouseLeave={(e) => e.target.style.color = "var(--text-secondary)"}>Register</Link>
              <a href="#trust" style={{ fontSize: "0.875rem", fontWeight: "600", color: "var(--text-secondary)" }} onMouseEnter={(e) => e.target.style.color = "var(--primary)"} onMouseLeave={(e) => e.target.style.color = "var(--text-secondary)"}>Safety</a>
              <a href="#" style={{ fontSize: "0.875rem", fontWeight: "600", color: "var(--text-secondary)" }} onMouseEnter={(e) => e.target.style.color = "var(--primary)"} onMouseLeave={(e) => e.target.style.color = "var(--text-secondary)"}>Privacy</a>
              <a href="#" style={{ fontSize: "0.875rem", fontWeight: "600", color: "var(--text-secondary)" }} onMouseEnter={(e) => e.target.style.color = "var(--primary)"} onMouseLeave={(e) => e.target.style.color = "var(--text-secondary)"}>Terms</a>
            </nav>
            <span style={{ fontSize: "0.75rem", fontWeight: "700", color: "var(--primary)", backgroundColor: "var(--secondary)", padding: "0.25rem 0.75rem", borderRadius: "9999px", cursor: "default" }} title="Language toggle — coming soon">
              🌐 English ▾
            </span>
          </div>
          <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "2rem" }}>
            © {new Date().getFullYear()} EduLink. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
