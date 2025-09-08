export const config = { api: { bodyParser: { sizeLimit: "6mb" } } };

const HF_MODEL = process.env.HF_MODEL || "microsoft/resnet-50";
const HF_TOKEN = process.env.HF_TOKEN;
// wait_for_model helps avoid cold-start 503s
const HF_ENDPOINT = `https://api-inference.huggingface.co/models/${HF_MODEL}?wait_for_model=true`;

function labelToCategory(label) {
  const l = (label || "").toLowerCase();
  if (/(bottle|plastic|can|paper|cardboard|metal|glass|jar|tin|aluminium|aluminum)/.test(l)) return "Recycle";
  if (/(banana|food|vegetable|fruit|leaf|compost|organic)/.test(l)) return "Compost";
  if (/(battery|phone|laptop|electronics|bulb|television|tv|charger|circuit)/.test(l)) return "E-waste";
  return "General";
}

async function callHF(buf) {
  const r = await fetch(HF_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${HF_TOKEN}`,
      "Content-Type": "application/octet-stream",
    },
    body: buf,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`HF ${r.status} ${r.statusText} :: ${text.slice(0, 400)}`);
  return JSON.parse(text);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  try {
    if (!HF_TOKEN) {
      return res.status(500).json({ error: "missing_token", detail: "Set HF_TOKEN in .env.local and restart the server." });
    }

    const { imageBase64 } = req.body || {};
    if (!imageBase64) return res.status(400).json({ error: "missing_image" });

    // strip "data:*;base64," prefix if present
    const s = String(imageBase64);
    const comma = s.indexOf(",");
    const payload = comma >= 0 ? s.slice(comma + 1) : s;
    const buf = Buffer.from(payload, "base64");

    // optional quick status probe – helps catch 401/403 early
    const status = await fetch(HF_ENDPOINT, { headers: { Authorization: `Bearer ${HF_TOKEN}` } });
    if (status.status === 401 || status.status === 403) {
      const msg = await status.text();
      return res.status(401).json({ error: "unauthorized", detail: msg.slice(0, 400) });
    }

    let preds;
    try {
      preds = await callHF(buf);
    } catch (e1) {
      // retry once on 5xx (cold start/transient)
      if (/HF 5\d\d/.test(String(e1))) {
        try { preds = await callHF(buf); }
        catch (e2) { return res.status(502).json({ error: "hf_failed", detail: String(e2).slice(0, 400) }); }
      } else {
        return res.status(502).json({ error: "hf_failed", detail: String(e1).slice(0, 400) });
      }
    }

    const top = Array.isArray(preds) && preds.length ? preds[0] : { label: "unknown", score: 0.5 };
    const category = labelToCategory(top.label);
    return res.status(200).json({ category, score: top.score ?? 0.5 });
  } catch (e) {
    return res.status(500).json({ error: "classification_failed", detail: String(e).slice(0, 400) });
  }
}
