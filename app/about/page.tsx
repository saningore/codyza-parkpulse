export const metadata = { title: "About" };

export default function AboutPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-serif text-4xl font-semibold">About ParkPulse</h1>
      <p className="mt-3 text-lg">ParkPulse answers one question: can I actually visit this park today? A park directory is the way in. The visit status is the product.</p>
      <section className="mt-8">
        <h2 className="font-serif text-2xl font-semibold">What the status means</h2>
        <p className="mt-2">Closed today means listed hours say closed, or an alert says the whole park is closed to visitors. A closure for one road or campground is Restricted, not a full closure. Hazard means a danger alert. Caution means a park caution or a weather watch or warning at the park point. Open today is used only when hours say open and those alerts are absent. If alerts do not load, the status stays Unconfirmed.</p>
      </section>
      <section className="mt-8">
        <h2 className="font-serif text-2xl font-semibold">What stays on this device</h2>
        <p className="mt-2">The server keeps a directory of National Park Service sites so search does not depend on a live API call. Saved parks stay in this browser. ParkPulse does not ask for an account, and it does not take visitor reports. Reservation availability is a different question, answered on Recreation.gov.</p>
      </section>
      <section className="mt-8">
        <h2 className="font-serif text-2xl font-semibold">Before you go</h2>
        <p className="mt-2">Read the official park page. Entrance rules, weather, and road status can change after this page was checked.</p>
      </section>
    </article>
  );
}
