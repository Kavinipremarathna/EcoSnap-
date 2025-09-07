<<<<<<< HEAD
# EcoSnap-
=======
# EcoSnap – Next.js + Firebase + Hugging Face

End-to-end starter with points (Firestore) and real image classification via Hugging Face Inference API.

## 1) Install & Run
```bash
npm install
npm run dev
```
Open http://localhost:3000

## 2) Create .env.local
Create a `.env.local` in project root:
```
# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=YOUR_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=YOUR_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID=YOUR_PROJECT
NEXT_PUBLIC_FIREBASE_APP_ID=YOUR_APP_ID

# Hugging Face
HF_TOKEN=hf_xxx_your_token
HF_MODEL=google/vit-base-patch16-224
```

## 3) Firebase Setup
- Go to Firebase Console → Add project
- Enable **Anonymous Authentication**
- Enable **Firestore** (in test mode)
- Copy the config (API key, authDomain, projectId, appId) into `.env.local`

## 4) How It Works
- **/pages/api/classify.js** accepts a base64 image and calls HF model.
- Label → Category mapping reduces generic labels → {Recycle, Compost, E-waste, General}
- On success, user gets **+10 points** and **+0.02 kg CO₂** (demo values) in Firestore.
- Leaderboard queries top 10 users by points.

## 5) Swap Models / Improve Accuracy
- Change `HF_MODEL` to a waste-specific model if available.
- Tune `labelToCategory()` mapping as needed.

## 6) Notes
- Overpass API is rate-limited; switch mirrors or cache if needed.
- For production, secure rules in Firestore and validate inputs server-side.
>>>>>>> f430a23 (added project)
