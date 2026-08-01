# Yemek Takip

Okul/yemekhane öğrenci ve ödeme takip sistemi. Next.js 16 (App Router, TypeScript,
Tailwind 4) + Supabase (Auth, Postgres, RLS).

## Kurulum

```bash
npm install
cp .env.local.example .env.local   # değerleri Supabase panelinden doldurun
npm run db:migrate                 # şema + RLS + fonksiyonları uygular
npm run db:test                    # canlıda doğrular, test verisini siler
npm run dev
```

İlk kullanıcıyı Supabase panelinden (Authentication → Users) oluşturun; sonrasında
`/admin/users` üzerinden kullanıcı eklenebilir.

## Ortam değişkenleri

| Değişken | Ne işe yarar |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Proje adresi |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Tarayıcı ve sunucu istemcisi (RLS geçerli) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yalnızca kullanıcı yönetimi; RLS'i atlar, gizli tutun |
| `SUPABASE_DB_URL` | Migration ve test scriptleri için doğrudan Postgres bağlantısı |

## Mimari kararlar

**Bakiye hesaplanır, saklanmaz.** `student_balances` view'i devir + Σtahsilat −
Σharcama olarak hesaplar. View `security_invoker = true` ile tanımlı, böylece
sorgulanırken de çağıranın RLS kuralları geçerli olur.

**Fiyat istemciden gelmez.** Yemek ve öğün kayıtları `yemek_kaydet` /
`serbest_ogun_kaydet` Postgres fonksiyonlarıyla atılır; tutar öğrencinin
iskontosundan ve `app_settings`'ten hesaplanır. Aynı gün ikinci yemek kaydı
fonksiyonun içinde hata döndürür (ayrıca kısmi unique index ile de korunur).

**Yetkilendirme RLS'te.** Uygulama katmanı yalnızca daha iyi hata mesajı için
kontrol yapar. Rol ayrımı şu an kapalı (`ROL_AYRIMI_AKTIF = false` —
`src/lib/yetki.ts`); giriş yapan herkes her şeyi yapabilir. Rol ayrımından
bağımsız iki kural her zaman geçerli:

- `transactions` ve `serbest_ogunler` kayıtlarında `islemi_yapan_user_id = auth.uid()`
- `audit_log`'a uygulama katmanından yazılamaz/silinemez; yalnızca SECURITY
  DEFINER trigger yazar

## Dizin yapısı

```
supabase/migrations/     sıralı SQL migration'ları
scripts/migrate.ts       migration çalıştırıcı
scripts/db-test.ts       canlı veritabanı doğrulaması
src/proxy.ts             oturum yenileme (Next 16'da middleware yerine)
src/lib/types.ts         şemanın TypeScript karşılığı
src/app/(uygulama)/      giriş gerektiren sayfalar
```

## Sayfalar

| Yol | Ne yapar |
|---|---|
| `/pos` | Yemekhane girişi — canlı arama, kredi gösterimi, öğün butonları |
| `/dashboard` | Tarih aralıklı özet ve son işlemler |
| `/students` | Öğrenci listesi, arama ve filtreler |
| `/students/[id]` | Cari özet, iskonto/devir düzenleme, işlem geçmişi |
| `/payments/new` | Elle tahsilat / yemek kaydı |
| `/reports` | Gelen–Giden–Tahsil Edilen (+ CSV) |
| `/reports/gun-sonu` | Günlük kırılımlı sayım |
| `/reports/nakit` | Gün gün kasaya giren nakit |
| `/reports/devam` | Aylık devam ızgarası (hafta içi bazlı) |
| `/reports/taksit` | Aylıkçı taksit takibi (kümülatif) |
| `/reports/tahsilat` | Öğrenci bazlı para girişi geçmişi |
| `/admin/settings` | Ücretler ve taksit planı |
| `/admin/users` | Kullanıcı yönetimi |
| `/admin/audit-log` | Düzeltme/silme geçmişi, alan bazlı fark |

## Kapsam dışı (bu faz)

SMS/bildirim gönderimi, mobil uygulama, resmî tatil takvimi, `/reports` dışındaki
raporlar için CSV export.
