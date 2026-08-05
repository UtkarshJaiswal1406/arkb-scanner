import { NextResponse } from "next/server";
import { listScannedCoupons } from "@/lib/coupons";

export const dynamic = "force-dynamic";

export async function GET() {
  const coupons = await listScannedCoupons();
  return NextResponse.json({
    coupons: coupons.map((c) => ({
      coupon_code: c.coupon_code,
      discount: c.discount,
      scanned_at: c.scanned_at,
    })),
  });
}
