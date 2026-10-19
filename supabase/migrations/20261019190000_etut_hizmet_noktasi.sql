-- Etut yemegi icin hizmet noktasi.
--
-- Kapali gun kayitlari hizmet noktasina baglaniyor; listenin noktasi
-- olmadigi icin "okul yok" isaretlemesi reddediliyordu.
--
-- okul_id bilerek bos: GOKSU'ya baglanirsa okulun kapali gun hesabi
-- degisir (okul ancak butun yerleri kapaliysa kapali sayiliyor) ve
-- devam/yoklama raporlari etkilenirdi. Nokta listeye liste_id ile bagli,
-- menu ekranindaki kapat/ac bu bagi kullaniyor.

insert into public.hizmet_noktalari
  (ad, liste_id, okul_id, aktif, sira, varsayilan_kisi_sayisi, varsayilan_cikan_porsiyon)
select
  'GÖKSU ANASINIFI ETÜT',
  (select id from public.menu_listeleri where ad = 'GÖKSU ANASINIFI ETÜT YEMEĞİ'),
  null,
  true,
  9,
  0,
  0
where not exists (
  select 1 from public.hizmet_noktalari where ad = 'GÖKSU ANASINIFI ETÜT'
);
