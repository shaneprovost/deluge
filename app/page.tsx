import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="font-serif text-4xl text-primary mb-2">Deluge</h1>
      <p className="text-charcoal/80 mb-8 text-center max-w-md">
        Pray for deceased clergy and religious of the Atlanta Archdiocese.
      </p>
      <div className="flex gap-4">
        <Link
          href="/pray"
          className="rounded-lg bg-primary px-6 py-3 text-cream font-medium shadow-md hover:opacity-90 transition"
        >
          Pray for someone
        </Link>
        <Link
          href="/map"
          className="rounded-lg border-2 border-primary px-6 py-3 text-primary font-medium hover:bg-primary/5 transition"
        >
          View map
        </Link>
      </div>
    </main>
  );
}
