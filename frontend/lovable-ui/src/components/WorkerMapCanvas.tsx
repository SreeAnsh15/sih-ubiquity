import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import { CUSTOMER_LOCATION, inr, type Worker } from "@/lib/api";

function pin(label: string, rate: string, tone: "worker" | "me", active: boolean) {
  const bg = tone === "me" ? "#1D4ED8" : active ? "#EA580C" : "#059669";
  return L.divIcon({
    className: "ubiquity-pin",
    iconSize: [140, 46],
    iconAnchor: [22, 44],
    html: `
      <div style="display:flex;align-items:center;gap:6px;white-space:nowrap">
        <div style="width:34px;height:34px;border-radius:9999px;background:${bg};color:#fff;
          display:flex;align-items:center;justify-content:center;font:700 12px 'Inter Tight',sans-serif;
          border:3px solid #fff;box-shadow:0 4px 12px rgba(15,23,42,.28)">${label.slice(0, 2).toUpperCase()}</div>
        <div style="background:#fff;border:1px solid #E2E8F0;border-radius:9999px;padding:3px 9px;
          font:600 11px 'Inter Tight',sans-serif;color:#0F172A;box-shadow:0 3px 10px rgba(15,23,42,.14)">
          ${label}${rate ? ` · <span style="color:#059669;font-weight:700">${rate}</span>` : ""}
        </div>
      </div>`,
  });
}

function AutoSize() {
  const map = useMap();
  useEffect(() => {
    const fix = () => map.invalidateSize();
    const t = setTimeout(fix, 250);
    const ro = new ResizeObserver(fix);
    ro.observe(map.getContainer());
    return () => {
      clearTimeout(t);
      ro.disconnect();
    };
  }, [map]);
  return null;
}

export default function WorkerMapCanvas({
  workers,
  selectedId,
  onSelect,
}: {
  workers: Worker[];
  selectedId?: string | undefined;
  onSelect: (w: Worker) => void;
}) {
  return (
    <MapContainer
      center={[CUSTOMER_LOCATION.lat, CUSTOMER_LOCATION.lng]}
      zoom={14}
      scrollWheelZoom
      className="h-full w-full"
      style={{ background: "#F8FAFC" }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <AutoSize />
      <Circle
        center={[CUSTOMER_LOCATION.lat, CUSTOMER_LOCATION.lng]}
        radius={1600}
        pathOptions={{ color: "#1D4ED8", weight: 1, fillColor: "#1D4ED8", fillOpacity: 0.06 }}
      />
      <Marker
        position={[CUSTOMER_LOCATION.lat, CUSTOMER_LOCATION.lng]}
        icon={pin("Customer Current Location", "", "me", false)}
      />
      {workers.map((w) => (
        <Marker
          key={w.id}
          position={[w.lat, w.lng]}
          icon={pin(w.name, inr(w.coopPrice), "worker", w.id === selectedId)}
          eventHandlers={{ click: () => onSelect(w) }}
        >
          <Popup>
            <div className="text-sm">
              <p className="font-semibold text-navy">{w.name}</p>
              <p className="text-muted-foreground">
                {w.skill} · {w.distanceKm.toFixed(1)} km · {w.rating.toFixed(1)} ★
              </p>
              <p className="font-semibold text-trust">{inr(w.coopPrice)}</p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
