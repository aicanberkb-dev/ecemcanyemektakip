/**
 * Canlı veritabanı doğrulaması: şema, fonksiyonlar ve RLS kuralları
 * gerçek çağrılarla test edilir. Test verisi sonunda temizlenir.
 *
 *   npm run db:test
 */
import { randomUUID } from 'node:crypto'
import { config } from 'dotenv'
import { Client } from 'pg'

config({ path: '.env.local' })

const baglanti = process.env.SUPABASE_DB_URL
if (!baglanti) {
  console.error('SUPABASE_DB_URL tanımlı değil (.env.local).')
  process.exit(1)
}

const db = new Client({ connectionString: baglanti, ssl: { rejectUnauthorized: false } })

let gecti = 0
let kaldi = 0

function sonuc(ad: string, basarili: boolean, detay = '') {
  if (basarili) {
    gecti++
    console.log(`  ✓ ${ad}${detay ? ` — ${detay}` : ''}`)
  } else {
    kaldi++
    console.log(`  ✗ ${ad}${detay ? ` — ${detay}` : ''}`)
  }
}

/** Verilen SQL'in hata vermesini bekler; hata mesajını döner. */
async function hataBekle(sql: string, params: unknown[] = []): Promise<string | null> {
  try {
    await db.query(sql, params as never[])
    return null
  } catch (hata) {
    return (hata as Error).message
  }
}

/** Belirli bir kullanıcı kimliğiyle (RLS aktif) sorgu çalıştırır. */
async function kullaniciOlarak(userId: string, isler: () => Promise<void>) {
  await db.query('begin')
  await db.query(`set local role authenticated`)
  await db.query(`select set_config('request.jwt.claims', $1, true)`, [
    JSON.stringify({ sub: userId, role: 'authenticated' }),
  ])
  try {
    await isler()
  } finally {
    await db.query('rollback')
  }
}

