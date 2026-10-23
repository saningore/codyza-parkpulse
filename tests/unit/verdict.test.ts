import { describe, expect, it } from "vitest";
import { decideVerdict, isFullParkClosure, type VerdictInput } from "@/lib/verdict";

const base: VerdictInput = {
  alertsLoaded: true,
  alerts: [],
  hoursToday: "open",
  roadEvents: [],
  weatherAlertsLoaded: true,
  weatherAlerts: [],
};

describe("visit verdict", () => {
  it("stays unconfirmed when alerts fail, including when hours say closed", () => {
    expect(decideVerdict({ ...base, alertsLoaded: false }).status).toBe("unconfirmed");
    expect(decideVerdict({ ...base, alertsLoaded: false, hoursToday: "closed" }).reason).toMatch(/will not confirm/i);
  });

  it("closes the park from hours or a full-park alert", () => {
    expect(decideVerdict({ ...base, hoursToday: "closed" }).status).toBe("closed");
    const alert = { title: "Winter closure", description: "The entire park is closed to all visitors.", category: "Park Closure" };
    expect(isFullParkClosure(alert)).toBe(true);
    expect(decideVerdict({ ...base, alerts: [alert] }).label).toBe("Closed today");
  });

  it("treats a highway closure as restricted", () => {
    const alert = { title: "Beartooth Highway closed for the season", description: "Other entrances remain open.", category: "Park Closure" };
    expect(isFullParkClosure(alert)).toBe(false);
    expect(decideVerdict({ ...base, alerts: [alert] }).status).toBe("restricted");
  });

  it("ranks danger above a partial closure", () => {
    const verdict = decideVerdict({
      ...base,
      alerts: [
        { title: "Road closed", description: "One road is closed.", category: "Park Closure" },
        { title: "Rockfall", description: "Imminent hazard.", category: "Danger" },
      ],
    });
    expect(verdict.status).toBe("hazard");
    expect(verdict.reason).toMatch(/1 danger alert/);
  });

  it("uses caution for a weather watch when the park itself is quiet", () => {
    expect(decideVerdict({ ...base, weatherAlerts: [{ event: "Winter Storm Watch" }] }).status).toBe("caution");
  });

  it("does not call the park open when hours are unknown", () => {
    expect(decideVerdict({ ...base, hoursToday: "unknown" }).status).toBe("unconfirmed");
  });

  it("mentions information alerts on an otherwise open day", () => {
    const verdict = decideVerdict({
      ...base,
      alerts: [{ title: "Passes", description: "Sold at the gate.", category: "Information" }],
    });
    expect(verdict.label).toBe("Open, with notes");
  });

  it("says open when nothing is posted and notes a missed weather check", () => {
    const verdict = decideVerdict({ ...base, weatherAlertsLoaded: false });
    expect(verdict.label).toBe("Open today");
    expect(verdict.reason).toMatch(/Weather alerts could not be checked/);
  });
});
