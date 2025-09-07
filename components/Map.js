import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";
const DefaultIcon = L.icon({ iconUrl, shadowUrl: iconShadow, iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

export default function Map({ center, points }) {
  if (!center) return <div className="text-sm text-muted-foreground">Locating you…</div>;
  return (
    <MapContainer center={[center.lat, center.lon]} zoom={13} style={{ height: 320, width: "100%" }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {points?.map((p) => (
        <Marker key={p.id} position={[p.lat, p.lon]}>
          <Popup><b>{p.name}</b></Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
