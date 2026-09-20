-- 20260920100000_okul_bazli_yetki.sql
--
-- Okula bağlı kullanıcı: profiles.okul_id doluysa kullanıcı yalnız o okulun
-- verisini görür ve yazar.
--
-- Mekanizma (yetkili_okul / okul_erisimi) çok okul geçişinde hazırlanmıştı
-- ama politikalar "true" bırakılmıştı: giriş yapan herkes her okulu görüyordu.
-- AHMET MİTHAT'a yalnız kendi okuluna girebilen bir kullanıcı tanımlanacağı
-- için kurallar burada gerçekten uygulanıyor.
--
-- Ekranı gizlemek yetmez: Yemekhane ekranı tarayıcıdan doğrudan sorgu atıyor,
-- yani kısıt veritabanında durmak zorunda.
--
-- okul_id'si boş olan kullanıcı (bugün yalnız yönetici hesabı) eskisi gibi
-- her şeyi görür; kimsenin mevcut erişimi daralmaz.

-- ---------------------------------------------------------------------------
-- Yardımcı fonksiyonlar
-- ---------------------------------------------------------------------------

/** Okul kısıtı olmayan kullanıcı: yönetici ya da okula bağlanmamış hesap. */
create or replace function public.genel_erisim()
returns boolean language sql stable set search_path to 'public' as $$
  select public.admin_mi() or public.yetkili_okul() is null;
$$;

create or replace function public.okul_erisimi(p_okul_id uuid)
returns boolean language sql stable set search_path to 'public' as $$
  select public.genel_erisim() or p_okul_id = public.yetkili_okul();
$$;

/**
 * Öğrencinin okuluna erişim var mı?
 *
 * security definer: işlem satırlarının politikası bunu çağırırken students
 * tablosunun kendi politikası tekrar değerlendirilmesin.
 */
create or replace function public.ogrenci_erisimi(p_student_id uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from public.students s
    where s.id = p_student_id and public.okul_erisimi(s.okul_id)
  );
$$;

-- ---------------------------------------------------------------------------
-- Öğrenci ve para verisi — okul bazlı
-- ---------------------------------------------------------------------------

drop policy if exists students_select on public.students;
create policy students_select on public.students for select to authenticated
  using (public.okul_erisimi(okul_id));
drop policy if exists students_insert on public.students;
create policy students_insert on public.students for insert to authenticated
  with check (public.okul_erisimi(okul_id));
drop policy if exists students_update on public.students;
create policy students_update on public.students for update to authenticated
  using (public.okul_erisimi(okul_id)) with check (public.okul_erisimi(okul_id));
drop policy if exists students_delete on public.students;
create policy students_delete on public.students for delete to authenticated
  using (public.okul_erisimi(okul_id));

drop policy if exists transactions_select on public.transactions;
create policy transactions_select on public.transactions for select to authenticated
  using (public.ogrenci_erisimi(student_id));
drop policy if exists transactions_insert on public.transactions;
create policy transactions_insert on public.transactions for insert to authenticated
  with check (islemi_yapan_user_id = auth.uid() and public.ogrenci_erisimi(student_id));
drop policy if exists transactions_update on public.transactions;
create policy transactions_update on public.transactions for update to authenticated
  using (public.ogrenci_erisimi(student_id))
  with check (islemi_yapan_user_id = auth.uid() and public.ogrenci_erisimi(student_id));
drop policy if exists transactions_delete on public.transactions;
create policy transactions_delete on public.transactions for delete to authenticated
  using (public.ogrenci_erisimi(student_id));

drop policy if exists serbest_ogunler_select on public.serbest_ogunler;
create policy serbest_ogunler_select on public.serbest_ogunler for select to authenticated
  using (public.okul_erisimi(okul_id));
drop policy if exists serbest_ogunler_insert on public.serbest_ogunler;
create policy serbest_ogunler_insert on public.serbest_ogunler for insert to authenticated
  with check (islemi_yapan_user_id = auth.uid() and public.okul_erisimi(okul_id));
drop policy if exists serbest_ogunler_update on public.serbest_ogunler;
create policy serbest_ogunler_update on public.serbest_ogunler for update to authenticated
  using (public.okul_erisimi(okul_id))
  with check (islemi_yapan_user_id = auth.uid() and public.okul_erisimi(okul_id));
drop policy if exists serbest_ogunler_delete on public.serbest_ogunler;
create policy serbest_ogunler_delete on public.serbest_ogunler for delete to authenticated
  using (public.okul_erisimi(okul_id));

drop policy if exists abonelik_donemleri_hepsi on public.abonelik_donemleri;
create policy abonelik_donemleri_hepsi on public.abonelik_donemleri for all to authenticated
  using (public.ogrenci_erisimi(student_id)) with check (public.ogrenci_erisimi(student_id));

drop policy if exists ogrenci_taksit_select on public.ogrenci_taksit;
create policy ogrenci_taksit_select on public.ogrenci_taksit for select to authenticated
  using (public.ogrenci_erisimi(student_id));
drop policy if exists ogrenci_taksit_insert on public.ogrenci_taksit;
create policy ogrenci_taksit_insert on public.ogrenci_taksit for insert to authenticated
  with check (public.ogrenci_erisimi(student_id));
drop policy if exists ogrenci_taksit_update on public.ogrenci_taksit;
create policy ogrenci_taksit_update on public.ogrenci_taksit for update to authenticated
  using (public.ogrenci_erisimi(student_id)) with check (public.ogrenci_erisimi(student_id));
