# Breaker Bone Montus

Aplikasi web pribadi untuk menyimpan link lowongan kerja, mengambil nama perusahaan/posisi lewat Vercel Serverless Function, dan melacak status sudah melamar.

Frontend dan endpoint scraping di-deploy ke Vercel. Firebase tetap dipakai untuk Firestore.

## Setup Lokal

1. Install dependency:
   ```bash
   npm install
   ```

2. Salin `firebaseconfig.example.json` menjadi `firebaseconfig.json`, lalu isi konfigurasi Firebase web app:
   ```bash
   cp firebaseconfig.example.json firebaseconfig.json
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
3. Pastikan `firebaseconfig.json` sudah ikut repository atau tersedia di project sebelum deploy.
4. Pastikan setting Vercel:
   - Framework Preset: `Vite`
   - Build Command: `npm run build`
   - Output Directory: `dist`

Firestore rules tetap perlu di-deploy terpisah:

```bash
npm run deploy:firebase
```
