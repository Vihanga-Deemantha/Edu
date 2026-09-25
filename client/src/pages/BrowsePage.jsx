import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import Icon from "../components/ui/Icon.jsx";
import ListingCard, { ListingCardSkeleton } from "../components/ListingCard.jsx";
import { EmptyState, Pagination } from "../components/ui/index.jsx";
import useAsync from "../hooks/useAsync.js";
import useAuth from "../hooks/useAuth.js";
import { listingsApi, searchApi } from "../api/endpoints.js";
import { CURRICULA, GRADES, MEDIUMS, SUBJECTS, apiError, formatNumber } from "../lib/format.js";

const PER_PAGE = 12;
const PRICE_MAX = 10000; // slider ceiling; at the ceiling the filter is off
const RADII = [5, 10, 25, 50];
const SORTS = [
  ["recommended", "Recommended"],
  ["rating", "Highest rated"],
  ["price", "Lowest price"],
  ["distance", "Nearest"],
  ["newest", "Newest"],
];

const FilterGroup = ({ title, aside, children }) => (
  <div className="flex flex-col gap-2.5 border-t border-mist py-3.5">
    <div className="flex justify-between">
      <span className="text-[13px] font-bold tracking-[.08em] text-ink-2">{title}</span>
      {aside}
    </div>
    {children}
  </div>
);

const PillGroup = ({ options, value, onChange }) => (
  <div className="flex flex-wrap gap-1.5">
    {options.map((o) => {
      const opt = typeof o === "string" ? { value: o, label: o } : o;
      const on = value === opt.value;
      return (
        <button key={opt.value} type="button" aria-pressed={on} onClick={() => onChange(on ? "" : opt.value)} className={`chip ${on ? "on" : ""}`}>
          {opt.label}
        </button>
      );
    })}
  </div>
);

const Toggle = ({ label, on, onChange }) => (
  <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="flex w-full items-center justify-between border-0 bg-transparent p-0">
    <span className="text-[15px] font-semibold text-ink">{label}</span>
    <span className="relative h-[22px] w-10 rounded-full transition-colors" style={{ background: on ? "var(--primary)" : "var(--lavender)" }}>
      <span className="absolute top-[3px] h-4 w-4 rounded-full bg-white transition-all" style={{ left: on ? 21 : 3 }} />
    </span>
  </button>
);

