# Wellness Compass

Website interaktif yang membantu orang dewasa memahami kondisi lifestyle mereka dan
mendapatkan rekomendasi kebiasaan yang lebih baik. Pengembangan dari konsep PartyRock
"Wellness Compass" menjadi aplikasi web yang rapi, responsif, dan nyaman digunakan.

## Flow aplikasi

1. **Landing** — perkenalan singkat dan tombol mulai.
2. **Lifestyle Assessment** — form multi-step 5 langkah:
   - Tubuh: tinggi, berat, usia, jenis kelamin
   - Tidur & aktivitas: jam tidur, hari olahraga, screen time
   - Hidrasi & nutrisi: gelas air, porsi buah & sayur
   - Stres & keseimbangan: tingkat stres, tingkat energi
   - Tujuan & tantangan: wellness goal + challenge
3. **Wellness Snapshot (hasil)**:
   - Overall wellness score (gauge animasi 0–100) + tier
   - Snapshot metrik per dimensi (8 dimensi berbobot)
   - Kekuatan (strengths) & area prioritas
   - Personalized 7-day wellness plan
   - Suggested daily routine
   - Action "Mulai Hari Ini" (checklist interaktif)

## Cara menjalankan

Tidak perlu build atau dependency. Buka langsung `index.html` di browser,
atau jalankan server statis sederhana:

```bash
python -m http.server 8123
# lalu buka http://localhost:8123
```

## Struktur

```
index.html   # markup & 3 view (landing / form / results)
styles.css   # desain, layout responsif, animasi, print styles
app.js       # navigasi step, scoring engine, generator rekomendasi
```

## Catatan

- Data assessment tersimpan hanya di perangkat pengguna (localStorage), tidak dikirim ke mana pun.
- Aplikasi memberikan edukasi gaya hidup umum, bukan nasihat medis.
```
