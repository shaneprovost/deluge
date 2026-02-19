import { NextResponse } from "next/server";
import { cemeteriesRepository } from "@/lib/db/cemeteries";
import { prayersRepository } from "@/lib/db/prayers";
import type { GlobalStats, GlobalRecentActivity } from "@/lib/types";
import type { PrayerType } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cemeteries = await cemeteriesRepository.listByArchdiocese("Atlanta");
    const totalDeceased = cemeteries.reduce((sum, c) => sum + c.totalDeceased, 0);
    const totalPrayers = cemeteries.reduce((sum, c) => sum + c.totalPrayers, 0);
    const uniquePrayedFor = cemeteries.reduce((sum, c) => sum + c.uniquePrayedFor, 0);
    const coveragePercent =
      totalDeceased > 0 ? Math.round((uniquePrayedFor / totalDeceased) * 1000) / 10 : 0;

    // Recent activity: sample from each cemetery
    const recentActivity: GlobalRecentActivity[] = [];
    for (const c of cemeteries) {
      const recent = await prayersRepository.listByCemetery(c.cemeteryId, 3);
      for (const p of recent) {
        recentActivity.push({
          cemeteryName: c.name,
          prayerType: p.prayerType,
          createdAt: p.createdAt,
        });
      }
    }
    recentActivity.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const topRecent = recentActivity.slice(0, 10);

    // Global prayersByType would require a stats table or full scan; MVP: zeros
    const prayersByType: Record<PrayerType, number> = {
      our_father: 0,
      hail_mary: 0,
      decade_rosary: 0,
      full_rosary: 0,
      mass: 0,
      divine_mercy_chaplet: 0,
      other: 0,
    };

    const data: GlobalStats = {
      totalDeceased,
      totalPrayers,
      uniquePrayedFor,
      coveragePercent,
      totalCemeteries: cemeteries.length,
      prayersByType,
      recentActivity: topRecent,
    };

    return NextResponse.json({
      success: true,
      data,
      meta: { generatedAt: new Date().toISOString() },
    });
  } catch (err) {
    console.error("GET /api/stats error:", err);
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
