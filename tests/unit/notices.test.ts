import { describe, expect, it } from "vitest";
import { campgroundNotices } from "@/lib/notices";
import type { Alert, Campground, HourSchedule } from "@/lib/types";

function schedule(exceptions: HourSchedule["activeExceptions"]): HourSchedule {
  return {
    name: "Campground hours",
    description: null,
    today: "closed",
    todayText: "Closed",
    week: [],
    activeExceptions: exceptions,
  };
}

function camp(overrides: Partial<Campground> = {}): Campground {
  return {
    id: "madison",
    name: "Madison Campground",
    description: null,
    url: null,
    reservationUrl: null,
    latitude: null,
    longitude: null,
    totalSites: null,
    regulations: null,
    schedule: null,
    accessibility: [],
    ...overrides,
  };
}

const today = "2026-10-23";

describe("campground notices", () => {
  it("keeps today's exception and closure language, and skips other dates", () => {
    const notices = campgroundNotices([
      camp({
        schedule: schedule([
          { name: "Closed for the season", startDate: today, endDate: today, hours: "Closed" },
          { name: "Next week", startDate: "2026-10-30", endDate: "2026-10-30", hours: null },
        ]),
      }),
      camp({
        id: "bridge",
        name: "Bridge Bay Campground",
        regulations: "Loop A is closed for water repairs.",
      }),
      camp({ id: "quiet", name: "Quiet Campground", regulations: "Food storage rules apply." }),
    ], [], today);

    expect(notices.map((notice) => notice.title)).toEqual(["Closed for the season", "Campground notice"]);
    expect(notices[0]).toMatchObject({ place: "Madison Campground", detail: "Listed hours during this exception: Closed." });
    expect(notices[1].detail).toBe("Loop A is closed for water repairs.");
  });

  it("includes an undated exception, clips long copy, and drops duplicates", () => {
    const long = "c".repeat(321);
    const alert: Alert = {
      id: "camp-alert",
      title: "Campground delay",
      description: long,
      category: "Information",
      url: null,
      lastIndexed: null,
    };
    const notices = campgroundNotices([
      camp({ schedule: schedule([{ name: "Maintenance", startDate: "2026-01-01", endDate: "2026-12-31", hours: null }]) }),
    ], [alert, alert], null);

    expect(notices).toHaveLength(2);
    expect(notices[0].detail).toBe("A schedule exception covers today.");
    expect(notices[1].detail.endsWith("…")).toBe(true);
    expect(notices[1].detail.length).toBe(320);
    expect(notices[1].place).toBeNull();
  });
});
