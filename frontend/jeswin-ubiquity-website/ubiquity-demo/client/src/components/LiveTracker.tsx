/** Civic Signal: live route-tracking uses a clear civic map, route line, squared status records, and simulated GPS movement. */
import { useEffect, useMemo, useRef, useState } from "react";
import { Clock3, LocateFixed, MapPin, Navigation, Pause, Play, Radio, Route, ShieldCheck, UserRound } from "lucide-react";
import { MapView } from "@/components/Map";
import type { Booking, BookingStatus, Role, Worker } from "@/lib/types";

interface LiveTrackerProps {
  booking: Booking;
  worker: Worker;
  role: Role;
  onStatusChange: (status: BookingStatus) => void;
}

const customerPoint = { lat: 13.08782, lng: 80.21633 };
const startPoint = { lat: 13.07592, lng: 80.24848 };

const routeFor = (progress: number) => {
  const bends = [
    startPoint,
    { lat: 13.07741, lng: 80.24436 },
    { lat: 13.07968, lng: 80.24008 },
    { lat: 13.08111, lng: 80.23656 },
    { lat: 13.08284, lng: 80.23274 },
    { lat: 13.08451, lng: 80.22878 },
    { lat: 13.08574, lng: 80.22319 },
    customerPoint,
  ];
  const segment = Math.min(bends.length - 2, Math.floor((progress / 100) * (bends.length - 1)));
  const local = ((progress / 100) * (bends.length - 1)) - segment;
  const from = bends[segment];
  const to = bends[segment + 1];
  return {
    bends,
    position: { lat: from.lat + (to.lat - from.lat) * local, lng: from.lng + (to.lng - from.lng) * local },
  };
};

const statusFor = (progress: number): BookingStatus => {
  if (progress < 12) return "Worker Assigned";
  if (progress < 74) return "On the Way";
  if (progress < 94) return "Arrived";
  return "In Progress";
};

function workerMarkerNode(name: string) {
  const node = document.createElement("div");
  const label = name.split(" ")[0].toUpperCase();
  const initial = name.slice(0, 1).toUpperCase();
  node.className = "map-person-marker worker";
  node.innerHTML = `<span class="map-ripple"></span><span class="map-marker-icon">${initial}</span><span class="map-marker-label">${label}</span>`;
  return node;
}

function customerMarkerNode() {
  const node = document.createElement("div");
  node.className = "map-person-marker customer";
  node.innerHTML = '<span class="map-marker-icon">R</span><span class="map-marker-label">RAHUL</span>';
  return node;
}

