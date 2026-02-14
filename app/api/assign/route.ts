import { NextRequest, NextResponse } from "next/server";
import { getPersonToAssign } from "@/lib/db/assignment";
import { checkRateLimitAssign } from "@/lib/db/rate-limit";
import { getSessionId, getIpHash } from "@/lib/utils/hash";
import { cemeteriesRepository } from "@/lib/db/cemeteries";

export async function GET(request: NextRequest) {
  try {
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
    console.error("GET /api/assign error:", err);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR" as const,
          message: "An unexpected error occurred.",
        },
      },
      { status: 500 }
    );
  }
}
