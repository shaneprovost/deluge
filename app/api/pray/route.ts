import { NextRequest, NextResponse } from "next/server";
import { PrayRequestSchema } from "@/lib/validation/schemas";
import { prayersRepository } from "@/lib/db/prayers";
import { deceasedRepository } from "@/lib/db/deceased";
import { checkRateLimitPray, incrementRateLimitPray } from "@/lib/db/rate-limit";
import { getSessionId, getIpHash } from "@/lib/utils/hash";
import { PRAYER_COOLDOWN_SECONDS } from "@/config/constants";

export async function POST(request: NextRequest) {
  try {
    const sessionId = getSessionId(request);
    const ipHash = getIpHash(request);

    const rate = await checkRateLimitPray(sessionId, ipHash);
    if (!rate.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RATE_LIMITED" as const,
            message: "You have exceeded the prayer submission limit. Please try again later.",
            retryAfterSeconds: rate.retryAfterSeconds,
          },
        },
        { status: 429, headers: rate.retryAfterSeconds ? { "Retry-After": String(rate.retryAfterSeconds) } : undefined }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR" as const,
            message: "Invalid JSON body.",
            details: [],
          },
        },
        { status: 400 }
      );
    }

    const result = PrayRequestSchema.safeParse(body);
    if (!result.success) {
      const details = result.error.flatten().fieldErrors;
      const list = Object.entries(details).map(([field, messages]) => ({
        field,
        message: (Array.isArray(messages) ? messages[0] : messages) ?? "Invalid",
      }));
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR" as const,
            message: "Invalid request body",
            details: list,
          },
        },
        { status: 400 }
      );
    }

    const { personId, prayerType } = result.data;
    const person = await deceasedRepository.getById(personId);
    if (!person) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "PERSON_NOT_FOUND" as const,
            message: "The specified person does not exist.",
          },
        },
        { status: 404 }
      );
    }

    const prayer = await prayersRepository.create({
      personId,
      cemeteryId: person.cemeteryId,
      prayerType,
      sessionId,
      ipAddressHash: ipHash,
      userAgent: request.headers.get("user-agent") ?? undefined,
    });

    await incrementRateLimitPray(sessionId, ipHash);

    const createdAt = new Date(prayer.createdAt);
    const canRequestAt = new Date(createdAt.getTime() + PRAYER_COOLDOWN_SECONDS * 1000);

    return NextResponse.json(
      {
        success: true,
        data: {
          prayerId: prayer.prayerId,
          personId: prayer.personId,
          prayerType: prayer.prayerType,
          createdAt: prayer.createdAt,
        },
        meta: {
          cooldownSeconds: PRAYER_COOLDOWN_SECONDS,
          canRequestNewAssignmentAt: canRequestAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/pray error:", err);
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
