import { UNAVAILABLE } from "@/lib/types";

const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado",
  CT: "Connecticut", DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky",
  LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
  MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire",
  NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota",
  OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia",
  WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", PR: "Puerto Rico",
  GU: "Guam", AS: "American Samoa", VI: "U.S. Virgin Islands", MP: "Northern Mariana Islands",
};

export function stateNames(value: string | null): string | null {
  if (!value) return null;
  const names = value.split(",").map((part) => part.trim().toUpperCase()).filter(Boolean)
    .map((part) => STATE_NAMES[part] ?? part);
  return names.length ? names.join(", ") : null;
}

export function stateQuery(value: string): string | null {
  const token = value.trim().toLowerCase().replace(/\./g, "");
  const entry = Object.entries(STATE_NAMES).find(([, name]) => name.toLowerCase() === token);
  if (entry) return entry[0];
  if (/^[a-z]{2}$/.test(token) && STATE_NAMES[token.toUpperCase()]) return token.toUpperCase();
  return null;
}

export function show(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : UNAVAILABLE;
}

export function formatCost(value: string | null): string | null {
  if (!value) return null;
  const amount = Number(value.replace(/[$,]/g, ""));
  if (!Number.isFinite(amount)) return value;
  if (amount === 0) return "Free";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

export function formatPhone(value: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (local.length !== 10) return value.trim();
  return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
}

export function telHref(value: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  return local.length === 10 ? `tel:+1${local}` : null;
}

export function directionsHref(latitude: number | null, longitude: number | null): string | null {
  if (latitude === null || longitude === null) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}

export function formatMiles(miles: number | null): string | null {
  if (miles === null || !Number.isFinite(miles)) return null;
  const rounded = miles < 10 ? miles.toFixed(1) : String(Math.round(miles));
  return `${rounded} mi`;
}

export function checkedAt(iso: string, timeZone: string | null): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: timeZone ?? "UTC",
  }).format(date);
}
