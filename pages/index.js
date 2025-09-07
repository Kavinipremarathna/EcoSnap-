import { useEffect, useMemo, useState, useRef } from "react";
import Head from "next/head";
import dynamic from "next/dynamic";
import { ensureAnonUser, addPoints, topUsers } from "../lib/firebase";

const Map = dynamic(() => import("../components/Map"), { ssr: false });

const categories = {
  Recycle: { color: "bg-emerald-600" },
  Compost: { color: "bg-lime-600" },
  "E-waste": { color: "bg-red-600" },
  General: { color: "bg-stone-600" },
};

function Badge({ label }) {
  const c = categories[label] || categories["General"];
  return (
    <span className={`inline-flex items-center gap-1 ${c.color} text-white text-xs px-2.5 py-1 rounded-full shadow-sm`}>
      {label}
    </span>
  );
}

/* --------- image compressor (used in onFile) --------- */
async function compressImage(file, maxW = 800, maxH = 800, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error("Compression failed"));
          const out = new File(
            [blob],
            (file.name || "image").replace(/\.\w+$/, "") + "-compressed.jpg",
            { type: "image/jpeg" }
          );
          resolve(out);
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
/* ----------------------------------------------------- */

export default function Home() {
  const [dark, setDark] = useState(false);
  const [user, setUser] = useState(null);
  const [me] = useState({ points: 0, totalCO2: 0 });
  const [leaders, setLeaders] = useState([]);
  const [result, setResult] = useState(null);
  const [center, setCenter] = useState(null);
  const [points, setPoints] = useState([]);
  const fileRef = useRef(null);

  const themeClass = useMemo(() => (dark ? "dark" : ""), [dark]);

  useEffect(() => {
    ensureAnonUser().then(async (u) => {
      setUser(u);
      setLeaders(await topUsers());
    });
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const c = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      setCenter(c);
      const query = `[out:json];(node(around:2000,${c.lat},${c.lon})["amenity"="recycling"];);out center;`;
      const res = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ data: query }),
      });
      const data = await res.json();
      const pts =
        (data?.elements || []).map((n) => ({
          id: n.id,
          lat: n.lat,
          lon: n.lon,
          name: n.tags?.name || "Recycling Point",
        })) || [];
      setPoints(pts);
    });
  }, []);

  function toBase64(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  async function onFile(e) {
    let f = e.target.files?.[0];
    if (!f) return;

    // compress before sending (now defined above)
    try {
      f = await compressImage(f);
    } catch (err) {
      console.warn("Compression failed, sending original:", err);
    }

    const base64 = await toBase64(f);
    const res = await fetch("/api/classify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64: base64 }),
    });
    const data = await res.json();
    setResult(data);

    if (user && !data.error) {
      await addPoints(user.uid, 10, 0.02);
      setLeaders(await topUsers());
    }
  }

  return (
    <div className={themeClass}>
      <Head>
        <title>EcoSnap – Firebase + Hugging Face</title>
      </Head>
      <div className="min-h-screen bg-background text-foreground transition-colors">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl grid place-items-center bg-emerald-600 text-white shadow-md">♻️</div>
              <div>
                <div className="text-xl font-semibold leading-tight">EcoSnap</div>
                <div className="text-xs text-muted-foreground -mt-0.5">Snap → Sort → Sustain</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-xs text-muted-foreground">Points: <b>{me.points ?? 0}</b></div>
              <button
                onClick={() => setDark(!dark)}
                className="inline-flex items-center gap-2 rounded-xl px-3 py-2 border border-border bg-card hover:bg-accent/50 transition text-sm"
              >
                {dark ? "Light" : "Dark"} mode
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                className="rounded-xl px-3 py-2 bg-emerald-600 text-white text-sm hover:bg-emerald-700 transition shadow-sm"
              >
                Upload
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
            </div>
          </header>

          <section className="grid md:grid-cols-3 gap-6 mt-8">
            <div className="rounded-3xl border bg-card p-5">
              <div className="font-medium mb-3">Upload / Capture</div>
              <label
                className="grid place-items-center h-44 rounded-2xl border border-dashed cursor-pointer hover:bg-accent/40"
                onClick={() => fileRef.current?.click()}
              >
                <div className="text-center text-muted-foreground text-sm">Click to upload or drag & drop</div>
              </label>
            </div>

            <div className="rounded-3xl border bg-card p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="font-medium">Classification Result</div>
                {result && !result.error && <Badge label={result.category} />}
              </div>
              {!result ? (
                <div className="text-sm text-muted-foreground">Your result will appear here after upload.</div>
              ) : result.error ? (
                <div className="text-sm text-red-600">Error: {result.error}</div>
              ) : (
                <div className="space-y-2">
                  <div className="text-sm">Category: <span className="font-semibold">{result.category}</span></div>
                  <div className="text-xs text-muted-foreground">Confidence: {Math.round(result.score * 100)}%</div>
                  <p className="text-xs mt-1 text-muted-foreground">Tip: Rinse containers before recycling for better processing.</p>
                </div>
              )}
            </div>

            <div className="rounded-3xl border bg-card p-5">
              <div className="flex items-center gap-2 mb-3"><span className="font-medium">Leaderboard</span></div>
              <ol className="space-y-2 list-decimal pl-5 text-sm text-muted-foreground">
                {leaders.map((u) => (
                  <li key={u.id}>User {u.id.slice(0, 6)} — <b>{u.points}</b> pts • {(u.totalCO2 || 0).toFixed(2)} kg CO₂</li>
                ))}
                {!leaders.length && <li>No data yet</li>}
              </ol>
            </div>
          </section>

          <section className="rounded-3xl border bg-card p-5 mt-6">
            <div className="flex items-center justify-between mb-3">
              <div className="font-medium">Nearby Recycling Points</div>
              <span className="text-xs text-muted-foreground">auto • 2km radius</span>
            </div>
            <Map center={center} points={points} />
          </section>

          <footer className="py-8 text-center text-xs text-muted-foreground">
            Firebase • Hugging Face • Next.js • Tailwind • OSM
          </footer>
        </div>
      </div>
    </div>
  );
}
