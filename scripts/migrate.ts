/**
 * Migration çalıştırıcı: supabase/migrations altındaki .sql dosyalarını
 * sırayla canlı veritabanına uygular. Uygulananlar public.schema_migrations
 * tablosunda tutulur, ikinci çalıştırmada atlanır.
 *
 *   npm run db:migrate          -> bekleyenleri uygular
 *   npm run db:migrate -- --all -> hepsini yeniden uygular
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { config } from 'dotenv'
import { Client } from 'pg'

config({ path: '.env.local' })

const baglanti = process.env.SUPABASE_DB_URL
if (!baglanti) {
  console.error('SUPABASE_DB_URL tanımlı değil (.env.local).')
  process.exit(1)
}

const hepsi = process.argv.includes('--all')
const klasor = join(process.cwd(), 'supabase', 'migrations')

async function main() {
  const db = new Client({ connectionString: baglanti, ssl: { rejectUnauthorized: false } })
  await db.connect()

  await db.query(`
    create table if not exists public.schema_migrations (
      ad text primary key,
      uygulandi_at timestamptz not null default now()
    )
  `)

  const uygulanmis = hepsi
    ? new Set<string>()
    : new Set((await db.query<{ ad: string }>('select ad from public.schema_migrations')).rows.map((r) => r.ad))

  const dosyalar = readdirSync(klasor).filter((f) => f.endsWith('.sql')).sort()

  for (const dosya of dosyalar) {
    if (uygulanmis.has(dosya)) {
      console.log(`- atlandı  ${dosya}`)
      continue
    }
    const sql = readFileSync(join(klasor, dosya), 'utf8')
    try {
      await db.query('begin')
      await db.query(sql)
      await db.query(
        'insert into public.schema_migrations (ad) values ($1) on conflict (ad) do update set uygulandi_at = now()',
        [dosya],
      )
      await db.query('commit')
      console.log(`✓ uygulandı ${dosya}`)
    } catch (hata) {
      await db.query('rollback')
      console.error(`✗ HATA     ${dosya}`)
      console.error(hata)
      await db.end()
      process.exit(1)
    }
  }

  await db.end()
  console.log('Tamam.')
}

main()
