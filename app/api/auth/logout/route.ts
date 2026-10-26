import { NextResponse } from "next/server";

/**
 * Authentication Logout Endpoint
 * POST /api/auth/logout
 *
 * Clears session cookies and returns confirmation.
 */
export async function POST() {
  const res = NextResponse.json({
    success: true,
    message: "Signed out successfully",
  });

  res.cookies.delete("jansahayak_user_id");
  res.cookies.delete("jansahayak_role");

  return res;
}

export async function GET() {
  return POST();
}
