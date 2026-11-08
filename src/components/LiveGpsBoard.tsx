"use client";

type PreviewBus = {
  id: string;
  label: string;
  etaMinutes: number;
  miles: number;
  status: "On route" | "Arriving" | "At school";
  map: { left: string; top: string };
};

const SAMPLE: PreviewBus[] = [
  {
    id: "1",
    label: "Bus 1",
    etaMinutes: 4,
    miles: 0.8,
    status: "Arriving",
    map: { left: "28%", top: "42%" },
  },
  {
    id: "2",
    label: "Bus 2",
    etaMinutes: 9,
    miles: 1.6,
    status: "On route",
    map: { left: "48%", top: "58%" },
  },
  {
    id: "3",
    label: "Bus 3",
    etaMinutes: 14,
    miles: 2.4,
    status: "On route",
    map: { left: "62%", top: "34%" },
  },
];

function buildBuses(labels: string[]): PreviewBus[] {
  const clean = [...new Set(labels.map((value) => value.trim()).filter(Boolean))];
  if (!clean.length) return SAMPLE;
  return clean.slice(0, 12).map((label, index) => {
    const sample = SAMPLE[index % SAMPLE.length];
    const etaMinutes = 3 + index * 4;
    return {
      id: `${index + 1}`,
      label: /^bus\b/i.test(label) ? label : `Bus ${label}`,
      etaMinutes,
      miles: Number((0.6 + index * 0.7).toFixed(1)),
      status: etaMinutes <= 5 ? "Arriving" : "On route",
      map: {
        left: `${22 + ((index * 17) % 50)}%`,
        top: `${30 + ((index * 13) % 40)}%`,
      },
    };
  });
}

export function LiveGpsBoard({
  schoolName,
  busLabels = [],
  audience = "school",
}: {
  schoolName: string;
  busLabels?: string[];
  audience?: "school" | "company";
}) {
  const buses = buildBuses(busLabels);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-4xl text-navy">Live GPS</h1>
          <p className="mt-1 text-muted">
            {schoolName} · morning and afternoon bus locations
          </p>
        </div>
        <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-950">
          Preview · waiting for bus company API
        </span>
      </div>

      <p className="rounded-2xl border border-line bg-paper px-4 py-3 text-sm text-muted">
        {audience === "company"
          ? "This is the AMPM Flow screen schools will use once your live GPS feed is connected. Positions and ETAs below are sample only."
          : "Screen is ready. Live pins and arrival times turn on when the bus company shares their GPS API."}
      </p>

      <section className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-navy">Live bus locations</h2>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
            LIVE layout
          </span>
        </div>

        <div className="grid lg:grid-cols-[1.4fr_0.9fr]">
          <div className="relative min-h-[320px] border-b border-line bg-[#eef3f7] lg:min-h-[420px] lg:border-b-0 lg:border-r">
            <div
              className="absolute inset-0 opacity-70"
              style={{
                backgroundImage:
                  "linear-gradient(#d5dee8 1px, transparent 1px), linear-gradient(90deg, #d5dee8 1px, transparent 1px)",
                backgroundSize: "48px 48px",
              }}
            />
            <p className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-navy shadow-sm">
              Map preview
            </p>
            <div
              className="absolute z-10 flex -translate-x-1/2 -translate-y-full flex-col items-center"
              style={{ left: "40%", top: "28%" }}
            >
              <span className="rounded-md bg-red-600 px-2 py-1 text-[11px] font-bold text-white shadow">
                School
              </span>
              <span className="mt-1 h-0 w-0 border-x-8 border-t-8 border-x-transparent border-t-red-600" />
            </div>
            {buses.map((bus) => (
              <div
                key={bus.id}
                className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
                style={{ left: bus.map.left, top: bus.map.top }}
              >
                <div className="rounded-xl bg-[#f5c518] px-2.5 py-1.5 text-center text-[11px] font-extrabold text-navy shadow-md ring-2 ring-white">
                  {bus.label}
                </div>
              </div>
            ))}
            <div className="absolute bottom-3 left-3 rounded-xl bg-white/95 px-3 py-2 text-[11px] text-muted shadow-sm">
              <p>
                <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-[#f5c518]" />{" "}
                Bus (live)
              </p>
              <p className="mt-1">
                <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-red-600" />{" "}
                School
              </p>
            </div>
          </div>

          <div className="flex max-h-[420px] flex-col overflow-auto p-3">
            <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              Time to school
            </p>
            <ul className="space-y-2">
              {buses.map((bus) => (
                <li
                  key={bus.id}
                  className="rounded-xl border border-line bg-paper px-3 py-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-navy">{bus.label}</p>
                      <p className="mt-0.5 text-sm text-muted">
                        {bus.miles} mi from school
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                      Sample
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-navy">
                    <span className="font-extrabold">{bus.etaMinutes} min</span>{" "}
                    to school · {bus.status}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-3 px-1 text-xs italic text-muted">
              Illustrative locations until the GPS API is connected.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
