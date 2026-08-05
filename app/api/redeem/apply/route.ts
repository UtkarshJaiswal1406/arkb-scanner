import { NextResponse } from "next/server";
import { redeemCoupon } from "@/lib/coupons";

const QR_PATTERN = /^[a-zA-Z0-9]{10}$/;

export async function POST(request: Request) {
  let code = "";
  try {
    const body = await request.json();
    code = typeof body?.code === "string" ? body.code.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!QR_PATTERN.test(code)) {
    return NextResponse.json({ error: "Invalid coupon code" }, { status: 400 });
  }

  // Marks the coupon as scanned. Called when the discount is actually applied.
  const result = await redeemCoupon(code);

  if (result.ok) {
    return NextResponse.json({
      coupon: {
        coupon_code: result.coupon.coupon_code,
        discount: result.coupon.discount,
        status: result.coupon.status,
      },
    });
  }

  if (result.reason === "not_found") {
    return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
  }

  return NextResponse.json({ error: "Coupon already used" }, { status: 409 });
}