export function LiveTracker({ booking, worker, role, onStatusChange }: LiveTrackerProps) {
  const initialProgress = booking.status === "In Progress" ? 95 : booking.status === "Arrived" ? 79 : booking.status === "On the Way" ? 39 : 7;
  const [progress, setProgress] = useState(initialProgress);
  const [running, setRunning] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("Just now");
  const mapRef = useRef<google.maps.Map | null>(null);
  const workerMarker = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const polyline = useRef<google.maps.Polyline | null>(null);
  const lastStatus = useRef<BookingStatus>(booking.status);
  const { bends, position } = useMemo(() => routeFor(progress), [progress]);
  const status = statusFor(progress);
  const remaining = Math.max(0.1, Number((2.4 * (1 - progress / 100)).toFixed(1)));
  const eta = Math.max(1, Math.ceil(8 * (1 - progress / 100)));

  useEffect(() => {
    setProgress(booking.status === "In Progress" ? 95 : booking.status === "Arrived" ? 79 : booking.status === "On the Way" ? 39 : 7);
    lastStatus.current = booking.status;
  }, [booking.id]);

  useEffect(() => {
    if (!running || progress >= 98) return;
    const timer = window.setInterval(() => {
      setProgress((current) => Math.min(98, current + 4));
      setLastUpdated("Just now");
    }, 2600);
    return () => window.clearInterval(timer);
  }, [running, progress]);

  useEffect(() => {
    if (status !== lastStatus.current) {
      lastStatus.current = status;
      onStatusChange(status);
    }
  }, [onStatusChange, status]);

  useEffect(() => {
    if (!workerMarker.current || !polyline.current || !mapRef.current) return;
    workerMarker.current.position = position;
    const activePath = bends.slice(0, Math.max(2, Math.floor((progress / 100) * (bends.length - 1)) + 2));
    activePath[activePath.length - 1] = position;
    polyline.current.setPath(activePath);
    mapRef.current.panTo(position);
  }, [bends, position, progress]);

  const onMapReady = (map: google.maps.Map) => {
    mapRef.current = map;
    map.setOptions({ disableDefaultUI: true, zoomControl: true, gestureHandling: "greedy", styles: [
      { elementType: "geometry", stylers: [{ color: "#f2f3ee" }] },
      { elementType: "labels.text.fill", stylers: [{ color: "#64748b" }] },
      { elementType: "labels.text.stroke", stylers: [{ color: "#f8fafc" }] },
      { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
      { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#e3e8ee" }] },
      { featureType: "water", elementType: "geometry", stylers: [{ color: "#dcecf2" }] },
      { featureType: "poi", elementType: "geometry", stylers: [{ color: "#eaf1e9" }] },
    ] });
    const route = new google.maps.Polyline({ path: bends, strokeColor: "#193a8a", strokeOpacity: 0.88, strokeWeight: 5, geodesic: true, map });
    polyline.current = route;
    workerMarker.current = new google.maps.marker.AdvancedMarkerElement({ map, position, title: `${worker.name} — live location`, content: workerMarkerNode(worker.name) });
    new google.maps.marker.AdvancedMarkerElement({ map, position: customerPoint, title: "Rahul — service address", content: customerMarkerNode() });
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(startPoint); bounds.extend(customerPoint); map.fitBounds(bounds, 72);
  };

  return <section className="live-tracker">
    <div className="tracker-map-frame">
      <div className="map-fallback-grid" aria-hidden="true"><span /><span /><span /><span /></div>
      <MapView className="live-google-map" initialCenter={{ lat: 13.0827, lng: 80.2324 }} initialZoom={13} onMapReady={onMapReady} />
      <div className="mock-route-layer" aria-hidden="true">
        <svg className="mock-route-svg" viewBox="0 0 100 100" preserveAspectRatio="none"><path className="route-shadow" pathLength="100" d="M 10 87 C 24 77, 26 67, 43 59 S 64 40, 88 18" /><path className="route-progress" pathLength="100" d="M 10 87 C 24 77, 26 67, 43 59 S 64 40, 88 18" style={{ strokeDasharray: `${progress} 100` }} /></svg>
        <div className="mock-map-pin customer" style={{ left: "88%", top: "18%" }}><span>R</span><b>RAHUL</b></div>
        <div className="mock-map-pin worker" style={{ left: `${10 + progress * 0.75}%`, top: `${87 - progress * 0.68 + Math.sin(progress / 9) * 4}%` }}><i /><span>{worker.name.slice(0, 1)}</span><b>{worker.name.split(" ")[0].toUpperCase()}</b></div>
      </div>
      <div className="tracker-map-top"><span className="live-stamp"><i />LIVE GPS · MOCK</span><button onClick={() => setProgress(7)}><LocateFixed size={15} />Recenter route</button></div>
      <div className="tracker-map-bottom"><div><Route size={17} /><span><strong>{remaining} km remaining</strong><small>Anna Nagar service route</small></span></div><span>{Math.round(progress)}%</span></div>
    </div>
    <div className="tracker-details">
      <div className="tracker-status-row"><div><span className="eyebrow">LIVE SERVICE STATUS</span><h2>{status === "Worker Assigned" ? `${worker.name.split(" ")[0]} is preparing to leave.` : status === "On the Way" ? `${worker.name.split(" ")[0]} is on the way.` : status === "Arrived" ? `${worker.name.split(" ")[0]} has reached your location.` : `${worker.name.split(" ")[0]} is working on the repair.`}</h2></div><span className={`tracker-status ${status.toLowerCase().replaceAll(" ", "-")}`}><i />{status}</span></div>
      <div className="tracker-eta"><div className="eta-orb"><Clock3 size={20} /><strong>{eta}</strong><small>min</small></div><div><span>{status === "Arrived" ? "Worker is at the service address" : "Estimated arrival"}</span><strong>{status === "Arrived" ? booking.location.split(",")[0] : `by ${booking.time}`}</strong><small><Radio size={13} />Location refreshed {lastUpdated.toLowerCase()}</small></div></div>
      <div className="route-parties"><div><span className="party-icon customer"><UserRound size={16} /></span><div><small>CUSTOMER</small><strong>Rahul Kumar</strong><span>{booking.location.split(",")[0]}</span></div></div><div className="route-link"><i /><Navigation size={16} /><i /></div><div><span className="party-icon worker"><Navigation size={16} /></span><div><small>WORKER</small><strong>{worker.name}</strong><span>Plumber · {worker.rating} rating</span></div></div></div>
      <div className="tracker-actions"><button className="outline-button" onClick={() => setRunning(!running)}>{running ? <Pause size={16} /> : <Play size={16} />}{running ? "Pause mock GPS" : "Resume mock GPS"}</button>{role === "customer" ? <button className="primary-button"><ShieldCheck size={16} />Share trip details</button> : <button className="primary-button"><MapPin size={16} />Open customer address</button>}</div>
    </div>
  </section>;
}
