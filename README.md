# Breaker Bone Montus

Aplikasi web pribadi untuk menyimpan link lowongan kerja, mengambil nama perusahaan/posisi lewat Vercel Serverless Function, dan melacak status sudah melamar.

Frontend dan endpoint scraping di-deploy ke Vercel. Firebase tetap dipakai untuk Firestore.

## Setup Lokal

1. Install dependency:
   ```bash
   npm install
   ```

2. Salin `.env.example` menjadi `.env`, lalu isi konfigurasi Firebase web app:
   ```bash
   cp .env.example .env
   ```

3. Deploy Firestore rules:
   ```bash
   npm run deploy:firebase
   ```

4. Jalankan app:
   ```bash
   npm run dev
   ```

## Struktur Utama

- `src/App.vue`: UI input link, dashboard, daftar lowongan, toggle status.
- `src/services/firebase.js`: inisialisasi Firebase client.
- `src/services/jobListings.js`: operasi Firestore real-time.
- `api/scrape-job.js`: endpoint scraping Vercel.
- `firestore.rules`: akses Firestore dibuka untuk mode pribadi tanpa login.

## Deploy ke Vercel

1. Push project ke GitHub.
2. Import repository di Vercel.
3. Tambahkan Environment Variables dari `.env.example` ke Vercel:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
4. Pastikan setting Vercel:
   - Framework Preset: `Vite`
   - Build Command: `npm run build`
   - Output Directory: `dist`

Firestore rules tetap perlu di-deploy terpisah:

```bash
npm run deploy:firebase
```
