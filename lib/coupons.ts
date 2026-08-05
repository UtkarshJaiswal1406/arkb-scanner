import { createClient } from "@supabase/supabase-js";

// Service-role client (server-side only). Bypasses RLS. NEVER expose this key
// to the client.
export const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  {
    auth: { persistSession: false, autoRefreshToken: false },
  }
);

export interface CouponRow {
  id: string;
  user_registration_number: string;
  restaurant_id: string | null;
  coupon_code: string;
  discount: number;
  status: string;
  generated_at: string;
  scanned_at: string | null;
}

export type LookupResult =
  | { ok: true; coupon: CouponRow }
  | { ok: false; reason: "not_found" | "already_used" };

export async function lookupCoupon(code: string): Promise<LookupResult> {
  // Codes are generated uppercase; normalize the scanned value before lookup.
  const normalized = code.trim().toUpperCase();

  const { data, error } = await supabase
    .from("coupons")
    .select("*")
    .eq("coupon_code", normalized)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { ok: false, reason: "not_found" };
  if (data.status === "scanned") {
    return { ok: false, reason: "already_used" };
  }
  return { ok: true, coupon: data as CouponRow };
}

export type RedeemResult =
  | { ok: true; coupon: CouponRow }
  | { ok: false; reason: "not_found" | "already_used" };

// Returns all coupons that have been scanned, most recently scanned first.
export async function listScannedCoupons(limit = 100): Promise<CouponRow[]> {
  const { data, error } = await supabase
    .from("coupons")
    .select("*")
    .eq("status", "scanned")
    .order("scanned_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as CouponRow[];
}

// Marks an unscanned coupon as scanned (atomically, guarded against double
// scans). Should be called only when the discount is actually applied.
export async function redeemCoupon(code: string): Promise<RedeemResult> {
  const normalized = code.trim().toUpperCase();

  const lookup = await lookupCoupon(normalized);
  if (!lookup.ok) return lookup;

  const { data: updated, error: updateError } = await supabase
    .from("coupons")
    .update({
      status: "scanned",
      scanned_at: new Date().toISOString(),
    })
    .eq("coupon_code", normalized)
    .eq("status", "unscanned")
    .select("*")
    .single();

  if (updateError) throw updateError;
  if (!updated) return { ok: false, reason: "already_used" };

  return { ok: true, coupon: updated as CouponRow };
}