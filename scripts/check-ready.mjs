import fs from "node:fs";

const seed = JSON.parse(fs.readFileSync(new URL("../data/parks.json", import.meta.url), "utf8"));
const problems = [];

if (process.env.PARKPULSE_USE_FIXTURES === "1") {
  problems.push("PARKPULSE_USE_FIXTURES is set. A shared site must not serve sample records.");
}
if (!process.env.NPS_API_KEY?.trim()) {
  problems.push("NPS_API_KEY is missing. Search, weather, and the public alerts list can run, but hours, campgrounds, and fees are not live.");
}
if (!Array.isArray(seed.parks) || seed.parks.length < 400) {
  problems.push("data/parks.json is missing or has fewer than 400 parks. Run npm run catalog:refresh.");
}

if (problems.length) {
  console.error(problems.map((problem) => `- ${problem}`).join("\n"));
  process.exit(1);
}

console.log(`Ready for live conditions. ${seed.parks.length} parks in the directory seed.`);
