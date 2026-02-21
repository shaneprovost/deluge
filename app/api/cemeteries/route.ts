import { NextRequest, NextResponse } from "next/server";
import { cemeteriesRepository } from "@/lib/db/cemeteries";
import { CemeteriesQuerySchema } from "@/lib/validation/schemas";
import type { CemeteryWithStats, CemeteryStats } from "@/lib/types";
import { DEFAULT_ARCHDIOCESE } from "@/config/constants";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = CemeteriesQuerySchema.safeParse({
      archdiocese: searchParams.get("archdiocese") ?? DEFAULT_ARCHDIOCESE,
    });
    const archdiocese = parsed.success ? parsed.data.archdiocese : DEFAULT_ARCHDIOCESE;

    const cemeteries = await cemeteriesRepository.listByArchdiocese(archdiocese);
    const data: CemeteryWithStats[] = cemeteries.map((c) => ({
      cemeteryId: c.cemeteryId,
      name: c.name,
      city: c.city,
      state: c.state,
      latitude: c.latitude,
      longitude: c.longitude,
      stats: {
        totalDeceased: c.totalDeceased,
        uniquePrayedFor: c.uniquePrayedFor,
        totalPrayers: c.totalPrayers,
        coveragePercent:
          c.totalDeceased > 0
            ? Math.round((c.uniquePrayedFor / c.totalDeceased) * 1000) / 10
            : 0,
      } as CemeteryStats,
    }));

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("GET /api/cemeteries error:", err);
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
