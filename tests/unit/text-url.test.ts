import { describe, expect, it } from "vitest";
import { clip, htmlToText, textOrNull } from "@/lib/text";
import { httpsUrl, nwsApiUrl } from "@/lib/url";

describe("html and plain text", () => {
  it("turns breaks and paragraphs into text and drops tags", () => {
    expect(htmlToText("<p>Road closed.<br>Use another gate.</p><p>Stay back.</p>")).toBe("Road closed.\nUse another gate.\n\nStay back.");
    expect(htmlToText("&#60;em&#62;Hi&#60;/em&#62;")).toBe("Hi");
    expect(htmlToText("&amp;lt;")).toBe("<");
    expect(htmlToText("Tom&#39;s &apos;note&apos;")).toBe("Tom's 'note'");
    expect(htmlToText("&#31;&#65;")).toBe("A");
    expect(htmlToText("<p>   </p>")).toBeNull();
    expect(htmlToText(12)).toBeNull();
  });

  it("trims text and clips on a word boundary", () => {
    expect(textOrNull("  gate  ")).toBe("gate");
    expect(textOrNull("   ")).toBeNull();
    expect(textOrNull(null)).toBeNull();
    expect(clip(null)).toBeNull();
    expect(clip("short", 10)).toBe("short");
    expect(clip("abcdefghijk", 10)).toBe("abcdefghi…");
  });
});

describe("official links", () => {
  it("allows the National Park Service, Recreation.gov, and weather.gov over https", () => {
    expect(httpsUrl("  https://www.nps.gov/yell/index.htm  ")).toBe("https://www.nps.gov/yell/index.htm");
    expect(httpsUrl("https://nps.gov/yell")).toBe("https://nps.gov/yell");
    expect(httpsUrl("https://www.recreation.gov/ticket/300003")).toMatch(/^https:\/\/www\.recreation\.gov/);
    expect(httpsUrl("https://www.weather.gov/documentation/services-web-api")).toMatch(/^https:\/\/www\.weather\.gov/);
  });

  it("rejects lookalike hosts and non-https schemes", () => {
    expect(httpsUrl("https://www.nps.gov.evil.com/yell")).toBeNull();
    expect(httpsUrl("https://evilnps.gov/yell")).toBeNull();
    expect(httpsUrl("https://nps.gov.evil.com/yell")).toBeNull();
    expect(httpsUrl("http://www.nps.gov/yell")).toBeNull();
    expect(httpsUrl("javascript:alert(1)")).toBeNull();
    expect(httpsUrl("https://example.com/park")).toBeNull();
    expect(httpsUrl("")).toBeNull();
    expect(httpsUrl(null)).toBeNull();
    expect(httpsUrl("not a url")).toBeNull();
  });

  it("accepts only api.weather.gov for forecast links", () => {
    expect(nwsApiUrl("https://api.weather.gov/gridpoints/RIW/77,55/forecast")).toBe("https://api.weather.gov/gridpoints/RIW/77,55/forecast");
    expect(nwsApiUrl("https://api.weather.gov")).toBe("https://api.weather.gov/");
    expect(nwsApiUrl("https://weather.gov/forecast")).toBeNull();
    expect(nwsApiUrl("https://evil.api.weather.gov/forecast")).toBeNull();
    expect(nwsApiUrl("http://api.weather.gov/forecast")).toBeNull();
    expect(nwsApiUrl(null)).toBeNull();
  });
});