drop policy if exists ogrenci_taksit_delete on public.ogrenci_taksit;
create policy ogrenci_taksit_delete on public.ogrenci_taksit for delete to authenticated
  using (public.ogrenci_erisimi(student_id));

drop policy if exists ekstre_aktarimlari_select on public.ekstre_aktarimlari;
create policy ekstre_aktarimlari_select on public.ekstre_aktarimlari for select to authenticated
  using (public.okul_erisimi(okul_id));
drop policy if exists ekstre_aktarimlari_insert on public.ekstre_aktarimlari;
create policy ekstre_aktarimlari_insert on public.ekstre_aktarimlari for insert to authenticated
  with check (aktaran_user_id = auth.uid() and public.okul_erisimi(okul_id));
drop policy if exists ekstre_aktarimlari_update on public.ekstre_aktarimlari;
create policy ekstre_aktarimlari_update on public.ekstre_aktarimlari for update to authenticated
  using (public.okul_erisimi(okul_id))
  with check (aktaran_user_id = auth.uid() and public.okul_erisimi(okul_id));
drop policy if exists ekstre_aktarimlari_delete on public.ekstre_aktarimlari;
create policy ekstre_aktarimlari_delete on public.ekstre_aktarimlari for delete to authenticated
  using (public.okul_erisimi(okul_id));

drop policy if exists rehber_kayitlari_select on public.rehber_kayitlari;
create policy rehber_kayitlari_select on public.rehber_kayitlari for select to authenticated
  using (public.okul_erisimi(okul_id));
drop policy if exists rehber_kayitlari_yaz on public.rehber_kayitlari;
create policy rehber_kayitlari_yaz on public.rehber_kayitlari for insert to authenticated
  with check (public.okul_erisimi(okul_id));
drop policy if exists rehber_kayitlari_guncelle on public.rehber_kayitlari;
create policy rehber_kayitlari_guncelle on public.rehber_kayitlari for update to authenticated
  using (public.okul_erisimi(okul_id)) with check (public.okul_erisimi(okul_id));
drop policy if exists rehber_kayitlari_sil on public.rehber_kayitlari;
create policy rehber_kayitlari_sil on public.rehber_kayitlari for delete to authenticated
  using (public.okul_erisimi(okul_id));

-- ---------------------------------------------------------------------------
-- Okul ayarları: okul bazlı okunur, yalnız kısıtsız kullanıcı yazar
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['sezonlar', 'taksit_plani', 'ucret_gecmisi', 'app_settings']
  loop
    execute format('drop policy if exists %I_secme on public.%I', t, t);
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format('drop policy if exists %I_yazma on public.%I', t, t);
    execute format('drop policy if exists %I_insert on public.%I', t, t);
    execute format('drop policy if exists %I_update on public.%I', t, t);
    execute format('drop policy if exists %I_delete on public.%I', t, t);
    execute format(
      'create policy %I_select on public.%I for select to authenticated
         using (public.okul_erisimi(okul_id))', t, t);
    execute format(
      'create policy %I_yazma on public.%I for all to authenticated
         using (public.genel_erisim()) with check (public.genel_erisim())', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Finans, maliyet ve yönetim tabloları: okula bağlı kullanıcıya kapalı
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'senetler', 'cariler', 'faturalar', 'fatura_tahsilatlari', 'fatura_gizli',
    'personeller', 'personel_ucretleri', 'personel_gizli', 'sgk_gizli',
    'maas_odemeleri', 'donemsel_giderler', 'arti_eksi', 'gunluk_defter',
    'malzemeler', 'yemek_receteleri', 'hizmet_fiyatlari', 'gunluk_hizmet',
    'gunluk_cikan']
  loop
    execute format('drop policy if exists %I_secme on public.%I', t, t);
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format('drop policy if exists %I_yazma on public.%I', t, t);
    execute format('drop policy if exists %I_hepsi on public.%I', t, t);
    execute format('drop policy if exists %I_insert on public.%I', t, t);
    execute format('drop policy if exists %I_update on public.%I', t, t);
    execute format('drop policy if exists %I_delete on public.%I', t, t);
    execute format(
      'create policy %I_secme on public.%I for select to authenticated
         using (public.genel_erisim())', t, t);
    execute format(
      'create policy %I_yazma on public.%I for all to authenticated
         using (public.genel_erisim()) with check (public.genel_erisim())', t, t);
  end loop;
end $$;

-- İşlem geçmişi Ayarlar altında; okula bağlı kullanıcı görmez
drop policy if exists audit_log_select on public.audit_log;
create policy audit_log_select on public.audit_log for select to authenticated
  using (public.genel_erisim());

-- Profil satırları herkese okunur (ekranlarda ad gösteriliyor) ama yalnız
-- yönetici değiştirebilir: personel kendini admin yapamasın.
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated
  with check (public.admin_mi());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (public.admin_mi()) with check (public.admin_mi());
drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles for delete to authenticated
  using (public.admin_mi());

-- Okul tanımlarını yalnız yönetici değiştirir
drop policy if exists okullar_insert on public.okullar;
create policy okullar_insert on public.okullar for insert to authenticated
  with check (public.genel_erisim());
drop policy if exists okullar_update on public.okullar;
create policy okullar_update on public.okullar for update to authenticated
  using (public.genel_erisim()) with check (public.genel_erisim());
