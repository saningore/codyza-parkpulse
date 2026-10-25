import { describe, expect, it } from "vitest";
import { parksNear, rankParks } from "@/lib/catalog";
import type { ParkSummary } from "@/lib/types";

function park(overrides: Partial<ParkSummary> & Pick<ParkSummary, "parkCode" | "fullName">): ParkSummary {
  return {
    designation: "National Park",
    states: null,
    latitude: null,
    longitude: null,
    description: null,
    imageUrl: null,
    imageAlt: null,
    distanceMiles: null,
    ...overrides,
  };
}

const parks: ParkSummary[] = [
  park({ parkCode: "yell", fullName: "Yellowstone National Park", states: "WY,MT,ID", latitude: 44.6, longitude: -110.5, description: "Geysers and bison" }),
  park({ parkCode: "yose", fullName: "Yosemite National Park", states: "CA", latitude: 37.8, longitude: -119.5, description: "Granite and waterfalls" }),
  park({ parkCode: "zion", fullName: "Zion National Park", states: "UT", latitude: 37.3, longitude: -113, description: "Canyons" }),
  park({ parkCode: "grca", fullName: "Grand Canyon National Park", states: "AZ", latitude: 36.1, longitude: -112.1 }),
  park({ parkCode: "devi", fullName: "Devils Tower", designation: "National Monument", states: "WY", description: "A stone tower" }),
  park({ parkCode: "inde", fullName: "Independence National Historical Park", designation: "National Historical Park", states: "PA", description: "The park preserves Independence Hall." }),
];

describe("search ranking", () => {
  it("orders exact code, exact name, prefix, and text matches", () => {
    expect(rankParks(parks, "  YELL  ").map((item) => item.parkCode)).toEqual(["yell"]);
    expect(rankParks(parks, "zion national park").map((item) => item.parkCode)).toEqual(["zion"]);
    expect(rankParks(parks, "yel").map((item) => item.parkCode)).toEqual(["yell"]);
    expect(rankParks(parks, "yo").map((item) => item.parkCode)).toEqual(["yose"]);
    expect(rankParks(parks, "canyon").map((item) => item.parkCode)).toEqual(["grca", "zion"]);
    expect(rankParks(parks, "monument").map((item) => item.parkCode)).toEqual(["devi"]);
    expect(rankParks(parks, "bison").map((item) => item.parkCode)).toEqual(["yell"]);
    expect(rankParks(parks, "independence park").map((item) => item.parkCode)).toEqual(["inde"]);
    expect(rankParks(parks, "yellowstone park").map((item) => item.parkCode)).toEqual(["yell"]);
    expect(rankParks(parks, "grand canyon park").map((item) => item.parkCode)).toEqual(["grca"]);
    expect(rankParks(parks, "ge")).toEqual([]);
    expect(rankParks(parks, "y")).toEqual([]);
  });

  it("matches a state name or abbreviation and breaks ties by name", () => {
    expect(rankParks(parks, "utah").map((item) => item.parkCode)).toEqual(["zion"]);
    expect(rankParks(parks, "wy").map((item) => item.parkCode)).toEqual(["devi", "yell"]);
    const tied = [
      park({ parkCode: "bbbb", fullName: "Beta Canyon Place" }),
      park({ parkCode: "aaaa", fullName: "Alpha Canyon Place" }),
    ];
    expect(rankParks(tied, "canyon").map((item) => item.parkCode)).toEqual(["aaaa", "bbbb"]);
  });

  it("returns at most twelve matches", () => {
    const many = Array.from({ length: 13 }, (_, index) => park({
      parkCode: `p${String(index).padStart(3, "0")}`,
      fullName: `Sample Park ${String.fromCharCode(97 + index)}`,
    }));
    expect(rankParks(many, "park")).toHaveLength(12);
    expect(rankParks(many, "park")[0].fullName).toBe("Sample Park a");
  });
});

describe("nearby parks", () => {
  it("sorts by distance, drops parks without coordinates, and keeps fifteen", () => {
    const located = Array.from({ length: 16 }, (_, index) => park({
      parkCode: `n${String(index).padStart(3, "0")}`,
      fullName: `Park ${String.fromCharCode(97 + index)}`,
      latitude: index,
      longitude: 0,
    }));
    located.push(park({ parkCode: "none", fullName: "No Coordinates" }));
    const near = parksNear(located, 0, 0);
    expect(near).toHaveLength(15);
    expect(near[0].fullName).toBe("Park a");
    expect(near[0].distanceMiles).toBe(0);
    expect(near.map((item) => item.distanceMiles)).toEqual([...near.map((item) => item.distanceMiles)].sort((a, b) => (a ?? 0) - (b ?? 0)));
    expect(near.some((item) => item.parkCode === "none")).toBe(false);

    const tied = parksNear([
      park({ parkCode: "bbbb", fullName: "Beta", latitude: 1, longitude: 1 }),
      park({ parkCode: "aaaa", fullName: "Alpha", latitude: 1, longitude: 1 }),
    ], 1, 1);
    expect(tied.map((item) => item.parkCode)).toEqual(["aaaa", "bbbb"]);
  });
});
