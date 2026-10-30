import Link from "next/link";

const steps = [
  { title: "Tell us your break", body: "How long you have and how you feel. Two taps." },
  { title: "Get three picks", body: "Claude ranks what's open, nearby and actually fits — pop-ups included." },
  { title: "Go", body: "Walking directions, a time plan, and a one-tap invite for friends." },
];

export default function Landing() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-10 px-4 py-16">
      <div className="space-y-5">
        <p className="text-sm font-semibold tracking-wide text-accent uppercase">One-Hour Break Planner</p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Stop scrolling through your break.
          <br />
          Start using it.
        </h1>
        <p className="max-w-xl text-lg text-muted">
          Personalized, real-time ideas for the hour between classes — food, a workout, a pop-up, a friend —
          decided in under a minute.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/login?mode=signup" className="btn-primary px-6 py-3 text-base">
            Get started
          </Link>
          <Link href="/login" className="btn-ghost px-6 py-3 text-base">
            Sign in
          </Link>
        </div>
      </div>
      <ol className="grid gap-3 sm:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.title} className="card">
            <span className="text-sm font-semibold text-accent">{i + 1}</span>
            <h2 className="mt-1 font-semibold">{s.title}</h2>
            <p className="mt-1 text-sm text-muted">{s.body}</p>
          </li>
        ))}
      </ol>
    </main>
  );
}
