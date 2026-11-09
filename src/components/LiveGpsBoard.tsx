"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { loadLiveGpsFeed } from "@/app/actions/gps";
import type { LiveBusPoint, LiveGpsFeed } from "@/lib/onestep-gps";
import { LiveGpsMap, type MapMarker } from "@/components/LiveGpsMap";

type BoardBus = {
  id: string;
  label: string;
  etaMinutes: number | null;
  miles: number | null;
  status: string;
  pending?: boolean;
  lat?: number | null;
  lng?: number | null;
  map: { left: string; top: string };
};

const AIM_PIN = { lat: 44.950661, lng: -93.257431 };

/** Minnehaha: 3 Aim buses. GPS for Bus 4 + Bus 5 now; 3rd unit # later. */
const SAMPLE: BoardBus[] = [
  {
    id: "4",
    label: "Bus 4",
    etaMinutes: 7,
    miles: 1.3,
    status: "On route",
    lat: AIM_PIN.lat - 0.018,
    lng: AIM_PIN.lng + 0.028,
    map: { left: "34%", top: "58%" },
  },
  {
    id: "5",
    label: "Bus 5",
    etaMinutes: 4,
    miles: 0.8,
    status: "Arriving",
    lat: AIM_PIN.lat + 0.012,
    lng: AIM_PIN.lng - 0.022,
    map: { left: "48%", top: "42%" },
  },
  {
    id: "pending-third",
    label: "3rd bus",
    etaMinutes: null,
    miles: null,
    status: "GPS soon",
    pending: true,
    map: { left: "62%", top: "48%" },
  },
];

export function LiveGpsBoard({
  schoolName,
  schoolId,
  audience = "school",
  initialFeed = null,
}: {
  schoolName: string;
  schoolId?: string;
  busLabels?: string[];
  audience?: "school" | "company";
  initialFeed?: LiveGpsFeed | null;
}) {
  const [feed, setFeed] = useState<LiveGpsFeed | null>(initialFeed);
  const [error, setError] = useState(initialFeed?.error || "");
  const [pending, start] = useTransition();
  const liveBuses =
    feed?.buses.filter((bus) => !bus.pending && bus.lat != null) || [];
  const live = Boolean(feed?.live && liveBuses.length);
  const buses: Array<BoardBus | LiveBusPoint> = feed?.buses?.length
    ? feed.buses
    : SAMPLE;

  const mapMarkers = useMemo(() => {
    const markers: MapMarker[] = [];
    const school =
      feed?.school || (/aim/i.test(schoolName) ? AIM_PIN : null);
    if (school) {
      markers.push({
        id: "school",
        label: "School",
        lat: school.lat,
        lng: school.lng,
        kind: "school",
      });
    }
    for (const bus of buses) {
      if (bus.pending) continue;
      if (bus.lat == null || bus.lng == null) continue;
      markers.push({
        id: bus.id,
        label: bus.label,
        lat: bus.lat,
        lng: bus.lng,
        kind: "bus",
      });
    }
    return markers;
  }, [buses, feed?.school, schoolName]);

  function refresh() {
    start(async () => {
      const result = await loadLiveGpsFeed(schoolId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setFeed(result.feed);
      setError(result.feed.error || "");
    });
  }

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 30000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-4xl text-navy">Live GPS</h1>
          <p className="mt-1 text-muted">
            {schoolName} · Minnehaha’s 3 Aim buses
          </p>
        </div>
        {live ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
            Live · OneStep GPS
          </span>
        ) : (
          <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-950">
            {feed?.configured
              ? "Connected · waiting for bus positions"
              : "Preview · waiting for bus company API"}
          </span>
        )}
      </div>

      <p className="rounded-2xl border border-line bg-paper px-4 py-3 text-sm text-muted">
        Minnehaha operates three Aim buses. Bus 4 and Bus 5 have GPS units now.
        The 3rd bus slot stays until they send that unit number.
        {pending ? " Updating…" : ""}
      </p>

      {error ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {error}
        </p>
      ) : null}
      {feed?.debug && !live ? (
        <p className="break-all text-xs text-muted">{feed.debug}</p>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-navy">Live bus locations</h2>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
            {live ? "LIVE" : "LIVE layout"}
          </span>
        </div>

        <div className="grid lg:grid-cols-[1.4fr_0.9fr]">
          <div className="relative border-b border-line lg:border-b-0 lg:border-r">
            {mapMarkers.length ? (
              <LiveGpsMap markers={mapMarkers} />
            ) : (
              <div className="flex min-h-[320px] items-center justify-center bg-[#eef3f7] text-sm text-muted lg:min-h-[420px]">
                Waiting for map points…
              </div>
            )}
            <div className="pointer-events-none absolute bottom-3 left-3 z-[500] rounded-xl bg-white/95 px-3 py-2 text-[11px] text-muted shadow-sm">
              <p>
                <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-[#f5c518]" />{" "}
                Bus {live ? "(live)" : "(sample)"}
              </p>
              <p className="mt-1">
                <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-red-600" />{" "}
                School
              </p>
            </div>
          </div>

          <div className="flex max-h-[420px] flex-col overflow-auto p-3">
            <p className="px-1 pb-2 text-sm font-extrabold uppercase tracking-wide text-navy">
              Time to school
            </p>
            <ul className="space-y-2">
              {buses.map((bus) => {
                const isPending = Boolean(bus.pending);
                return (
                  <li
                    key={bus.id}
                    className="rounded-xl border border-navy/15 bg-white px-3 py-3 shadow-[0_6px_18px_rgba(11,41,66,0.08)]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-navy">{bus.label}</p>
                        <p className="mt-0.5 text-sm text-muted">
                          {isPending
                            ? "Waiting for Minnehaha unit number"
                            : bus.miles != null
                              ? `${bus.miles} mi from school`
                              : live
                                ? "Distance needs school GPS pin"
                                : "Sample distance"}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          isPending
                            ? "bg-amber-50 text-amber-900"
                            : live
                              ? "bg-emerald-50 text-emerald-800"
                              : "bg-amber-50 text-amber-900"
                        }`}
                      >
                        {isPending ? "GPS soon" : live ? "Live" : "Sample"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-navy">
                      {isPending ? (
                        <>Unit # coming later · {bus.status}</>
                      ) : bus.etaMinutes != null ? (
                        <>
                          <span className="font-extrabold">
                            {bus.etaMinutes} min
                          </span>{" "}
                          to school · {bus.status}
                        </>
                      ) : live ? (
                        <>Waiting for school location · {bus.status}</>
                      ) : (
                        <>Sample ETA · {bus.status}</>
                      )}
                    </p>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 px-1 text-xs italic text-muted">
              Three Aim buses only. Add the 3rd GPS unit when Minnehaha shares
              it.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
