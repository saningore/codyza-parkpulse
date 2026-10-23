import { describe, expect, it } from "vitest";
import { decideVerdict, isClosure, isFullParkClosure, type VerdictInput } from "@/lib/verdict";

const base: VerdictInput = {
  alertsLoaded: true,
  alerts: [],
  hoursToday: "open",
  roadEvents: [],
  weatherAlertsLoaded: true,
  weatherAlerts: [],
};

const closure = { title: "Beartooth Highway closed", description: "Other entrances remain open.", category: "Park Closure" };
const full = { title: "Winter closure", description: "The entire park is closed to all visitors.", category: "Park Closure" };
const danger = { title: "Rockfall", description: "Imminent hazard.", category: "Danger" };
const caution = { title: "Bears", description: "Give wildlife room.", category: "Caution" };
const note = { title: "Passes", description: "Sold at the gate.", category: "Information" };
const road = { title: "Crash", description: "One lane blocked.", eventType: "Incident", affectsToday: true };

describe("closure classification", () => {
  it("requires closure language and treats a named place as partial", () => {
    expect(isClosure("Park Closure")).toBe(true);
    expect(isClosure("Information")).toBe(false);
    expect(isFullParkClosure(full)).toBe(true);
    expect(isFullParkClosure({ ...full, title: "Closed to the public", description: "Until further notice." })).toBe(true);
    expect(isFullParkClosure({ title: "Road closed", description: "The entire park is closed.", category: "Park Closure" })).toBe(false);
    expect(isFullParkClosure({ title: "Entrance closed", description: "The entire park is closed.", category: "Park Closure" })).toBe(false);
    expect(isFullParkClosure({ ...full, category: "Danger" })).toBe(false);
  });
});

describe("verdict priority", () => {
  it("lets listed closed hours outrank danger, and does not confirm them when alerts fail", () => {
    const closed = decideVerdict({ ...base, hoursToday: "closed", alerts: [danger] });
    expect(closed.status).toBe("closed");
    expect(closed.reason).toMatch(/lists the park as closed today/);
    expect(closed.reason).not.toMatch(/danger/);

    const unconfirmed = decideVerdict({ ...base, alertsLoaded: false, hoursToday: "closed", alerts: [danger] });
    expect(unconfirmed.status).toBe("unconfirmed");
    expect(unconfirmed.reason).toMatch(/will not confirm/);
  });

  it("ranks a full closure, then danger, then a closure with a road incident", () => {
    expect(decideVerdict({ ...base, alerts: [closure, full] }).status).toBe("closed");
    expect(decideVerdict({ ...base, alerts: [closure, danger] }).reason).toBe("1 danger alert posted by the park.");
    expect(decideVerdict({ ...base, alerts: [danger, danger] }).reason).toMatch(/2 danger alerts/);
    expect(decideVerdict({ ...base, alerts: [closure], roadEvents: [road] }).reason).toMatch(/closure, and a road incident/);
    expect(decideVerdict({ ...base, alerts: [closure] }).status).toBe("restricted");
    expect(decideVerdict({ ...base, roadEvents: [road] }).reason).toMatch(/road incident is listed/);
    expect(decideVerdict({ ...base, roadEvents: [{ ...road, affectsToday: false }] }).status).toBe("open");
  });

  it("uses caution for park cautions and weather watches, including when hours are unknown", () => {
    const both = decideVerdict({ ...base, alerts: [caution], weatherAlerts: [{ event: "Winter Storm Watch" }] });
    expect(both.status).toBe("caution");
    expect(both.reason).toMatch(/caution, and the National Weather Service/);
    expect(decideVerdict({ ...base, alerts: [caution] }).reason).toMatch(/posted a caution alert/);
    expect(decideVerdict({ ...base, weatherAlerts: [{ event: "Severe Thunderstorm Warning" }] }).status).toBe("caution");
    expect(decideVerdict({ ...base, weatherAlerts: [{ event: "Flood Advisory" }] }).status).toBe("open");
    expect(decideVerdict({ ...base, hoursToday: "unknown", weatherAlerts: [{ event: "Winter Storm Watch" }] }).status).toBe("caution");
    expect(decideVerdict({ ...base, hoursToday: "unknown", alerts: [caution] }).status).toBe("caution");
  });

  it("stays unconfirmed without hours, and mentions notes only on an open day", () => {
    expect(decideVerdict({ ...base, hoursToday: "unknown", alerts: [note] }).status).toBe("unconfirmed");
    const noted = decideVerdict({ ...base, alerts: [note, { ...note, title: "Construction" }] });
    expect(noted.label).toBe("Open, with notes");
    expect(noted.reason).toMatch(/2 information alerts/);

    const missedWeather = decideVerdict({ ...base, alerts: [note], weatherAlertsLoaded: false });
    expect(missedWeather.reason).toMatch(/Weather alerts could not be checked/);
    expect(decideVerdict({ ...base, alerts: [closure], weatherAlertsLoaded: false }).reason).not.toMatch(/Weather alerts could not be checked/);
  });
});
