import { NextRequest, NextResponse } from "next/server";
import { getPersonToAssign } from "@/lib/db/assignment";
import { checkRateLimitAssign } from "@/lib/db/rate-limit";
import { getSessionId, getIpHash } from "@/lib/utils/hash";
import { cemeteriesRepository } from "@/lib/db/cemeteries";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    if (!process.env.DYNAMODB_TABLE_PREFIX) {
      console.error("GET /api/assign: DYNAMODB_TABLE_PREFIX is not set");
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INTERNAL_ERROR" as const,
            message: "Server configuration error: DYNAMODB_TABLE_PREFIX is not set. Set it in .env.local (e.g. deluge-staging).",
          },
        },
        { status: 500 }
      );
    }
    const sessionId = getSessionId(request);
    const ipHash = getIpHash(request);

    const rate = await checkRateLimitAssign(sessionId, ipHash);
    if (!rate.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RATE_LIMITED" as const,
            message: "Please wait before requesting another assignment.",
            retryAfterSeconds: rate.retryAfterSeconds,
          },
        },
        { status: 429, headers: rate.retryAfterSeconds ? { "Retry-After": String(rate.retryAfterSeconds) } : undefined }
      );
    }

    const person = await getPersonToAssign();
    if (!person) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "NO_CANDIDATES" as const,
            message: "No prayer candidates available at this time.",
          },
        },
        { status: 503 }
      );
    }

    const cemetery = await cemeteriesRepository.getById(person.cemeteryId);
    if (!cemetery) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INTERNAL_ERROR" as const,
            message: "Cemetery not found for assigned person.",
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        personId: person.personId,
        firstName: person.firstName,
        lastInitial: person.lastInitial,
        yearOfDeath: person.yearOfDeath,
        role: person.role,
        cemetery: {
          cemeteryId: cemetery.cemeteryId,
          name: cemetery.name,
          city: cemetery.city,
          state: cemetery.state,
        },
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const isDev = process.env.NODE_ENV !== "production";
    console.error("GET /api/assign error:", err);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR" as const,
          message: isDev ? message : "An unexpected error occurred.",
        },
      },
      { status: 500 }
    );
  }
}
