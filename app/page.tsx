"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Scanner } from "@yudiel/react-qr-scanner";

const QR_PATTERN = /^[a-zA-Z0-9]{10}$/;
const HISTORY_PAGE_SIZE = 6;
const DISCOUNT_OPTIONS = [
  { value: "all" as const, label: "All" },
  { value: 7 as const, label: "7%" },
  { value: 10 as const, label: "10%" },
];

const inr = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(value);

const timeAgo = (ts: number) => {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
};

interface HistoryEntry {
  coupon_code: string;
  discount: number;
  scanned_at: string;
}

function Alert({
  tone,
  children,
}: {
  tone: "error" | "info";
  children: React.ReactNode;
}) {
  const styles = {
    error: "border-danger/30 bg-danger/10 text-danger-600",
    info: "border-info/30 bg-info/10 text-info-600",
  } as const;
  return (
    <div role="alert" className={`rounded-xl border px-4 py-3 text-sm ${styles[tone]}`}>
      {children}
    </div>
  );
}

function DiscountSlider({
  value,
  onChange,
}: {
  value: number | "all";
  onChange: (v: number | "all") => void;
}) {
  const index = Math.max(
    0,
    DISCOUNT_OPTIONS.findIndex((o) => o.value === value)
  );
  const trackPadding = 4;
  const unit = `((100% - ${trackPadding * 2}px) / ${DISCOUNT_OPTIONS.length})`;

  return (
    <div
      role="radiogroup"
      aria-label="Filter by discount"
      className="relative grid grid-cols-3 rounded-xl border border-brand-500/20 bg-brand-500/10 p-1"
    >
      <span
        aria-hidden
        className="absolute inset-y-1 rounded-lg border border-black/5 bg-white shadow-sm will-change-[left,width]"
        style={{
          width: `calc(${unit})`,
          left: `calc(${trackPadding}px + ${index} * ${unit})`,
          transition: "left 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), width 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      />
      {DISCOUNT_OPTIONS.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`relative z-10 rounded-lg py-1.5 text-sm font-semibold transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 ${
              active
                ? "text-brand-600"
                : "text-foreground/50 hover:text-foreground"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Section({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-white/60 bg-white p-5 shadow-sm shadow-black/5 sm:p-6 ${className}`}
    >
      {children}
    </section>
  );
}

function HistoryPanel({
  history,
  loading,
}: {
  history: HistoryEntry[];
  loading: boolean;
}) {
  const [query, setQuery] = useState("");
  const [discountFilter, setDiscountFilter] = useState<number | "all">("all");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = history.filter(
      (h) =>
        (q ? h.coupon_code.toLowerCase().includes(q) : true) &&
        (discountFilter === "all" || h.discount === discountFilter)
    );
    return [...list].sort((a, b) => {
      const ta = Date.parse(a.scanned_at) || 0;
      const tb = Date.parse(b.scanned_at) || 0;
      return tb - ta;
    });
  }, [history, query, discountFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / HISTORY_PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * HISTORY_PAGE_SIZE;
  const visible = filtered.slice(start, start + HISTORY_PAGE_SIZE);

  const resetPage = () => setPage(1);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Search */}
      <div className="mb-3">
        <label htmlFor="history-search" className="sr-only">
          Search coupon code
        </label>
        <div className="relative">
          <input
            id="history-search"
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              resetPage();
            }}
            placeholder="Search coupon code…"
            className="h-11 w-full rounded-xl border border-black/10 bg-white px-4 pr-16 text-sm text-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                resetPage();
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2.5 py-1 text-xs font-semibold text-brand-600 transition hover:bg-brand-500/10 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Discount filter: sliding toggle (All / 7% / 10%) */}
      <div className="mb-4">
        <DiscountSlider
          value={discountFilter}
          onChange={(v) => {
            setDiscountFilter(v);
            resetPage();
          }}
        />
      </div>

      {/* List */}
      <div className="thin-scrollbar min-h-0 max-h-[55vh] flex-1 overflow-y-auto pr-1 md:max-h-none">
        {loading ? (
          <div className="flex flex-col gap-2.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-black/15 px-4 py-10 text-center">
            <p className="text-sm font-semibold text-foreground/70">No coupons yet</p>
            <p className="text-xs text-foreground/50">
              Scanned coupons will appear here.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-foreground/50">
            No coupons match your search.
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {visible.map((entry, i) => (
              <li
                key={entry.coupon_code}
                style={{ animationDelay: `${Math.min(i, 6) * 45}ms` }}
                className="animate-fade-up flex items-center justify-between gap-3 rounded-xl border border-black/5 bg-white p-3.5 shadow-sm transition-shadow duration-300 hover:shadow-md"
              >
                <div className="min-w-0">
                  <p className="truncate font-mono text-sm font-bold tracking-wide text-foreground">
                    {entry.coupon_code}
                  </p>
                  <p className="mt-0.5 text-xs text-foreground/40">
                    {entry.scanned_at
                      ? timeAgo(new Date(entry.scanned_at).getTime())
                      : "Scanned"}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-brand-500/15 px-2.5 py-1 text-xs font-bold text-brand-600">
                  {entry.discount}%
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer: results + pagination */}
      {!loading && history.length > 0 && (
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-black/10 pt-3">
          <p aria-live="polite" className="text-xs text-foreground/50">
            {filtered.length} result{filtered.length === 1 ? "" : "s"}
          </p>
          {pageCount > 1 ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage(safePage - 1)}
                disabled={safePage <= 1}
                className="rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-foreground/70 transition hover:border-brand-500 hover:text-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:opacity-40"
              >
                Prev
              </button>
              <span className="text-xs text-foreground/60">
                {safePage} / {pageCount}
              </span>
              <button
                type="button"
                onClick={() => setPage(safePage + 1)}
                disabled={safePage >= pageCount}
                className="rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-foreground/70 transition hover:border-brand-500 hover:text-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          ) : (
            <span className="text-xs text-foreground/40">All results shown</span>
          )}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [code, setCode] = useState<string>("");
  const [discountPercent, setDiscountPercent] = useState<number | null>(null);
  const [amount, setAmount] = useState<string>("");
  const [discountedAmount, setDiscountedAmount] = useState<number | null>(null);
  const [isScanned, setIsScanned] = useState(false);
  const [checking, setChecking] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string>("");
  const [manualMode, setManualMode] = useState(false);
  const [manualCode, setManualCode] = useState("");

  const scanningRef = useRef(false);
  const lastScannedRef = useRef("");

  const refreshHistory = useCallback(async () => {
    try {
      const response = await fetch("/api/coupons");
      const payload = await response.json().catch(() => ({}));
      if (response.ok && Array.isArray(payload?.coupons)) {
        setHistory(payload.coupons);
      }
    } catch {
      /* ignore */
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshHistory(), 0);
    return () => window.clearTimeout(timer);
  }, [refreshHistory]);

  const redeemCode = useCallback(async (rawValue: string) => {
    const value = rawValue.trim();
    if (!QR_PATTERN.test(value)) {
      setError("Invalid code. Must be a 10-character alphanumeric value.");
      return false;
    }

    if (scanningRef.current) return false;
    scanningRef.current = true;
    setError("");
    setChecking(true);

    try {
      const response = await fetch("/api/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: value }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(payload?.error || "Could not redeem coupon.");
        return false;
      }

      setCode(payload.coupon.coupon_code);
      setDiscountPercent(payload.coupon.discount);
      setIsScanned(false);
      setAmount("");
      setDiscountedAmount(null);
      setManualMode(false);
      setManualCode("");
      return true;
    } catch {
      setError("Network error. Please try again.");
      return false;
    } finally {
      scanningRef.current = false;
      setChecking(false);
    }
  }, []);

  const handleScan = useCallback(
    async (detectedCodes: { rawValue: string }[]) => {
      const value = detectedCodes[0]?.rawValue?.trim();
      if (!value) return;
      if (lastScannedRef.current === value) return;
      lastScannedRef.current = value;
      await redeemCode(value);
    },
    [redeemCode]
  );

  const handleScanError = useCallback((err: unknown) => {
    setError(
      err instanceof Error
        ? err.message
        : "Unable to access the camera. Please allow camera permissions."
    );
  }, []);

  const handleManualSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      lastScannedRef.current = "";
      void redeemCode(manualCode);
    },
    [manualCode, redeemCode]
  );

  const applyDiscount = useCallback(async () => {
    const value = parseFloat(amount);
    if (Number.isNaN(value) || value <= 0) {
      setError("Please enter a valid order amount.");
      setDiscountedAmount(null);
      return;
    }

    if (!isScanned) {
      setApplying(true);
      try {
        const response = await fetch("/api/redeem/apply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          setError(payload?.error || "Could not redeem coupon.");
          setDiscountedAmount(null);
          return;
        }
        setIsScanned(true);
      } catch {
        setError("Network error. Please try again.");
        setDiscountedAmount(null);
        return;
      } finally {
        setApplying(false);
      }
    }

    setError("");
    const rate = discountPercent ?? 0;
    const finalAmount = value * (1 - rate / 100);
    setDiscountedAmount(finalAmount);

    await refreshHistory();
  }, [amount, code, discountPercent, isScanned, refreshHistory]);

  const reset = useCallback(() => {
    setCode("");
    setDiscountPercent(null);
    setAmount("");
    setDiscountedAmount(null);
    setIsScanned(false);
    setError("");
    setManualMode(false);
    setManualCode("");
    lastScannedRef.current = "";
  }, []);

  const saved =
    discountedAmount !== null ? (parseFloat(amount) || 0) - discountedAmount : 0;

  return (
    <main className="min-h-screen bg-background text-foreground md:h-screen md:overflow-hidden">
      <div className="mx-auto flex h-full min-h-screen w-full max-w-5xl flex-col px-4 py-6 sm:px-6 md:py-8 lg:px-8 lg:py-10">
        {/* Header */}
        <header className="flex shrink-0 items-center justify-center pb-6 md:pb-8 lg:pb-10">
          <Image
            src="/icon.png"
            alt="ARKB"
            width={192}
            height={60}
            priority
            className="h-12 w-auto sm:h-14"
          />
        </header>

        <div className="grid min-h-0 flex-1 gap-5 md:grid-cols-[minmax(0,1fr)_340px] md:gap-8">
          {/* Left — checkout flow */}
          <section className="mx-auto flex min-h-0 w-full max-w-xl flex-col justify-center md:h-full">
            {!code ? (
              <Section className="animate-fade-up flex min-h-0 flex-col md:flex-1">
                <h2 className="mb-4 shrink-0 text-lg font-bold">Scan a coupon</h2>
                <div className="relative aspect-square min-h-0 w-full overflow-hidden rounded-2xl bg-black md:aspect-auto md:flex-1">
                  <Scanner
                    onScan={handleScan}
                    onError={handleScanError}
                    constraints={{ facingMode: "environment" }}
                    components={{ finder: false, torch: true }}
                    classNames={{
                      container: "h-full w-full",
                      video: "h-full w-full object-cover",
                    }}
                  >
                    <div className="pointer-events-none absolute inset-3">
                      <div className="absolute left-0 top-0 h-10 w-10 rounded-tl-2xl border-l-2 border-t-2 border-white/80" />
                      <div className="absolute right-0 top-0 h-10 w-10 rounded-tr-2xl border-r-2 border-t-2 border-white/80" />
                      <div className="absolute bottom-0 left-0 h-10 w-10 rounded-bl-2xl border-b-2 border-l-2 border-white/80" />
                      <div className="absolute bottom-0 right-0 h-10 w-10 rounded-br-2xl border-b-2 border-r-2 border-white/80" />
                    </div>
                    <div className="pointer-events-none absolute inset-x-0">
                      <span className="scan-line" />
                    </div>
                  </Scanner>
                </div>

                {checking && (
                  <p className="mt-4 shrink-0 text-sm font-medium text-foreground/60">
                    Checking coupon…
                  </p>
                )}
                {error && !checking && (
                  <div className="mt-4 shrink-0">
                    <Alert tone="error">{error}</Alert>
                  </div>
                )}

                <div className="mt-5 shrink-0 border-t border-black/10 pt-5">
                  <button
                    type="button"
                    onClick={() => setManualMode((m) => !m)}
                    className="text-sm font-semibold text-brand-600 underline-offset-4 transition hover:underline focus:outline-none focus:ring-2 focus:ring-brand-500/40 rounded"
                  >
                    {manualMode ? "Hide manual entry" : "Enter the code manually"}
                  </button>

                  {manualMode && (
                    <form onSubmit={handleManualSubmit} className="mt-3 flex animate-fade-in gap-2">
                      <input
                        value={manualCode}
                        onChange={(e) =>
                          setManualCode(e.target.value.toUpperCase().slice(0, 10))
                        }
                        placeholder="AB12CD34EF"
                        maxLength={10}
                        autoFocus
                        aria-label="Coupon code"
                        className="h-11 w-full rounded-xl border border-black/10 bg-white px-4 font-mono text-sm font-bold uppercase tracking-widest text-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
                      />
                      <button
                        type="submit"
                        disabled={manualCode.length !== 10}
                        className="shrink-0 rounded-xl bg-brand-500 px-5 text-sm font-bold text-white shadow-md shadow-brand-500/30 transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-600 hover:shadow-lg active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:opacity-40"
                      >
                        Check
                      </button>
                    </form>
                  )}
                </div>
              </Section>
            ) : (
              <div className="flex animate-fade-up flex-col gap-5">
                <Section className="transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-medium text-foreground/50">Coupon code</p>
                    {discountPercent !== null && (
                      <span className="rounded-full bg-brand-500/15 px-3 py-1 text-xs font-bold text-brand-600">
                        {discountPercent}% off
                      </span>
                    )}
                  </div>
                  <p className="mt-2 break-all font-mono text-2xl font-bold tracking-widest text-foreground">
                    {code}
                  </p>
                  <p className="mt-3 text-sm text-foreground/60">
                    {isScanned ? "Applied" : "Not yet applied"}
                  </p>
                </Section>

                <Section className="animate-fade-up transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
                  <label
                    htmlFor="order-amount"
                    className="mb-2 block text-sm font-semibold"
                  >
                    Order amount <span className="text-foreground/40">(INR)</span>
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-foreground/40">
                      ₹
                    </span>
                    <input
                      id="order-amount"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={amount}
                      onChange={(e) => {
                        setAmount(e.target.value);
                        setDiscountedAmount(null);
                      }}
                      placeholder="0"
                      autoFocus
                      className="h-12 w-full rounded-xl border border-black/10 bg-white py-3 pl-10 pr-4 text-lg font-semibold text-foreground outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={applyDiscount}
                    disabled={applying || !amount}
                    className="mt-4 flex h-12 w-full items-center justify-center rounded-xl bg-brand-500 text-base font-bold text-white shadow-lg shadow-brand-500/30 transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-600 hover:shadow-xl hover:shadow-brand-500/40 active:translate-y-0 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {applying ? "Applying discount…" : "Apply discount"}
                  </button>

                  {discountedAmount !== null && discountPercent !== null && (
                    <div className="mt-5 animate-pop rounded-xl border border-success/30 bg-success/10 p-5 text-center">
                      <p className="text-xs font-bold uppercase tracking-widest text-success-600">
                        {discountPercent}% discount applied
                      </p>
                      <p className="mt-2 text-4xl font-extrabold tracking-tight text-foreground">
                        {inr(discountedAmount)}
                      </p>
                      <div className="mt-2 text-sm text-foreground/50">
                        <span className="line-through">
                          {inr(parseFloat(amount) || 0)}
                        </span>{" "}
                        → <span className="font-semibold text-foreground">{inr(discountedAmount)}</span>
                      </div>
                      <p className="mt-3 inline-block rounded-full bg-success/15 px-3 py-1 text-xs font-bold text-success-600">
                        You saved {inr(saved)}
                      </p>
                    </div>
                  )}

                  {error && (
                    <div className="mt-4">
                      <Alert tone="error">{error}</Alert>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={reset}
                    className="mt-5 h-11 w-full rounded-xl border border-black/10 text-sm font-semibold text-foreground/70 transition-all duration-200 hover:-translate-y-0.5 hover:border-black/20 hover:bg-black/5 active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                  >
                    Scan a different QR code
                  </button>
                </Section>
              </div>
            )}
          </section>

          {/* Right — history (desktop / tablet: md+) */}
          <aside className="hidden min-h-0 flex-col rounded-2xl border border-white/60 bg-white p-5 shadow-sm shadow-black/5 md:flex md:h-full md:overflow-hidden">
            <h2 className="mb-4 shrink-0 text-lg font-bold">Scanned history</h2>
            <HistoryPanel history={history} loading={historyLoading} />
          </aside>

          {/* Mobile history (below md) */}
          <div className="min-h-0 md:hidden">
            <Section>
              <button
                type="button"
                onClick={() => setHistoryOpen((o) => !o)}
                aria-expanded={historyOpen}
                className="flex w-full items-center justify-between gap-2 focus:outline-none focus:ring-2 focus:ring-brand-500/40 rounded"
              >
                <span className="text-lg font-bold">Scanned history</span>
                <span className="text-sm font-semibold text-brand-600">
                  {historyOpen ? "Hide" : "Show"}
                </span>
              </button>
              {historyOpen && (
                <div className="mt-4">
                  <HistoryPanel history={history} loading={historyLoading} />
                </div>
              )}
            </Section>
          </div>
        </div>
      </div>
    </main>
  );
}