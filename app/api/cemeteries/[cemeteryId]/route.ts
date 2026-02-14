import { NextRequest, NextResponse } from "next/server";
import { cemeteriesRepository } from "@/lib/db/cemeteries";
import { prayersRepository } from "@/lib/db/prayers";
import type { CemeteryDetailResponse, RecentPrayerActivity } from "@/lib/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cemeteryId: string }> }
) {
  try {
    const { cemeteryId } = await params;
    const cemetery = await cemeteriesRepository.getById(cemeteryId);
    if (!cemetery) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "CEMETERY_NOT_FOUND" as const,
            message: "The specified cemetery does not exist.",
          },
        },
        { status: 404 }
      );
    }

    const recentPrayers = await prayersRepository.listByCemetery(cemeteryId, 5);
    const recentActivity: RecentPrayerActivity[] = recentPrayers.map((p) => ({
      prayerType: p.prayerType,
      createdAt: p.createdAt,
    }));

    const coveragePercent =
      cemetery.totalDeceased > 0
        ? Math.round((cemetery.uniquePrayedFor / cemetery.totalDeceased) * 1000) / 10
        : 0;

    const data: CemeteryDetailResponse = {
      cemeteryId: cemetery.cemeteryId,
      name: cemetery.name,
      city: cemetery.city,
      state: cemetery.state,
      latitude: cemetery.latitude,
      longitude: cemetery.longitude,
      address: cemetery.address,
      zipCode: cemetery.zipCode,
      archdiocese: cemetery.archdiocese,
      stats: {
        totalDeceased: cemetery.totalDeceased,
        uniquePrayedFor: cemetery.uniquePrayedFor,
        totalPrayers: cemetery.totalPrayers,
        coveragePercent,
      },
      recentActivity,
    };

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error("GET /api/cemeteries/[id] error:", err);
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
