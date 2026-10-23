import type { HoursToday, Verdict, VerdictStatus } from "@/lib/types";

const PARTIAL = /\b(road|trail|campground|visitor center|entrance|highway|route|loop|canyon|pass|beach|bridge|tunnel|gate|trailhead|picnic|overlook|district|lake|river|lane)\b/i;
const FULL_PARK = /\b(entire park|all areas of (the )?park|closed to all visitors|parkwide|all visitors|closed to the public)\b/i;

export type VerdictAlert = { title: string; description: string; category: string };
export type VerdictRoad = { title: string; description: string; eventType: string; affectsToday: boolean };
export type VerdictWeather = { event: string };

export type VerdictInput = {
  alertsLoaded: boolean;
  alerts: VerdictAlert[];
  hoursToday: HoursToday;
  roadEvents: VerdictRoad[];
  weatherAlertsLoaded: boolean;
  weatherAlerts: VerdictWeather[];
};

export function isClosure(category: string): boolean {
  return /closure/i.test(category);
}

export function isFullParkClosure(alert: VerdictAlert): boolean {
  if (!isClosure(alert.category)) return false;
  if (PARTIAL.test(alert.title)) return false;
  return FULL_PARK.test(`${alert.title} ${alert.description}`);
}

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function labelFor(status: VerdictStatus, informationAlerts: number): string {
  if (status === "closed") return "Closed today";
  if (status === "hazard") return "Hazard";
  if (status === "restricted") return "Restricted";
  if (status === "caution") return "Caution";
  if (status === "unconfirmed") return "Unconfirmed";
  return informationAlerts > 0 ? "Open, with notes" : "Open today";
}

export function decideVerdict(input: VerdictInput): Verdict {
  if (!input.alertsLoaded) {
    const reason = input.hoursToday === "closed"
      ? "Listed hours say closed today. Alerts did not load, so ParkPulse will not confirm that status."
      : "Park alerts could not be loaded, so ParkPulse will not call this park open.";
    return { status: "unconfirmed", label: "Unconfirmed", reason, hoursToday: input.hoursToday, hoursText: null };
  }

  const closures = input.alerts.filter((alert) => isClosure(alert.category));
  const fullClosures = input.alerts.filter(isFullParkClosure);
  const dangers = input.alerts.filter((alert) => /danger/i.test(alert.category));
  const cautions = input.alerts.filter((alert) => /caution/i.test(alert.category));
  const information = input.alerts.filter((alert) => /information/i.test(alert.category));
  const roads = input.roadEvents.filter((event) => event.affectsToday);
  const weatherHits = input.weatherAlerts.filter((alert) => /warning|watch/i.test(alert.event));

  let status: VerdictStatus = "open";
  let reason = "Listed as open today. No danger, closure, or caution alerts were posted.";

  if (input.hoursToday === "closed") {
    status = "closed";
    reason = "The National Park Service lists the park as closed today.";
  } else if (fullClosures.length > 0) {
    status = "closed";
    reason = `An official alert says the park is closed: ${fullClosures[0].title}.`;
  } else if (dangers.length > 0) {
    status = "hazard";
    reason = `${countLabel(dangers.length, "danger alert", "danger alerts")} posted by the park.`;
  } else if (closures.length > 0 && roads.length > 0) {
    status = "restricted";
    reason = "The park posted a closure, and a road incident is listed. Read both before you go.";
  } else if (closures.length > 0) {
    status = "restricted";
    reason = "Part of the park is closed. Read the closure alerts before you go.";
  } else if (roads.length > 0) {
    status = "restricted";
    reason = "A road incident is listed. Read it before you go.";
  } else if (cautions.length > 0 && weatherHits.length > 0) {
    status = "caution";
    reason = "The park posted a caution, and the National Weather Service has a watch or warning for this point.";
  } else if (cautions.length > 0) {
    status = "caution";
    reason = "The park posted a caution alert.";
  } else if (weatherHits.length > 0) {
    status = "caution";
    reason = "The National Weather Service has a watch or warning for the park's published coordinates.";
  } else if (input.hoursToday !== "open") {
    status = "unconfirmed";
    reason = "Today's hours could not be confirmed, so ParkPulse will not call this park open.";
  } else if (information.length > 0) {
    status = "open";
    reason = `Listed as open today. ${countLabel(information.length, "information alert", "information alerts")} may affect your plans.`;
  }

  if (!input.weatherAlertsLoaded && status === "open") {
    reason = `${reason} Weather alerts could not be checked.`;
  }

  return {
    status,
    label: labelFor(status, information.length),
    reason,
    hoursToday: input.hoursToday,
    hoursText: null,
  };
}
