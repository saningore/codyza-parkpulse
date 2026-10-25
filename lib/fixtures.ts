import { parkLocalParts } from "@/lib/hours";

const TIME_ZONE = "America/Denver";

type RawPark = Record<string, unknown>;

function today(): string {
  return parkLocalParts(TIME_ZONE).date;
}

function park(input: {
  parkCode: string;
  fullName: string;
  designation: string;
  states: string;
  latitude: number;
  longitude: number;
  description: string;
}): RawPark {
  return {
    parkCode: input.parkCode,
    fullName: input.fullName,
    designation: input.designation,
    states: input.states,
    latitude: String(input.latitude),
    longitude: String(input.longitude),
    description: input.description,
    url: `https://www.nps.gov/${input.parkCode}/index.htm`,
    directionsInfo: "Use the directions link for the National Park Service page, then follow posted signs.",
    directionsUrl: `https://www.nps.gov/${input.parkCode}/planyourvisit/directions.htm`,
    weatherInfo: "Conditions change with elevation. Check the forecast for the published park point before you travel.",
    contacts: { phoneNumbers: [{ phoneNumber: "307-344-7381", type: "Voice" }] },
    activities: [{ name: "Hiking" }, { name: "Wildlife Watching" }],
    images: [],
    entranceFees: [{ title: "Entrance - Private Vehicle", cost: "35.00", description: "Sample vehicle entrance fee for local checks." }],
    entrancePasses: [],
    operatingHours: [{
      name: "Park hours",
      description: "Sample hours for local checks.",
      standardHours: {
        sunday: "All Day",
        monday: "All Day",
        tuesday: "All Day",
        wednesday: "All Day",
        thursday: "All Day",
        friday: "All Day",
        saturday: "All Day",
      },
      exceptions: [],
    }],
  };
}

const CATALOG: RawPark[] = [
  park({
    parkCode: "yell",
    fullName: "Yellowstone National Park",
    designation: "National Park",
    states: "WY,MT,ID",
    latitude: 44.428,
    longitude: -110.5885,
    description: "Sample Yellowstone record for local checks. It is not a live conditions report.",
  }),
  park({
    parkCode: "grca",
    fullName: "Grand Canyon National Park",
    designation: "National Park",
    states: "AZ",
    latitude: 36.1069,
    longitude: -112.1129,
    description: "Sample Grand Canyon record for local checks.",
  }),
  park({
    parkCode: "acad",
    fullName: "Acadia National Park",
    designation: "National Park",
    states: "ME",
    latitude: 44.3386,
    longitude: -68.2733,
    description: "Sample Acadia record for local checks.",
  }),
  park({
    parkCode: "yose",
    fullName: "Yosemite National Park",
    designation: "National Park",
    states: "CA",
    latitude: 37.8651,
    longitude: -119.5383,
    description: "Sample Yosemite record for local checks.",
  }),
  park({
    parkCode: "zion",
    fullName: "Zion National Park",
    designation: "National Park",
    states: "UT",
    latitude: 37.2982,
    longitude: -113.0263,
    description: "Sample Zion record for local checks.",
  }),
];

export const FIXTURE_PARK_COUNT = CATALOG.length;

function envelope(data: unknown[]): { total: string; data: unknown[] } {
  return { total: String(data.length), data };
}

export function fixtureNps(path: string): unknown {
  const url = new URL(path, "https://developer.nps.gov/api/v1/");
  const resource = url.pathname.replace(/\/$/, "");
  const code = (url.searchParams.get("parkCode") ?? resource.split("/").pop() ?? "").toLowerCase();
  const start = Number(url.searchParams.get("start") ?? "0");
  if (resource === "/parks" && !url.searchParams.get("parkCode")) {
    return { total: String(CATALOG.length), data: start > 0 ? [] : CATALOG };
  }
  if (resource === "/parks") return envelope(CATALOG.filter((item) => item.parkCode === code));
  if (resource.startsWith("/mapdata/parkboundaries/")) return code === "yell" ? yellBoundary() : null;
  if (code !== "yell") return envelope([]);
  if (resource === "/alerts") return envelope(yellAlerts());
  if (resource === "/campgrounds") return envelope(yellCampgrounds());
  if (resource === "/visitorcenters") return envelope(yellCenters());
  if (resource === "/events") return envelope(yellEvents());
  if (resource === "/thingstodo") return envelope(yellActivities());
  if (resource === "/feespasses") return envelope([{ fees: CATALOG[0].entranceFees, passes: [] }]);
  if (resource === "/roadevents") return envelope([]);
  if (resource === "/amenities/parksvisitorcenters") return envelope(yellAmenities());
  return envelope([]);
}