const BrowsePage = () => {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [coords, setCoords] = useState(null);

  // Everything lives in the URL so a search is shareable and back/forward works.
  const f = {
    q: params.get("q") || "",
    subject: params.get("subject") || "",
    grade: params.get("grade") || "",
    medium: params.get("medium") || "",
    curriculum: params.get("curriculum") || "",
    maxPrice: Number(params.get("maxPrice")) || PRICE_MAX,
    near: params.get("near") === "1",
    radius: Number(params.get("radius")) || 10,
    sort: params.get("sort") || "recommended",
    page: Number(params.get("page")) || 1,
  };
  const [query, setQuery] = useState(f.q);
  const [syncedQ, setSyncedQ] = useState(f.q);
  if (syncedQ !== f.q) {
    setSyncedQ(f.q);
    setQuery(f.q);
  }

  const update = (patch, { keepPage = false } = {}) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => {
      if (v === "" || v === null || v === undefined || v === false) next.delete(k);
      else next.set(k, v === true ? "1" : String(v));
    });
    if (!keepPage) next.delete("page");
    setParams(next);
  };

  // "Near me" needs the browser's location before it can filter.
  useEffect(() => {
    if (!f.near || coords) return;
    if (!navigator.geolocation) {
      toast.error("Your browser can't share a location.");
      update({ near: false });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {
        toast.error("Location permission was denied, so “Near me” is off.");
        update({ near: false });
      },
      { timeout: 10000 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.near, coords]);

  const structured = {
    subject: f.subject || undefined,
    grade: f.grade || undefined,
    medium: f.medium || undefined,
    curriculum: f.curriculum || undefined,
    maxPrice: f.maxPrice < PRICE_MAX ? f.maxPrice : undefined,
  };
  const waitingForLocation = f.near && !coords;
  const key = JSON.stringify({ ...structured, q: f.q, near: f.near, radius: f.radius, coords, sort: f.sort, page: f.page });

  const { data, loading, error, reload } = useAsync(
    () =>
      f.q
        ? searchApi.semantic({ query: f.q, ...structured, page: f.page, limit: PER_PAGE })
        : listingsApi.browse({
            ...structured,
            ...(f.near && coords ? { lat: coords.lat, lng: coords.lng, radiusKm: f.radius } : {}),
            sort: f.sort === "distance" && !(f.near && coords) ? "newest" : f.sort,
            page: f.page,
            limit: PER_PAGE,
          }),
    [key],
    { enabled: !waitingForLocation }
  );

  const chips = useMemo(() => {
    const list = [];
    ["subject", "grade", "medium", "curriculum"].forEach((k) => {
      if (f[k]) {
        const label =
          k === "medium" ? MEDIUMS.find((m) => m.value === f[k])?.label : k === "curriculum" ? CURRICULA.find((c) => c.value === f[k])?.label : f[k];
        list.push({ label, clear: { [k]: "" } });
      }
    });
    if (f.maxPrice < PRICE_MAX) list.push({ label: `Under LKR ${formatNumber(f.maxPrice)}`, clear: { maxPrice: "" } });
    if (f.near) list.push({ label: `Within ${f.radius} km`, clear: { near: false, radius: "" } });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const resetAll = () => setParams(new URLSearchParams());
  const total = data?.pagination?.total ?? 0;
  const listings = data?.listings || [];
  const busy = loading || waitingForLocation;
  const first = (f.page - 1) * PER_PAGE + 1;
  const wantedAdLink = user ? "/listings/new" : "/register";

  return (
    <>
      <section className="bg-mist">
        <div className="shell flex flex-col gap-[18px] pb-9 pt-10">
          <h1 style={{ font: "400 clamp(34px,3.6vw,46px)/1.05 var(--font-display)", letterSpacing: "-.015em" }}>
            {user?.role === "teacher" ? "Browse classes and student requests" : "Find a teacher"}
          </h1>
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              update({ q: query.trim() });
            }}
            className="flex max-w-[820px] items-center rounded-xl border-[1.5px] bg-white py-1.5 pl-[18px] pr-1.5 focus-within:border-primary"
            style={{ borderColor: "var(--lavender)", boxShadow: "0 10px 26px -16px rgba(61,82,160,.45)" }}
          >
            <Icon name="search" size={21} strokeWidth={2} className="text-primary" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Describe what you need, e.g. O/L maths tutor near Kandy, weekends only"
              aria-label="Describe what you need"
              className="min-w-0 flex-1 border-0 bg-transparent p-3 text-base font-medium text-ink outline-none"
            />
            {query && (
              <button type="button" onClick={() => { setQuery(""); update({ q: "" }); }} className="border-0 bg-transparent px-2.5 py-2 text-[13px] font-semibold text-ink-2">
                Clear
              </button>
            )}
            <button type="submit" className="btn btn-primary px-[22px] py-[13px]">Search</button>
          </form>
          <span className="text-sm text-ink-2">Search in plain words, then narrow down with filters. Guests see the same results as members.</span>
        </div>
      </section>

      <div className="shell flex flex-wrap items-start gap-8 pb-20 pt-8">
        {filtersOpen && (
          <aside className="card flex flex-col px-5 pb-5 pt-1.5" style={{ flex: "1 1 240px", maxWidth: 300, minWidth: 230 }} aria-label="Filters">
            <div className="flex items-center justify-between pb-3 pt-4">
              <span className="serif text-xl font-bold">Filters</span>
              <button type="button" onClick={resetAll} className="border-0 bg-transparent text-[13px] font-semibold text-primary">Reset all</button>
            </div>
            <FilterGroup title="SUBJECT">
              <select className="select" value={f.subject} onChange={(e) => update({ subject: e.target.value })} aria-label="Subject">
                <option value="">Any subject</option>
                {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </FilterGroup>
            <FilterGroup title="LEVEL">
              <PillGroup options={GRADES} value={f.grade} onChange={(v) => update({ grade: v })} />
            </FilterGroup>
            <FilterGroup title="MEDIUM">
              <PillGroup options={MEDIUMS} value={f.medium} onChange={(v) => update({ medium: v })} />
            </FilterGroup>
            <FilterGroup title="CURRICULUM">
              <PillGroup options={CURRICULA} value={f.curriculum} onChange={(v) => update({ curriculum: v })} />
            </FilterGroup>
            <FilterGroup title="MAX PRICE" aside={<span className="text-[13px] font-semibold">{f.maxPrice >= PRICE_MAX ? "Any" : `LKR ${formatNumber(f.maxPrice)}`}</span>}>
              <input
                type="range"
                min={1000}
                max={PRICE_MAX}
                step={250}
                value={f.maxPrice}
                onChange={(e) => update({ maxPrice: Number(e.target.value) >= PRICE_MAX ? "" : e.target.value })}
                className="w-full"
                style={{ accentColor: "var(--primary)" }}
                aria-label="Maximum price"
              />
            </FilterGroup>
            {!f.q && (
              <div className="flex flex-col gap-3 border-t border-mist py-3.5">
                <Toggle label="Near me" on={f.near} onChange={(on) => update({ near: on, sort: on ? "distance" : f.sort === "distance" ? "" : f.sort })} />
                {f.near && (
                  <>
                    <div className="flex gap-1.5">
                      {RADII.map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => update({ radius: r })}
                          className="flex-1 rounded-lg border py-1.5 text-[13px] font-semibold"
                          style={{
                            borderColor: f.radius === r ? "var(--primary)" : "var(--line)",
                            background: f.radius === r ? "var(--mist)" : "#fff",
                            color: f.radius === r ? "var(--primary)" : "var(--ink)",
                          }}
                        >
                          {r} km
                        </button>
                      ))}
                    </div>
                    <span className="text-xs text-ink-2">{coords ? "Using your current location" : "Waiting for location permission…"}</span>
                  </>
                )}
              </div>
            )}
          </aside>
        )}

        <section className="flex min-w-0 flex-col gap-[18px]" style={{ flex: "999 1 440px" }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="serif text-[26px]" aria-live="polite">
                {busy ? "Searching…" : `${total} ${total === 1 ? "result" : "results"}`}
              </span>
              {f.q && <span className="text-[13px] text-ink-2">Matching “{f.q}”</span>}
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <button type="button" onClick={() => setFiltersOpen((o) => !o)} className="btn btn-soft btn-sm h-10">
                <Icon name="filter" size={16} />
                {filtersOpen ? "Hide filters" : "Show filters"}
                {chips.length ? ` (${chips.length})` : ""}
              </button>
              {!f.q && (
                <label className="flex items-center gap-2.5 text-sm text-ink-2">
                  Sort by
                  <select className="select h-10 w-auto text-sm font-semibold" value={f.sort} onChange={(e) => update({ sort: e.target.value, ...(e.target.value === "distance" && !f.near ? { near: true } : {}) })}>
                    {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </label>
              )}
            </div>
          </div>

          {chips.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {chips.map((c) => (
                <button key={c.label} type="button" onClick={() => update(c.clear)} className="flex items-center gap-2 rounded-full border-0 bg-primary py-1.5 pl-3 pr-2 text-[13px] font-semibold text-white">
                  {c.label}
                  <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-white/20" aria-label={`Remove ${c.label}`}>
                    <Icon name="x" size={11} strokeWidth={2.6} />
                  </span>
                </button>
              ))}
            </div>
          )}

          {busy ? (
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))" }}>
              {Array.from({ length: 6 }, (_, i) => <ListingCardSkeleton key={i} />)}
            </div>
          ) : error ? (
            <div className="card">
              <EmptyState icon="alert" title="We couldn't load results" action={<button type="button" className="btn btn-primary" onClick={reload}>Try again</button>}>
                {apiError(error)}
              </EmptyState>
            </div>
          ) : listings.length === 0 ? (
            <div className="flex flex-col items-center gap-3.5 rounded-2xl border border-dashed bg-white px-8 py-14 text-center" style={{ borderColor: "var(--lavender)" }}>
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-mist text-primary"><Icon name="search" size={26} /></span>
              <span className="serif text-[28px]">Nothing matches these filters</span>
              <span className="max-w-[420px] text-[15px] leading-normal text-ink-2">
                Try removing a filter, raising the price limit, or widening the distance. You can also post a wanted ad and let teachers find you.
              </span>
              <div className="mt-1.5 flex flex-wrap justify-center gap-2.5">
                <button type="button" className="btn btn-primary" onClick={resetAll}>Clear all filters</button>
                {user?.role !== "teacher" && <Link to={wantedAdLink} className="btn btn-outline">Post a wanted ad</Link>}
              </div>
            </div>
          ) : (
            <>
              <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))" }}>
                {listings.map((l) => <ListingCard key={l._id} listing={l} />)}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
                <span className="text-sm text-ink-2">
                  Showing {first}–{Math.min(first + listings.length - 1, total)} of {total}
                </span>
                <Pagination page={f.page} limit={PER_PAGE} total={total} onChange={(p) => { update({ page: p }, { keepPage: true }); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
};

export default BrowsePage;
