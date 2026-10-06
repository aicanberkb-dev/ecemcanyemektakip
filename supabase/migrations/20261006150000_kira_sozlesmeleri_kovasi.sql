-- 20261006150000_kira_sozlesmeleri_kovasi.sql
--
-- Kira sozlesmelerinin saklandigi dosya kovasi.
--
-- Sozlesmeler okul klasorlerinde duruyor (goksu / akbaba / ahmet-mithat).
-- Kova herkese acik degil: dosyalar imzali baglantiyla aciliyor, boylece
-- baglantiyi bilen herkes degil yalnizca giris yapmis kullanici gorebiliyor.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'kira-sozlesmeleri', 'kira-sozlesmeleri', false, 62914560,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg', 'image/png', 'image/heic'
  ]
)
on conflict (id) do update
set file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types,
    public = excluded.public;

drop policy if exists kira_sozlesme_okuma on storage.objects;
create policy kira_sozlesme_okuma on storage.objects
  for select using (bucket_id = 'kira-sozlesmeleri' and genel_erisim());

drop policy if exists kira_sozlesme_yukleme on storage.objects;
create policy kira_sozlesme_yukleme on storage.objects
  for insert with check (bucket_id = 'kira-sozlesmeleri' and genel_erisim());

drop policy if exists kira_sozlesme_guncelleme on storage.objects;
create policy kira_sozlesme_guncelleme on storage.objects
  for update using (bucket_id = 'kira-sozlesmeleri' and genel_erisim())
  with check (bucket_id = 'kira-sozlesmeleri' and genel_erisim());

drop policy if exists kira_sozlesme_silme on storage.objects;
create policy kira_sozlesme_silme on storage.objects
  for delete using (bucket_id = 'kira-sozlesmeleri' and genel_erisim());
