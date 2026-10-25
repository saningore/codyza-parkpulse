import { describe, expect, it } from "vitest";
import { parsePublicAlerts } from "@/lib/public-alerts";

const now = new Date("2026-10-25T18:00:00Z");

describe("public National Park Service alerts", () => {
  it("keeps current alerts for the requested park and drops the rest", () => {
    const alerts = parsePublicAlerts([
      {
        unique_id: "elk",
        site_code: "YELL",
        title: "Stay Away From <b>Bull Elk</b>",
        description: "Give elk room.",
        category: "Caution",
        internal_link: "https://www.nps.gov/yell/planyourvisit/safety.htm#elk",
        end_date: "October, 31 2026 23:59:00",
        start_date: "",
        last_modified: "Aug 26, 2026",
      },
      {
        unique_id: "old",
        site_code: "yell",
        title: "Road closed last month",
        description: "Ended.",
        category: "Closure",
        end_date: "September, 1 2026 00:00:00",
      },
      {
        unique_id: "later",
        site_code: "yell",
        title: "Starts next month",
        description: "Not yet.",
        category: "Information",
        start_date: "November, 2 2026 00:00:00",
      },
      {
        unique_id: "other",
        site_code: "grca",
        title: "Inner canyon",
        description: "Different park.",
        category: "Danger",
      },
      {
        unique_id: "blank",
        site_code: "yell",
        title: " ",
        description: "Missing title.",
        category: "Information",
      },
      {
        site_code: "yell",
        title: "Offsite link",
        description: "The link is not kept.",
        category: "Information",
        internal_link: "https://example.com/alert",
      },
    ], "yell", now);

    expect(alerts).toEqual([
      {
        id: "elk",
        title: "Stay Away From Bull Elk",
        description: "Give elk room.",
        category: "Caution",
        url: "https://www.nps.gov/yell/planyourvisit/safety.htm#elk",
        lastIndexed: "Aug 26, 2026",
      },
      {
        id: "public-alert-5",
        title: "Offsite link",
        description: "The link is not kept.",
        category: "Information",
        url: null,
        lastIndexed: null,
      },
    ]);
  });

  it("returns nothing for a feed that is not a list", () => {
    expect(parsePublicAlerts({ error: true }, "yell", now)).toEqual([]);
  });
});