export function fixtureNws(kind: "points" | "forecast" | "alerts", latitude = 44.428): unknown {
  if (kind === "points") {
    return {
      properties: {
        timeZone: TIME_ZONE,
        forecast: "https://api.weather.gov/gridpoints/RIW/77,55/forecast",
        relativeLocation: { properties: { city: "Yellowstone", state: "WY" } },
      },
    };
  }
  if (kind === "forecast") {
    return {
      properties: {
        updated: new Date().toISOString(),
        periods: [
          { name: "This Afternoon", temperature: 46, temperatureUnit: "F", windSpeed: "10 mph", windDirection: "SW", shortForecast: "Partly Cloudy", detailedForecast: "Sample forecast for local checks.", probabilityOfPrecipitation: { value: 10 }, isDaytime: true },
          { name: "Tonight", temperature: 28, temperatureUnit: "F", windSpeed: "5 mph", windDirection: "W", shortForecast: "Mostly Clear", detailedForecast: "Sample overnight forecast.", probabilityOfPrecipitation: { value: 0 }, isDaytime: false },
          { name: "Friday", temperature: 51, temperatureUnit: "F", windSpeed: "8 mph", windDirection: "SW", shortForecast: "Sunny", detailedForecast: "Sample daytime forecast.", probabilityOfPrecipitation: { value: 0 }, isDaytime: true },
        ],
      },
    };
  }
  if (Math.abs(latitude - 44.428) > 1) return { features: [] };
  return {
    features: [{
      properties: {
        id: "sample-watch",
        event: "Winter Storm Watch",
        headline: "Winter Storm Watch for the sample point",
        severity: "Moderate",
        description: "Sample weather alert for local checks. It is not a live National Weather Service product.",
        instruction: "Check weather.gov before you travel.",
      },
    }],
  };
}

function yellAlerts(): unknown[] {
  return [
    {
      id: "closure-highway",
      category: "Park Closure",
      title: "Beartooth Highway closed for the season",
      description: "<p>The <strong>Beartooth Highway</strong> is closed. Other entrances remain open in this sample.</p>",
      url: "https://www.nps.gov/yell/planyourvisit/conditions.htm",
      lastIndexedDate: new Date().toISOString(),
    },
    {
      id: "caution-bears",
      category: "Caution",
      title: "Bear activity along the Yellowstone River",
      description: "Give bears room. This sample caution is not a live wildlife report.",
      url: "https://www.nps.gov/yell/planyourvisit/conditions.htm",
    },
    {
      id: "info-passes",
      category: "Information",
      title: "Entrance passes are sold at entrance stations",
      description: "Sample information alert about passes.",
      url: "https://www.nps.gov/yell/planyourvisit/fees.htm",
    },
    {
      id: "info-pullouts",
      category: "Information",
      title: "Pilot and Index Peak pullouts are limited",
      description: "Sample information alert about pullouts.",
      url: "https://www.nps.gov/yell/planyourvisit/conditions.htm",
    },
  ];
}

