import { NextResponse } from "next/server";
import { askFable } from "@/lib/fable";
import { errorResponse, parseTurn } from "@/lib/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Fable may retry twice on an illegal move; allow room for three 30s calls.
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const turn = parseTurn(await request.json());
    const result = await askFable(turn);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
