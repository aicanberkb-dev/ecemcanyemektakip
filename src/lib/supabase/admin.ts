import 'server-only'

import { createClient } from '@supabase/supabase-js'

/**
 * service_role anahtarıyla çalışan istemci — RLS'i tamamen atlar.
 * Sadece kullanıcı yönetimi (Admin API) için, çağıranın oturumu doğrulandıktan
 * sonra kullanılmalı.
 */
export function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}