function yellCampgrounds(): unknown[] {
  const date = today();
  return [
    {
      id: "madison",
      name: "Madison Campground",
      description: "Sample campground near Madison Junction.",
      url: "https://www.nps.gov/yell/planyourvisit/madison-campground.htm",
      reservationUrl: "https://www.recreation.gov/",
      latitude: "44.646",
      longitude: "-110.859",
      regulationsOverview: "Food storage rules apply in this sample record.",
      campsites: { totalSites: "278" },
      accessibility: { wheelchairAccess: "Some sites and restrooms are listed as accessible in this sample." },
      operatingHours: [{
        name: "Campground hours",
        standardHours: { sunday: "Closed", monday: "Closed", tuesday: "Closed", wednesday: "Closed", thursday: "Closed", friday: "Closed", saturday: "Closed" },
        exceptions: [{
          name: "Closed for the season",
          startDate: date,
          endDate: date,
          exceptionHours: { sunday: "Closed", monday: "Closed", tuesday: "Closed", wednesday: "Closed", thursday: "Closed", friday: "Closed", saturday: "Closed" },
        }],
      }],
    },
    {
      id: "bridge-bay",
      name: "Bridge Bay Campground",
      description: "Sample campground near Bridge Bay.",
      url: "https://www.nps.gov/yell/planyourvisit/bridgebaycamp.htm",
      latitude: "44.533",
      longitude: "-110.437",
      regulationsOverview: "Loop A is closed for water repairs in this sample record.",
      campsites: { totalSites: "432" },
      accessibility: {},
      operatingHours: [{
        name: "Campground hours",
        standardHours: { sunday: "All Day", monday: "All Day", tuesday: "All Day", wednesday: "All Day", thursday: "All Day", friday: "All Day", saturday: "All Day" },
        exceptions: [],
      }],
    },
  ];
}

function yellCenters(): unknown[] {
  return [
    {
      id: "albright",
      name: "Albright Visitor Center",
      description: "Sample visitor center at Mammoth Hot Springs.",
      url: "https://www.nps.gov/yell/planyourvisit/albrightvc.htm",
      latitude: "44.9766",
      longitude: "-110.6995",
      directionsInfo: "Sample directions: the center is at Mammoth Hot Springs.",
      contacts: { phoneNumbers: [{ phoneNumber: "307-344-2263" }] },
      amenities: ["Wheelchair Accessible", "Restrooms"],
      operatingHours: [{
        name: "Visitor center hours",
        standardHours: { sunday: "9:00AM - 5:00PM", monday: "9:00AM - 5:00PM", tuesday: "9:00AM - 5:00PM", wednesday: "9:00AM - 5:00PM", thursday: "9:00AM - 5:00PM", friday: "9:00AM - 5:00PM", saturday: "9:00AM - 5:00PM" },
        exceptions: [],
      }],
    },
    {
      id: "old-faithful",
      name: "Old Faithful Visitor Education Center",
      description: "Sample visitor center near Old Faithful.",
      url: "https://www.nps.gov/yell/planyourvisit/exploreoldfaithful.htm",
      latitude: "44.4605",
      longitude: "-110.8281",
      amenities: ["Exhibits"],
      operatingHours: [],
    },
  ];
}

function yellEvents(): unknown[] {
  const date = today();
  return [{
    id: "ranger-talk",
    title: "Ranger talk at Old Faithful",
    description: "Sample event listed for today.",
    location: "Old Faithful Visitor Education Center",
    datestart: date,
    dateend: date,
    times: [{ timestart: "2:00 PM", timeend: "2:30 PM" }],
    isrecurring: false,
    url: "https://www.nps.gov/yell/planyourvisit/events.htm",
  }];
}

function yellActivities(): unknown[] {
  return [
    {
      id: "geyser",
      title: "Watch a geyser basin",
      shortDescription: "Sample thing to do. Stay on boardwalks.",
      duration: "1-2 Hours",
      location: "Old Faithful",
      accessibilityInformation: "Boardwalks in this sample are described as wheelchair accessible.",
      url: "https://www.nps.gov/yell/planyourvisit/exploreoldfaithful.htm",
    },
    {
      id: "wildlife",
      title: "Look for wildlife from a pullout",
      shortDescription: "Sample wildlife stop. Do not approach animals.",
      duration: "Half Day",
      location: "Lamar Valley",
      url: "https://www.nps.gov/yell/planyourvisit/wildlifeviewing.htm",
    },
  ];
}

function yellAmenities(): unknown[] {
  return [{
    name: "Wheelchair Accessible",
    parks: [{ parkCode: "yell", visitorcenters: [{ name: "Albright Visitor Center" }] }],
  }];
}

function yellBoundary(): unknown {
  return {
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      properties: { name: "Sample Yellowstone outline" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-111.1, 45.1],
          [-109.8, 45.1],
          [-109.8, 44.1],
          [-111.1, 44.1],
          [-111.1, 45.1],
        ]],
      },
    }],
  };
}
