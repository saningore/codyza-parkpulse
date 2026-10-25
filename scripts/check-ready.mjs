import fs from "node:fs";

const seed = JSON.parse(fs.readFileSync(new URL("../data/parks.json", import.meta.url), "utf8"));
const problems = [];

if (process.env.PARKPULSE_USE_FIXTURES === "1") {
  problems.push("PARKPULSE_USE_FIXTURES is set. A shared site must not serve sample records.");
}
if (!Array.isArray(seed.parks) || seed.parks.length < 400) {
  problems.push("data/parks.json is missing or has fewer than 400 parks. Run npm run catalog:refresh.");
}

if (problems.length) {
  console.error(problems.map((problem) => `- ${problem}`).join("\n"));
  process.exit(1);
}

const key = process.env.NPS_API_KEY?.trim() ? "NPS Data API key is set." : "No NPS Data API key. Hours, fees, and campgrounds use public park pages.";
console.log(`Ready for live conditions. ${seed.parks.length} parks in the directory seed. ${key}`);
