import { directoryStatus } from "@/lib/directory";
import { FIXTURE_PARK_COUNT } from "@/lib/fixtures";
import { hasNpsKey, usingFixtures } from "@/lib/runtime";

export type Readiness = {
  ok: boolean;
  mode: "fixtures" | "live" | "degraded";
  catalogParks: number;
  catalogUpdatedAt: string | null;
  directory: "fixtures" | "boundary-service" | "nps-api" | "empty";
  nps: "configured" | "public" | "missing";
  problems: string[];
};

export function readiness(): Readiness {
  const nps = hasNpsKey() ? "configured" : usingFixtures() ? "missing" : "public";
  if (usingFixtures()) {
    return {
      ok: true,
      mode: "fixtures",
      catalogParks: FIXTURE_PARK_COUNT,
      catalogUpdatedAt: null,
      directory: "fixtures",
      nps,
      problems: [],
    };
  }
  const status = directoryStatus();
  const problems: string[] = [];
  if (status.count < 1) problems.push("The park directory is empty.");
  const directory = status.count < 1 ? "empty" : status.origin === "nps-api" ? "nps-api" : "boundary-service";
  return {
    ok: problems.length === 0,
    mode: problems.length === 0 ? "live" : "degraded",
    catalogParks: status.count,
    catalogUpdatedAt: status.retrievedAt,
    directory,
    nps,
    problems,
  };
}
