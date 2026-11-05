import { NextResponse } from "next/server";
import { askJev } from "@/lib/jev";
import { errorResponse, parseTurn } from "@/lib/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const turn = parseTurn(await request.json());
    const result = await askJev(turn);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