async function main() {
  await db.connect()

  // ---- Test kullanıcıları (auth.users) -----------------------------------
  const kullaniciA = randomUUID()
  const kullaniciB = randomUUID()

  console.log('\nHazırlık: test kullanıcıları ve ayar')
  await db.query(
    `insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
       email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
     values
       ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'test-a@ornek.test', '', now(), now(), now(), '{}',
        '{"ad_soyad":"Test A","rol":"admin"}'),
       ($2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'test-b@ornek.test', '', now(), now(), now(), '{}',
        '{"ad_soyad":"Test B","rol":"personel"}')`,
    [kullaniciA, kullaniciB],
  )

  // Trigger profiles satırını açtı mı?
  const { rows: profil } = await db.query(
    'select rol, ad_soyad from public.profiles where id = $1',
    [kullaniciA],
  )
  sonuc(
    'yeni_kullanici trigger profiles satırı açıyor',
    profil[0]?.rol === 'admin' && profil[0]?.ad_soyad === 'Test A',
    profil[0] ? `rol=${profil[0].rol}, ad=${profil[0].ad_soyad}` : 'satır yok',
  )

  // Ayarları test için sabitle
  const { rows: eskiAyar } = await db.query('select * from public.app_settings limit 1')
  await db.query(
    `update public.app_settings
       set taban_gunluk_ucret = 100, ucretli_ogun_ucreti = 0, misafir_ogun_ucreti = 25`,
  )

  // ---- Öğrenciler ---------------------------------------------------------
  const gunlukcu = randomUUID()
  const aylikci = randomUUID()
  await db.query(
    `insert into public.students (id, ogrenci_no, ad_soyad, abone_tipi, iskonto_orani, iskonto_tutar, devir)
     values ($1, 'TEST-G1', 'Test Günlükçü', 'gunluk', 10, 5, 200),
            ($2, 'TEST-A1', 'Test Aylıkçı',  'aylik',  0,  0, 0)`,
    [gunlukcu, aylikci],
  )

  // ---- 1. Efektif günlük ücret -------------------------------------------
  console.log('\n1. Ücret hesabı')
  const { rows: ucret } = await db.query(
    'select public.ogrenci_gunluk_ucret($1) as ucret',
    [gunlukcu],
  )
  // 100 - 5 - (100 * 10/100) = 85
  sonuc(
    'efektif ücret = taban − iskonto_tutar − (taban × oran/100)',
    Number(ucret[0].ucret) === 85,
    `beklenen 85, gelen ${ucret[0].ucret}`,
  )

  const { rows: sifirAlti } = await db.query(
    'select public.efektif_gunluk_ucret(100, 90, 50) as ucret',
  )
  sonuc(
    'ücret hiçbir zaman eksiye düşmez',
    Number(sifirAlti[0].ucret) === 0,
    `gelen ${sifirAlti[0].ucret}`,
  )

  // ---- 2. yemek_kaydet ----------------------------------------------------
  console.log('\n2. yemek_kaydet')
  await kullaniciOlarak(kullaniciA, async () => {
    const { rows } = await db.query('select * from public.yemek_kaydet($1)', [gunlukcu])
    sonuc(
      'günlükçüden efektif ücret düşülüyor',
      Number(rows[0].tutar) === 85 && rows[0].tip === 'harcama',
      `tutar=${rows[0].tutar}`,
    )
    sonuc(
      'islemi_yapan_user_id çağıran kullanıcı',
      rows[0].islemi_yapan_user_id === kullaniciA,
    )

    const { rows: aylik } = await db.query('select * from public.yemek_kaydet($1)', [aylikci])
    sonuc(
      'aylıkçıya 0 ₺ devam kaydı düşüyor',
      Number(aylik[0].tutar) === 0 && aylik[0].ogun_abone_tipi === 'aylik',
      `tutar=${aylik[0].tutar}`,
    )

    const mesaj = await hataBekle('select public.yemek_kaydet($1)', [gunlukcu])
    sonuc(
      'aynı gün ikinci yemek kaydı HATA veriyor',
      mesaj !== null && mesaj.includes('zaten yemek kaydı var'),
      mesaj ?? 'hata gelmedi!',
    )

    // Bakiye: devir 200 + tahsilat 0 − harcama 85 = 115
    const { rows: bakiye } = await db.query(
      'select * from public.student_balances where student_id = $1',
      [gunlukcu],
    )
    sonuc(
      'student_balances: kalan = devir + alınan − harcanan',
      Number(bakiye[0].kalan) === 115,
      `beklenen 115, gelen ${bakiye[0].kalan}`,
    )
  })

  // Pasif öğrenci kontrolü
  await db.query('update public.students set aktif = false where id = $1', [gunlukcu])
  await kullaniciOlarak(kullaniciA, async () => {
    const mesaj = await hataBekle('select public.yemek_kaydet($1)', [gunlukcu])
    sonuc(
      'pasif öğrenciye yemek kaydı girilemiyor',
      mesaj !== null && mesaj.includes('pasif'),
      mesaj ?? 'hata gelmedi!',
    )
  })
  await db.query('update public.students set aktif = true where id = $1', [gunlukcu])

  // ---- 3. serbest_ogun_kaydet --------------------------------------------
  console.log('\n3. serbest_ogun_kaydet')
  await kullaniciOlarak(kullaniciA, async () => {
    const { rows: uc } = await db.query(`select * from public.serbest_ogun_kaydet('ucretli')`)
    sonuc(
      'ücretli öğün ücreti 0 ise taban ücret kullanılıyor',
      Number(uc[0].tutar) === 100,
      `tutar=${uc[0].tutar}`,
    )

    const { rows: mis } = await db.query(`select * from public.serbest_ogun_kaydet('misafir')`)
    sonuc('misafir öğün ayarlardaki ücreti alıyor', Number(mis[0].tutar) === 25, `tutar=${mis[0].tutar}`)
  })

  // ---- 4. RLS: islemi_yapan_user_id = auth.uid() --------------------------
  console.log('\n4. RLS — başkası adına işlem girme')
  await kullaniciOlarak(kullaniciB, async () => {
    const mesaj = await hataBekle(
      `insert into public.transactions (student_id, tarih, tip, tutar, islemi_yapan_user_id)
       values ($1, current_date, 'tahsilat', 500, $2)`,
      [gunlukcu, kullaniciA],
    )
    sonuc(
      'B kullanıcısı A adına işlem giremiyor',
      mesaj !== null && mesaj.includes('row-level security'),
      mesaj ?? 'RLS engellemedi!',
    )

    const kendi = await hataBekle(
      `insert into public.transactions (student_id, tarih, tip, tutar, islemi_yapan_user_id)
       values ($1, current_date, 'tahsilat', 500, $2)`,
      [gunlukcu, kullaniciB],
    )
    sonuc('B kullanıcısı kendi adına işlem girebiliyor', kendi === null, kendi ?? '')

    const serbestBaskasi = await hataBekle(
      `insert into public.serbest_ogunler (tarih, tip, tutar, islemi_yapan_user_id)
       values (current_date, 'ucretli', 100, $1)`,
      [kullaniciA],
    )
    sonuc(
      'serbest_ogunler için de aynı kural geçerli',
      serbestBaskasi !== null && serbestBaskasi.includes('row-level security'),
      serbestBaskasi ?? 'RLS engellemedi!',
    )
  })

  // ---- 5. RLS: audit_log yazılamaz ---------------------------------------
  console.log('\n5. RLS — audit_log korunması')
  await kullaniciOlarak(kullaniciA, async () => {
    const yazma = await hataBekle(
      `insert into public.audit_log (user_id, islem_tipi, tablo_adi)
       values ($1, 'SAHTE', 'students')`,
      [kullaniciA],
    )
    sonuc(
      'uygulama katmanı audit_log’a yazamıyor',
      yazma !== null,
      yazma ?? 'yazma engellenmedi!',
    )

    const silme = await hataBekle('delete from public.audit_log')
    sonuc('uygulama katmanı audit_log’dan silemiyor', silme !== null, silme ?? 'silme engellenmedi!')

    const okuma = await hataBekle('select count(*) from public.audit_log')
    sonuc('audit_log okunabiliyor', okuma === null, okuma ?? '')
  })

  // ---- 6. Audit trigger ---------------------------------------------------
  console.log('\n6. Audit trigger')
  await db.query('delete from public.audit_log where tablo_adi = $1', ['students'])
  await kullaniciOlarak(kullaniciA, async () => {
    await db.query('update public.students set ad_soyad = $1 where id = $2', [
      'Test Günlükçü (düzeltildi)',
      gunlukcu,
    ])
    const { rows } = await db.query(
      `select islem_tipi, eski_deger ->> 'ad_soyad' as eski, yeni_deger ->> 'ad_soyad' as yeni, user_id
       from public.audit_log where tablo_adi = 'students' and kayit_id = $1`,
      [gunlukcu],
    )
    sonuc(
      'UPDATE audit_log’a eski/yeni değerle yazılıyor',
      rows[0]?.islem_tipi === 'UPDATE' &&
        rows[0]?.eski === 'Test Günlükçü' &&
        rows[0]?.yeni === 'Test Günlükçü (düzeltildi)',
      rows[0] ? `${rows[0].eski} → ${rows[0].yeni}` : 'kayıt yok',
    )
    sonuc('audit kaydı doğru kullanıcıya bağlı', rows[0]?.user_id === kullaniciA)
  })

  // ---- 7. anon erişimi ----------------------------------------------------
  console.log('\n7. anon rolü')
  await db.query('begin')
  await db.query('set local role anon')
  const anonOkuma = await hataBekle('select count(*) from public.students')
  await db.query('rollback')
  sonuc(
    'giriş yapmamış (anon) kullanıcı öğrencileri göremiyor',
    anonOkuma !== null,
    anonOkuma ?? 'anon erişebildi!',
  )

  // ---- 8. Rapor fonksiyonları --------------------------------------------
  console.log('\n8. Rapor fonksiyonları')
  await kullaniciOlarak(kullaniciA, async () => {
    const { rows: gun } = await db.query('select * from public.gun_sonu(current_date)')
    sonuc(
      'gun_sonu kırılımlı sayım döndürüyor',
      gun.length === 1 && Number(gun[0].gunlukcu) >= 1 && Number(gun[0].aylikci) >= 1,
      `günlükçü=${gun[0].gunlukcu}, aylıkçı=${gun[0].aylikci}, ücretli=${gun[0].ucretli}, misafir=${gun[0].misafir}`,
    )

    const yil = new Date().getFullYear()
    await db.query(
      `insert into public.taksit_plani (yil, ad, vade_tarihi, tutar)
       values ($1, 'TEST-Taksit1', ($1 || '-01-15')::date, 10000),
              ($1, 'TEST-Taksit2', ($1 || '-12-31')::date, 20000)`,
      [yil],
    )
    await db.query(
      `insert into public.transactions (student_id, tarih, tip, tutar, islemi_yapan_user_id)
       values ($1, ($3 || '-02-01')::date, 'tahsilat', 5000, $2)`,
      [aylikci, kullaniciA, yil],
    )

    const { rows: taksit } = await db.query(
      `select * from public.taksit_durumu($1) where student_id = $2`,
      [yil, aylikci],
    )
    // Vadesi gelen 10.000, ödenen 5.000 → eksik 5.000, ödeme alınmalı
    sonuc(
      'taksit_durumu kümülatif eksiği doğru hesaplıyor',
      Number(taksit[0]?.eksik) === 5000 && taksit[0]?.odeme_alinmali === true,
      `vadesi gelen=${taksit[0]?.vadesi_gelen}, ödenen=${taksit[0]?.odenen}, eksik=${taksit[0]?.eksik}`,
    )

    const simdi = new Date()
    const { rows: devam } = await db.query(
      `select * from public.devam_cizelgesi($1, $2) where student_id = $3`,
      [simdi.getFullYear(), simdi.getMonth() + 1, gunlukcu],
    )
    sonuc(
      'devam_cizelgesi geldiği günleri döndürüyor',
      Array.isArray(devam[0]?.geldigi_gunler) && devam[0].geldigi_gunler.length === 1,
      `geldi=${devam[0]?.geldi_sayisi}, gelmedi=${devam[0]?.gelmedi_sayisi} (hafta içi bazlı)`,
    )

    const { rows: nakit } = await db.query(
      'select * from public.nakit_raporu(current_date, current_date)',
    )
    sonuc('nakit_raporu ücretli öğün + tahsilatı topluyor', nakit.length >= 1,
      nakit[0] ? `toplam=${nakit[0].toplam}` : 'satır yok')

    const { rows: rapor } = await db.query(
      `select * from public.gelen_giden_raporu(current_date - 30, current_date)
       where student_id = $1`,
      [gunlukcu],
    )
    sonuc(
      'gelen_giden_raporu öğrenci kırılımı veriyor',
      rapor.length === 1,
      rapor[0] ? `tahsilat=${rapor[0].donem_tahsilat}, harcama=${rapor[0].donem_harcama}` : '',
    )
  })

  // ---- Temizlik -----------------------------------------------------------
  console.log('\nTemizlik')
  await db.query('delete from public.taksit_plani where ad like $1', ['TEST-%'])
  await db.query('delete from public.serbest_ogunler where islemi_yapan_user_id = any($1)', [
    [kullaniciA, kullaniciB],
  ])
  await db.query('delete from public.students where id = any($1)', [[gunlukcu, aylikci]])
  await db.query('delete from public.audit_log where user_id = any($1)', [
    [kullaniciA, kullaniciB],
  ])
  await db.query('delete from auth.users where id = any($1)', [[kullaniciA, kullaniciB]])

  if (eskiAyar[0]) {
    await db.query(
      `update public.app_settings
         set taban_gunluk_ucret = $1, ucretli_ogun_ucreti = $2, misafir_ogun_ucreti = $3`,
      [
        eskiAyar[0].taban_gunluk_ucret,
        eskiAyar[0].ucretli_ogun_ucreti,
        eskiAyar[0].misafir_ogun_ucreti,
      ],
    )
  }
  await db.query('delete from public.audit_log where tablo_adi = $1', ['app_settings'])
  console.log('  Test verisi silindi, ayarlar geri yüklendi.')

  console.log(`\n${gecti} geçti, ${kaldi} kaldı.\n`)
  await db.end()
  process.exit(kaldi > 0 ? 1 : 0)
}

main().catch(async (hata) => {
  console.error('\nTest çalıştırılamadı:', hata)
  await db.end().catch(() => {})
  process.exit(1)
})
