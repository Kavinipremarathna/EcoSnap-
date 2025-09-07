// pages/api/classify.js
export const config = { api: { bodyParser: { sizeLimit: "6mb" } } };

const HF_MODEL = process.env.HF_MODEL || "google/vit-base-patch16-224";
const HF_TOKEN = process.env.HF_TOKEN;

function labelToCategory(label) {
  const l = (label || "").toLowerCase();
  if (/(bottle|plastic|can|paper|cardboard|metal|glass|jar|tin|aluminium|aluminum)/.test(l)) return "Recycle";
  if (/(banana|food|vegetable|fruit|leaf|compost|organic)/.test(l)) return "Compost";
  if (/(battery|phone|laptop|electronics|bulb|television|tv|charger|circuit)/.test(l)) return "E-waste";
  return "General";
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  try {
    const { imageBase64 } = req.body || {};
    if (!imageBase64) return res.status(400).json({ error: "missing_image" });

    const buf = Buffer.from(imageBase64.split(",")[1], "base64");
    const r = await fetch(`https://api-inference.huggingface.co/models/${HF_MODEL}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        "Content-Type": "application/octet-stream",
      },
      body: buf,
    });

    if (!r.ok) {
      const txt = await r.text();
      return res.status(502).json({ error: "hf_failed", detail: txt.slice(0, 400) });
    }

    const preds = await r.json(); // array [{label, score}]..
    const top3 = Array.isArray(preds) ? preds.slice(0, 3) : [];
    const top = top3[0] || { label: "unknown", score: 0.5 };
    const category = labelToCategory(top.label);

    res.status(200).json({ category, score: top.score ?? 0.5, top3 });
  } catch (e) {
    res.status(500).json({ error: "classification_failed", detail: String(e).slice(0, 300) });
  }
}
