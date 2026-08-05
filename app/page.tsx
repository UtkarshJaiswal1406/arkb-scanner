"use client";

import { useCallback, useRef, useState } from "react";
import { Scanner } from "@yudiel/react-qr-scanner";

const QR_PATTERN = /^[a-zA-Z0-9]{10}$/;

const inr = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(value);

interface HistoryEntry {
  id: string;
  code: string;
  discount: number;
  amount: number;
  discountedAmount: number;
  scannedAt: number;
}

export default function Home() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [code, setCode] = useState<string>("");
  const [discountPercent, setDiscountPercent] = useState<number | null>(null);
  const [amount, setAmount] = useState<string>("");
  const [discountedAmount, setDiscountedAmount] = useState<number | null>(null);
  const [isScanned, setIsScanned] = useState(false);
  const [checking, setChecking] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string>("");

  const scanningRef = useRef(false);
  const lastScannedRef = useRef("");

  const handleScan = useCallback(
    async (detectedCodes: { rawValue: string }[]) => {
      const value = detectedCodes[0]?.rawValue?.trim();
      if (!value) return;

      // The scanner fires repeatedly for the same QR; ignore duplicates.
      if (lastScannedRef.current === value) return;
      lastScannedRef.current = value;

      if (!QR_PATTERN.test(value)) {
        setError("Invalid QR code. Expected a 10-character alphanumeric value.");
        return;
      }

      if (scanningRef.current) return;
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
          return;
        }

        setCode(payload.coupon.coupon_code);
        setDiscountPercent(payload.coupon.discount);
        setIsScanned(false);
        setAmount("");
        setDiscountedAmount(null);
      } catch {
        setError("Network error. Please try again.");
      } finally {
        scanningRef.current = false;
        setChecking(false);
      }
    },
    []
  );

  const handleScanError = useCallback((err: unknown) => {
    setError(
      err instanceof Error
        ? err.message
        : "Unable to access the camera. Please allow camera permissions.",
    );
  }, []);

  const applyDiscount = useCallback(async () => {
    const value = parseFloat(amount);
    if (Number.isNaN(value) || value <= 0) {
      setError("Please enter a valid order amount.");
      setDiscountedAmount(null);
      return;
    }

    // Mark the coupon as scanned the first time the discount is applied.
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

    const now = Date.now();
    setHistory((prev) =>
      [
        {
          id: `${code}-${now}`,
          code: code || "unknown",
          discount: rate,
          amount: value,
          discountedAmount: finalAmount,
          scannedAt: now,
        },
        ...prev,
      ].slice(0, 50)
    );
  }, [amount, code, discountPercent, isScanned]);

  const reset = useCallback(() => {
    setCode("");
    setDiscountPercent(null);
    setAmount("");
    setDiscountedAmount(null);
    setIsScanned(false);
    setError("");
    lastScannedRef.current = "";
  }, []);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col items-start gap-8 px-4 py-8 lg:flex-row lg:justify-center">
      <div className="flex w-full max-w-md flex-col items-center gap-5">
      <h1 className="text-3xl font-bold">QR Discount Scanner</h1>

      {!code ? (
        <section className="w-full rounded-2xl bg-white/90 p-5 shadow-lg">
          <h2 className="mb-2 text-center font-semibold">
            Scan a QR code using your camera
          </h2>
          <div className="overflow-hidden rounded-xl bg-black">
            <Scanner
              onScan={handleScan}
              onError={handleScanError}
              constraints={{ facingMode: "environment" }}
            />
          </div>
          {error && <p className="mt-3 text-center text-sm font-medium text-red-600">{error}</p>}
        </section>
      ) : (
        <section className="flex w-full flex-col items-center gap-4 rounded-2xl bg-white/90 p-5 shadow-lg">
          <div className="w-full rounded-xl border border-black/10 bg-white p-4 text-center">
            <p className="text-sm font-medium text-black/60">Coupon code:</p>
            <p className="mt-1 break-all font-mono text-xl font-semibold text-black">
              {code}
            </p>
            {discountPercent !== null && (
              <p className="mt-2 inline-block rounded-full bg-green-600/10 px-3 py-1 text-sm font-semibold text-green-700">
                {discountPercent}% discount
              </p>
            )}
          </div>

          <label className="w-full">
            <span className="mb-1 block text-sm font-semibold">Order amount (INR)</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setDiscountedAmount(null);
              }}
              placeholder="e.g. 1000"
              className="w-full rounded-xl border border-black/20 bg-white px-4 py-3 text-lg text-black outline-none transition focus:border-black focus:ring-2 focus:ring-black/10"
            />
          </label>

          <button
            type="button"
            onClick={applyDiscount}
            disabled={applying}
            className="w-full rounded-xl bg-black px-4 py-3 text-lg font-semibold text-white shadow transition hover:bg-black/80 active:scale-[0.98] disabled:opacity-60"
          >
            {applying ? "Applying discount..." : "Apply discount"}
          </button>

          {discountedAmount !== null && discountPercent !== null && (
            <div className="my-2 w-full rounded-xl border-2 border-green-600/30 bg-green-50 p-4 text-center">
              <p className="text-sm font-semibold text-green-700">
                {discountPercent}% discount applied
              </p>
              <p className="text-3xl font-bold text-green-600">
                {inr(discountedAmount)}
              </p>
              <p className="mt-1 text-xs font-medium text-black/50">
                You saved {inr((parseFloat(amount) || 0) - discountedAmount)}
              </p>
            </div>
          )}

          {checking && (
            <p className="text-sm font-medium text-black/60">Redeeming coupon...</p>
          )}

          {error && <p className="text-sm font-medium text-red-600">{error}</p>}

          <button
            type="button"
            onClick={reset}
            className="text-sm font-medium text-black/60 underline transition hover:text-black"
          >
            Scan a different QR code
          </button>
        </section>
      )}
      </div>

      <aside className="w-full max-w-md shrink-0 rounded-2xl bg-white/90 p-5 shadow-lg lg:sticky lg:top-8 lg:w-80">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Scanned history</h2>
          <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-semibold text-black/50">
            {history.length}
          </span>
        </div>

        {history.length === 0 ? (
          <p className="text-sm font-medium text-black/50">
            No coupons scanned yet. Scan a QR code to see the history here.
          </p>
        ) : (
          <ul className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto pr-1">
            {history.map((entry) => (
              <li
                key={entry.id}
                className="rounded-xl border border-black/10 bg-white p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="break-all font-mono text-sm font-semibold text-black">
                    {entry.code}
                  </p>
                  <span className="shrink-0 rounded-full bg-green-600/10 px-2 py-0.5 text-xs font-semibold text-green-700">
                    {entry.discount}% off
                  </span>
                </div>
                <div className="mt-2 flex items-end justify-between gap-2">
                  <div className="text-xs font-medium text-black/50">
                    <p>
                      {inr(entry.amount)}{" "}
                      <span className="line-through text-black/30">
                        → {inr(entry.discountedAmount)}
                      </span>
                    </p>
                    <p className="mt-0.5">
                      {new Date(entry.scannedAt).toLocaleString()}
                    </p>
                  </div>
                  <p className="text-base font-bold text-green-600">
                    {inr(entry.discountedAmount)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </main>
  );
}
