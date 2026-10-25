import Link from "next/link";
import ParkMap from "@/components/ParkMap";
import SaveButton from "@/components/SaveButton";
import { checkedAt, directionsHref, formatCost, formatPhone, show, stateNames, telHref } from "@/lib/format";
import type { HourSchedule, ParkConditions } from "@/lib/types";
import { UNAVAILABLE } from "@/lib/types";

const TONE: Record<ParkConditions["verdict"]["status"], string> = {
  open: "bg-moss",
  caution: "bg-sand",
  restricted: "bg-sand",
  hazard: "bg-rose",
  closed: "bg-rose",
  unconfirmed: "bg-mist",
};

export default function ParkView({ conditions }: { conditions: ParkConditions }) {
  const { park, verdict } = conditions;
  const directions = directionsHref(park.latitude, park.longitude);
  const phone = telHref(park.phone);
  const weatherLine = conditions.weather?.periods[0]
    ? `${conditions.weather.periods[0].temperature}, ${conditions.weather.periods[0].shortForecast}`
    : "Unavailable";
  const places = stateNames(park.states);

  return (
    <article className="mx-auto max-w-6xl px-4 py-8">
      <Link className="text-sm font-bold text-pine underline" href="/">Back to search</Link>
      <p className="mt-4 text-sm font-bold uppercase tracking-wide text-pine">{[park.designation, places].filter(Boolean).join(" · ") || "National Park Service site"}</p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-serif text-4xl font-semibold leading-tight md:text-5xl">{park.fullName}</h1>
        <SaveButton park={{ parkCode: park.parkCode, fullName: park.fullName, designation: park.designation, states: park.states }} />
      </div>
      {park.description && <p className="mt-4 max-w-3xl text-lg text-ink/80">{park.description}</p>}

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
        <section aria-labelledby="visit-status" data-status={verdict.status} className={`rounded-3xl p-5 ${TONE[verdict.status]}`}>
          <h2 id="visit-status" className="text-sm font-bold uppercase tracking-wide">Can I visit today?</h2>
          <p className="mt-1 font-serif text-4xl font-semibold">{verdict.label}</p>
          <p className="mt-3 text-lg">{verdict.reason}</p>
          <p className="mt-3 text-sm font-bold">Hours today: {verdict.hoursText ?? "not confirmed"}{conditions.todayLabel ? ` · ${conditions.todayLabel}` : ""}</p>
          <ul className="mt-4 grid gap-2 text-sm font-bold sm:grid-cols-2">
            <li>{conditions.alerts === null ? "Alerts unavailable" : count(conditions.alerts.length, "active alert", "active alerts")}</li>
            <li>{conditions.campgrounds === null ? "Campground notices unavailable" : count(conditions.notices.length, "campground notice", "campground notices")}</li>
            <li>Current weather: {weatherLine}</li>
            <li>{conditions.visitorCenters === null ? "Visitor centers unavailable" : count(conditions.visitorCenters.length, "nearby visitor center", "nearby visitor centers")}</li>
            <li>{conditions.events === null ? "Events unavailable" : count(conditions.events.length, "event today", "events today")}</li>
          </ul>
        </section>
        <Photo park={park} />
      </div>

      {conditions.warnings.length > 0 && (
        <ul className="mt-4 space-y-2" role="status">
          {conditions.warnings.map((warning) => (
            <li key={`${warning.source}-${warning.message}`} className="rounded-2xl border border-line bg-sand px-4 py-3 text-sm">{warning.message}</li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {park.url && <a className="rounded-full bg-pine px-4 py-2 font-bold text-card" href={park.url} target="_blank" rel="noopener noreferrer">Official park page</a>}
        {directions && <a className="rounded-full border border-pine px-4 py-2 font-bold text-pine" href={directions} target="_blank" rel="noopener noreferrer">Directions</a>}
        {phone && <a className="rounded-full border border-pine px-4 py-2 font-bold text-pine" href={phone}>Call {formatPhone(park.phone)}</a>}
      </div>

      <Section title="Alerts">
        {conditions.alerts === null ? <Unavailable /> : conditions.alerts.length === 0 ? <p>No active alerts were posted for this park.</p> : (
          <ul className="space-y-3">
            {conditions.alerts.map((alert) => (
              <li key={alert.id} className="rounded-3xl border border-line bg-card p-4">
                <p className="text-sm font-bold uppercase tracking-wide text-clay">{alert.category}</p>
                <h3 className="mt-1 font-serif text-2xl font-semibold">{alert.title}</h3>
                <p className="mt-2 whitespace-pre-wrap">{alert.description}</p>
                {alert.url && <a className="mt-3 inline-flex font-bold text-pine underline" href={alert.url} target="_blank" rel="noopener noreferrer">Read on NPS.gov</a>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Road incidents">
        {conditions.roadEvents === null ? <Unavailable /> : conditions.roadEvents.length === 0 ? <p>No road events were posted.</p> : (
          <ul className="space-y-3">
            {conditions.roadEvents.map((event) => (
              <li key={event.id} className="rounded-3xl border border-line bg-card p-4">
                <p className="text-sm font-bold uppercase tracking-wide text-clay">{event.eventType}</p>
                <h3 className="font-serif text-2xl font-semibold">{event.title}</h3>
                {event.description && <p className="mt-2 whitespace-pre-wrap">{event.description}</p>}
                {event.url && <a className="mt-3 inline-flex font-bold text-pine underline" href={event.url} target="_blank" rel="noopener noreferrer">Road event details</a>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Campgrounds">
        {conditions.notices.length > 0 && (
          <ul className="mb-4 space-y-2">
            {conditions.notices.map((notice) => (
              <li key={notice.id} className="rounded-2xl bg-sand px-4 py-3">
                <p className="font-bold">{notice.place ? `${notice.place}: ${notice.title}` : notice.title}</p>
                <p className="mt-1 text-sm">{notice.detail}</p>
              </li>
            ))}
          </ul>
        )}
        {conditions.campgrounds === null ? <Unavailable /> : conditions.campgrounds.length === 0 ? <p>No campgrounds were listed.</p> : (
          <ul className="grid gap-3 md:grid-cols-2">
            {conditions.campgrounds.map((camp) => (
              <li key={camp.id} id={camp.id} className="rounded-3xl border border-line bg-card p-4">
                <h3 className="font-serif text-2xl font-semibold">{camp.name}</h3>
                {camp.totalSites && <p className="mt-1 text-sm font-bold">{camp.totalSites} sites listed</p>}
                {camp.description && <p className="mt-2">{camp.description}</p>}
                <Hours schedule={camp.schedule} />
                <p className="mt-2 text-sm">{camp.regulations ? camp.regulations : "Regulations: Information unavailable"}</p>
                <div className="mt-3 flex flex-wrap gap-3 text-sm font-bold">
                  {camp.url && <a className="text-pine underline" href={camp.url} target="_blank" rel="noopener noreferrer">Campground page</a>}
                  {camp.reservationUrl && <a className="text-pine underline" href={camp.reservationUrl} target="_blank" rel="noopener noreferrer">Reservations</a>}
                  {directionsHref(camp.latitude, camp.longitude) && <a className="text-pine underline" href={directionsHref(camp.latitude, camp.longitude) ?? undefined} target="_blank" rel="noopener noreferrer">Directions</a>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Weather">
        <p className="text-sm">Forecast for the park&apos;s published coordinates{conditions.weather?.placeLabel ? ` near ${conditions.weather.placeLabel}` : ""}. A large park covers more than one forecast zone.</p>
        {conditions.weather === null ? <p className="mt-3">{UNAVAILABLE}</p> : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {conditions.weather.periods.map((period) => (
              <li key={period.name} className="rounded-3xl border border-line bg-card p-4">
                <p className="text-sm font-bold text-pine">{period.name}</p>
                <p className="mt-1 font-serif text-3xl font-semibold">{period.temperature}</p>
                <p className="mt-1">{period.shortForecast}</p>
                {period.wind && <p className="mt-1 text-sm">Wind {period.wind}</p>}
                {period.precipitation && <p className="text-sm">{period.precipitation}</p>}
              </li>
            ))}
          </ul>
        )}
        {conditions.weatherAlerts === null ? <p className="mt-3">Weather alerts: {UNAVAILABLE}</p> : conditions.weatherAlerts.length === 0 ? <p className="mt-3">No active weather alerts for this point.</p> : (
          <ul className="mt-3 space-y-3">
            {conditions.weatherAlerts.map((alert) => (
              <li key={alert.id} className="rounded-3xl border border-line bg-card p-4">
                <p className="text-sm font-bold uppercase tracking-wide text-clay">{alert.severity ?? "Weather alert"}</p>
                <h3 className="font-serif text-2xl font-semibold">{alert.event}</h3>
                {alert.headline && <p className="mt-2">{alert.headline}</p>}
                {alert.instruction && <p className="mt-2">{alert.instruction}</p>}
              </li>
            ))}
          </ul>
        )}
        {park.weatherOverview && <p className="mt-4 text-sm"><span className="font-bold">Park weather overview. </span>{park.weatherOverview}</p>}
      </Section>

      <Section title="Visitor centers">
        {conditions.visitorCenters === null ? <Unavailable /> : conditions.visitorCenters.length === 0 ? <p>No visitor centers were listed.</p> : (
          <ul className="grid gap-3 md:grid-cols-2">
            {conditions.visitorCenters.map((center) => {
              const centerPhone = telHref(center.phone);
              return (
                <li key={center.id} id={center.id} className="rounded-3xl border border-line bg-card p-4">
                  <h3 className="font-serif text-2xl font-semibold">{center.name}</h3>
                  {center.description && <p className="mt-2">{center.description}</p>}
                  <Hours schedule={center.schedule} />
                  {center.directions && <p className="mt-2 text-sm">{center.directions}</p>}
                  <div className="mt-3 flex flex-wrap gap-3 text-sm font-bold">
                    {centerPhone && <a className="text-pine underline" href={centerPhone}>Call {formatPhone(center.phone)}</a>}
                    {center.url && <a className="text-pine underline" href={center.url} target="_blank" rel="noopener noreferrer">Visitor center page</a>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title="Today's events">
        {conditions.events === null ? <Unavailable /> : conditions.events.length === 0 ? <p>No events listed for today.</p> : (
          <ul className="space-y-3">
            {conditions.events.map((event) => (
              <li key={event.id} className="rounded-3xl border border-line bg-card p-4">
                <h3 className="font-serif text-2xl font-semibold">{event.title}</h3>
                <p className="mt-1 text-sm font-bold">{[event.time, event.location, event.recurring ? "Recurring" : null].filter(Boolean).join(" · ") || UNAVAILABLE}</p>
                {event.description && <p className="mt-2">{event.description}</p>}
                {event.url && <a className="mt-3 inline-flex font-bold text-pine underline" href={event.url} target="_blank" rel="noopener noreferrer">Event details</a>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Map">
        <ParkMap boundary={conditions.boundary} points={conditions.points} />
      </Section>

      <Section title="Activities">
        {park.activities.length > 0 && <p className="font-bold">{park.activities.join(" · ")}</p>}
        {conditions.activities === null ? <p className="mt-3">Suggested things to do: {UNAVAILABLE}</p> : conditions.activities.length === 0 ? <p className="mt-3">No suggested things to do were listed.</p> : (
          <ul className="mt-3 grid gap-3 md:grid-cols-2">
            {conditions.activities.map((activity) => (
              <li key={activity.id} className="rounded-3xl border border-line bg-card p-4">
                <h3 className="font-serif text-2xl font-semibold">{activity.title}</h3>
                <p className="mt-1 text-sm font-bold">{[activity.duration, activity.location].filter(Boolean).join(" · ")}</p>
                {activity.summary && <p className="mt-2">{activity.summary}</p>}
                {activity.url && <a className="mt-3 inline-flex font-bold text-pine underline" href={activity.url} target="_blank" rel="noopener noreferrer">Activity page</a>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Accessibility">
        {conditions.accessibility === null ? <Unavailable /> : conditions.accessibility.length === 0 ? <p>{UNAVAILABLE}</p> : (
          <dl className="space-y-2">
            {conditions.accessibility.map((fact) => (
              <div key={`${fact.label}-${fact.value}`} className="grid gap-1 border-b border-line py-2 sm:grid-cols-[16rem_1fr]">
                <dt className="font-bold text-ink/70">{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
        )}
        <p className="mt-3 text-sm">Accessibility notes are copied from National Park Service listings. Call the park to confirm a specific route or building.</p>
      </Section>

      <Section title="Fees">
        {conditions.fees === null ? <Unavailable /> : conditions.fees.length === 0 ? <p>No entrance fees were listed.</p> : (
          <ul className="space-y-3">
            {conditions.fees.map((fee) => (
              <li key={`${fee.kind}-${fee.title}`} className="rounded-3xl border border-line bg-card p-4">
                <p className="text-sm font-bold uppercase tracking-wide text-pine">{fee.kind === "pass" ? "Pass" : "Fee"}</p>
                <h3 className="font-serif text-2xl font-semibold">{fee.title}</h3>
                <p className="mt-1 font-bold">{show(formatCost(fee.cost))}</p>
                {fee.description && <p className="mt-2">{fee.description}</p>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Hours">
        {park.schedules.length === 0 ? <p>{UNAVAILABLE}</p> : park.schedules.map((schedule) => (
          <div key={schedule.name} className="mb-4 rounded-3xl border border-line bg-card p-4">
            <h3 className="font-serif text-2xl font-semibold">{schedule.name}</h3>
            {schedule.description && <p className="mt-2 text-sm">{schedule.description}</p>}
            <Hours schedule={schedule} />
            <dl className="mt-3 grid gap-1 sm:grid-cols-2">
              {schedule.week.map((day) => (
                <div key={day.day} className="flex justify-between gap-3 border-b border-line py-1 text-sm">
                  <dt className="font-bold">{day.day}</dt>
                  <dd>{day.hours}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
        {conditions.timeZone && <p className="text-sm">Times use {conditions.timeZone}.</p>}
      </Section>

      <Section title="Directions and coordinates">
        <p>{park.directions ?? UNAVAILABLE}</p>
        <p className="mt-2 font-bold">{park.latitude !== null && park.longitude !== null ? `${park.latitude.toFixed(4)}, ${park.longitude.toFixed(4)}` : UNAVAILABLE}</p>
        {park.directionsUrl && <a className="mt-3 inline-flex font-bold text-pine underline" href={park.directionsUrl} target="_blank" rel="noopener noreferrer">NPS directions page</a>}
      </Section>

      <p className="mt-8 text-sm text-ink/70">Checked {checkedAt(conditions.retrievedAt, conditions.timeZone)}. NPS alert data can lag the park website by about two hours.</p>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-serif text-3xl font-semibold">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Unavailable() {
  return <p>{UNAVAILABLE}</p>;
}

function Photo({ park }: { park: ParkConditions["park"] }) {
  const image = park.images[0];
  if (!image) {
    return <div className="grid min-h-48 place-items-center rounded-3xl border border-line bg-mist p-5 text-sm">Photos: {UNAVAILABLE}</div>;
  }
  return (
    <figure className="overflow-hidden rounded-3xl border border-line bg-card">
      {/* NPS photos are already hosted; the browser loads them directly. */}
      <img src={image.url} alt={image.alt} className="h-64 w-full object-cover" />
      <figcaption className="px-4 py-3 text-sm">
        {image.caption && <span>{image.caption} </span>}
        {image.credit ? <span>Credit: {image.credit}</span> : <span>National Park Service</span>}
      </figcaption>
    </figure>
  );
}

function Hours({ schedule }: { schedule: HourSchedule | null }) {
  if (!schedule) return <p className="mt-2 text-sm">Hours: {UNAVAILABLE}</p>;
  return <p className="mt-2 text-sm font-bold">Today: {schedule.todayText ?? UNAVAILABLE}</p>;
}

function count(amount: number, singular: string, plural: string): string {
  return `${amount} ${amount === 1 ? singular : plural}`;
}
