/* =========================================================
   Goodsoria — TEK KAYNAK ürün kataloğu
   Tüm sayfalar (mağaza, ana sayfa, bulucu) buradan okur.
   Veri: herbalexpress.com.tr/tum-urunler referans alınarak
   gerçek Herbalife ürün adları + fiyatları. Fiyatlar herkese açık.
   Görseller: assets/products/<slug>.webp (yoksa otomatik yer tutucu).
   ========================================================= */
(function () {
  const CATEGORIES = [
    { key: 'temel',     name: 'Temel Beslenme' },
    { key: 'icecek',    name: 'İçecekler' },
    { key: 'atistirma', name: 'Atıştırmalıklar' },
    { key: 'takviye',   name: 'Besin Takviyeleri' },
    { key: 'aktif',     name: 'Aktif Yaşam' },
    { key: 'skin',      name: 'HL/SKIN Serisi' },
    { key: 'aloe',      name: 'Aloe Bakım' },
    { key: 'paket',     name: 'Paketler & Programlar' }
  ];

  /* fiyat: güncel TRY · old: üstü çizili (yoksa null) · goals: hedef etiketleri
     stock:false → "stokta yok" · pop: popülerlik (sıralama için kaba) */
  const P = [
    { slug:'herbal-aloe-mango', name:'Herbal Aloe Konsantre İçecek Mango 473 ml', cat:'icecek', price:1050, old:1250, goals:['sindirim'], pop:80, desc:'Su tüketimini keyifli hale getiren, mango aromalı aloe veralı konsantre.' },
    { slug:'formul-1-ahududu', name:'Formül 1 Ahududu-Beyaz Çikolata Shake', cat:'temel', price:1150, old:1520, goals:['kilo','enerji'], pop:95, desc:'Öğün yerine geçen, protein ve bitki besinli besleyici shake.' },
    { slug:'formul-1-corba', name:'Formül 1 Mantar Aromalı Çorba', cat:'temel', price:0, old:null, stock:false, goals:['kilo'], pop:60, desc:'Öğün yerine geçen, tuzlu sevenler için mantar aromalı çorba.' },
    { slug:'pro-drink-vanilya', name:'Pro-Drink Vanilya Aromalı', cat:'temel', price:1200, old:1500, goals:['kas'], pop:78, desc:'Yüksek proteinli, pratik vanilya aromalı protein içeceği.' },
    { slug:'multi-fiber', name:'Multi-fiber', cat:'takviye', price:950, old:null, goals:['sindirim'], pop:70, desc:'Günlük lif alımını destekleyen, suya karışan içecek tozu.' },
    { slug:'soguk-kahve-latte', name:'Yüksek Proteinli Soğuk Kahve Latte Macchiato 308g', cat:'icecek', price:0, old:null, stock:false, goals:['kas','enerji'], pop:72, desc:'Yüksek proteinli, ferahlatıcı soğuk kahve karışımı.' },
    { slug:'heartwell', name:'Heartwell 229g', cat:'takviye', price:1220, old:2800, goals:['enerji'], pop:66, desc:'Kalp-damar sağlığına destek olan beslenme karışımı.' },
    { slug:'tri-blend-select', name:'Tri Blend Select 600g', cat:'temel', price:1500, old:1991, goals:['kas','kilo'], pop:82, desc:'3 bitkisel kaynaklı protein karışımı; öğün desteği.' },
    { slug:'formul-3-pro-boost', name:'Formül 3 Pro-Boost 268g', cat:'takviye', price:840, old:null, goals:['kas'], pop:64, desc:'Shake’ine ekleyebileceğin saf protein güçlendirici.' },
    { slug:'protein-bar-vanilya-badem', name:'Protein Bar Vanilya-Badem', cat:'atistirma', price:950, old:980, goals:['kas','kilo'], pop:74, desc:'Yanında taşı, tok kal: vanilya-badem aromalı protein bar.' },
    { slug:'protein-cips-barbeku', name:'Protein Cips Barbekü Aromalı', cat:'atistirma', price:850, old:1052, goals:['kas'], pop:68, desc:'Barbekü aromalı, protein dengeli atıştırmalık cips.' },
    { slug:'skin-collagen-drink', name:'Herbalife SKIN Collagen Drink Çilek-Limon 171g', cat:'takviye', price:1535, old:1990, goals:[], pop:71, desc:'Çilek-limon aromalı, içilebilir kolajen takviyesi.' },
    { slug:'vitamin-mineral-erkek', name:'Vitamin Mineral Erkekler 60 tablet', cat:'takviye', price:820, old:null, goals:['enerji','bagisiklik'], pop:69, desc:'Erkeklere özel temel vitamin ve mineral desteği.' },
    { slug:'formul-2-vitamin-mineral-kadin', name:'Formül 2 Vitamin Mineral Kadınlar 60 tablet', cat:'takviye', price:820, old:null, goals:['enerji','bagisiklik'], pop:69, desc:'Kadınlara özel temel vitamin ve mineral desteği.' },
    { slug:'liftoff-limon', name:'Liftoff Limon', cat:'takviye', price:686, old:null, goals:['enerji','bagisiklik'], pop:73, desc:'Suya atılan, ferahlatıcı limonlu enerji içeceği tableti.' },
    { slug:'thermo-complete', name:'Thermo Complete', cat:'takviye', price:1195, old:1970, goals:['kilo','enerji'], pop:77, desc:'Metabolizmaya destek olan bitki ve kafein içeren takviye.' },
    { slug:'herbalifeline-max', name:'Herbalifeline Max', cat:'takviye', price:830, old:898, goals:['bagisiklik'], pop:62, desc:'Omega-3 (balık yağı) ve bitki özlü destek kapsülleri.' },
    { slug:'niteworks', name:'Niteworks', cat:'takviye', price:1970, old:2924, goals:[], pop:65, desc:'Damar sağlığı için gece kullanımına uygun L-arginin karışımı.' },
    { slug:'xtra-cal', name:'Xtra-Cal', cat:'takviye', price:530, old:null, goals:[], pop:58, desc:'Kemik sağlığına destek kalsiyum ve mineral takviyesi.' },
    { slug:'pro-core', name:'Pro-core', cat:'takviye', price:1000, old:null, goals:[], pop:60, desc:'Günlük temel beslenmeyi tamamlayan çekirdek destek.' },
    { slug:'night-mode', name:'Night Mode', cat:'takviye', price:1550, old:2028, goals:[], pop:67, desc:'Uyku kalitesine destek olan gece formülü.' },
    { slug:'niacinamide-serum', name:'Niacinamide Serum', cat:'skin', price:1245, old:1540, goals:[], pop:70, desc:'Cilt tonunu eşitlemeye yardımcı niacinamide içeren yüz serumu.' },
    { slug:'yenileyici-jel-temizleyici', name:'Yenileyici Jel Temizleyici', cat:'skin', price:920, old:1036, goals:[], pop:64, desc:'Cildi yenileyen, nazik jel yüz temizleyici.' },
    { slug:'yogun-sikilastirici-krem', name:'Yoğun Sıkılaştırıcı Krem', cat:'skin', price:1711, old:null, goals:[], pop:63, desc:'Cildi nemlendiren ve sıkılaştırmaya yardımcı yoğun krem.' },
    { slug:'besleyici-el-vucut-kremi', name:'Besleyici El-Vücut Kremi', cat:'skin', price:787, old:null, goals:[], pop:61, desc:'El ve vücut için besleyici, yoğun nemlendirici krem.' },
    { slug:'besleyici-goz-kremi', name:'Besleyici Göz Kremi', cat:'skin', price:1090, old:1300, goals:[], pop:62, desc:'Göz çevresine özel besleyici bakım kremi.' },
    { slug:'narenciye-yuz-temizleme', name:'Narenciye Özlü Parlatıcı Yüz Temizleme', cat:'skin', price:980, old:1020, goals:[], pop:60, desc:'Narenciye özlü, cilde canlılık veren yüz temizleme jeli.' },
    { slug:'skin-sikilastirici-goz-jeli', name:'Herbalife SKIN Sıkılaştırıcı Göz Jeli 15ml', cat:'skin', price:1130, old:1364, goals:[], pop:61, desc:'Göz çevresini sıkılaştırmaya yardımcı hafif jel.' },
    { slug:'skin-kirmizi-meyve-peeling', name:'Herbalife SKIN Kırmızı Meyve Peeling 120ml', cat:'skin', price:890, old:null, goals:[], pop:60, desc:'Kırmızı meyve özlü, cildi arındıran peeling.' },
    { slug:'skin-nane-kil-maskesi', name:'Herbalife SKIN Nane Özlü Kil Maskesi 120ml', cat:'skin', price:920, old:null, goals:[], pop:60, desc:'Nane özlü, gözenekleri arındıran kil maskesi.' },
    { slug:'skin-besleyici-gece-kremi', name:'Herbalife SKIN Besleyici Gece Kremi 50ml', cat:'skin', price:1350, old:1691, goals:[], pop:62, desc:'Gece boyu cildi besleyen onarıcı krem.' },
    { slug:'aloe-el-vucut-sampuani', name:'Herbal Aloe El-Vücut Şampuanı 250ml', cat:'aloe', price:535, old:null, goals:[], pop:59, desc:'Aloe veralı, el ve vücut için nazik temizleyici.' },
    { slug:'aloe-rahatlatici-jel', name:'Herbal Aloe Rahatlatıcı Jel 200ml', cat:'aloe', price:530, old:null, goals:[], pop:59, desc:'Cildi rahatlatan, çok amaçlı aloe vera jeli.' },
    { slug:'aloe-el-vucut-losyonu', name:'Herbal Aloe El-Vücut Losyonu 200ml', cat:'aloe', price:530, old:null, goals:[], pop:58, desc:'Aloe veralı, nemlendirici el ve vücut losyonu.' },
    { slug:'aloe-guclendirici-sampuan', name:'Herbal Aloe Güçlendirici Şampuan 250ml', cat:'aloe', price:535, old:null, goals:[], pop:58, desc:'Saçı güçlendiren aloe veralı şampuan.' },
    { slug:'aloe-guclendirici-sac-kremi', name:'Herbal Aloe Güçlendirici Saç Kremi 250ml', cat:'aloe', price:535, old:null, goals:[], pop:58, desc:'Saça bakım yapan aloe veralı saç kremi.' },
    { slug:'h24-rb-promax', name:'H24 RB Promax', cat:'aktif', price:2295, old:2380, goals:['kas'], pop:75, desc:'Antrenman sonrası toparlanma için yüksek proteinli formül.' },
    { slug:'cr7-drive', name:'CR7 Drive Spor İçeceği Tozu', cat:'aktif', price:636, old:null, goals:['enerji','kas'], pop:76, desc:'Antrenman sırasında hidrasyon ve enerji desteği.' },
    { slug:'paket-dengeli-yasam', name:'Herbalife Dengeli Yaşam Paketi', cat:'paket', price:3180, old:3800, goals:['kilo'], pop:96, desc:'Yeni başlayanlar için en çok tercih edilen başlangıç paketi.' },
    { slug:'paket-cilt-kolajen', name:'Cilt Bakımı & Kolajen Paketi', cat:'paket', price:6273, old:null, goals:[], pop:70, desc:'Cilt bakımı ve içilebilir kolajeni bir arada sunan set.' },
    { slug:'paket-promax-prodrink-proboost', name:'Pro Max-ProDrink-ProBoost Paketi', cat:'paket', price:3330, old:null, goals:['kas'], pop:84, desc:'Sporcular için protein odaklı komple paket.' },
    { slug:'paket-night-mode-niteworks', name:'Night Mode-Niteworks Paketi', cat:'paket', price:3280, old:4300, goals:[], pop:72, desc:'Uyku kalitesi ve damar sağlığı için ikili set.' },
    { slug:'paket-thermo-cay-kahve', name:'Thermo-Çay-Kahve Paketi', cat:'paket', price:0, old:null, stock:false, goals:['kilo'], pop:68, desc:'Metabolizma desteği için thermo, çay ve kahve seti.' },
    { slug:'paket-liftoff-procore-heartwell', name:'Lift Off-ProCore-Hartwell Paketi', cat:'paket', price:2395, old:null, goals:['enerji','bagisiklik'], pop:71, desc:'Enerji ve günlük destek için üçlü set.' },
    { slug:'formul-1-vanilya', name:'Formül 1 Vanilya Shake', cat:'temel', price:1150, old:1620, goals:['kilo','enerji'], pop:99, desc:'En klasik öğün yerine geçen besleyici vanilya shake.' },
    { slug:'formul-1-muz', name:'Formül 1 Muz Shake', cat:'temel', price:1150, old:1620, goals:['kilo','enerji'], pop:90, desc:'Öğün yerine geçen, muz aromalı besleyici shake.' },
    { slug:'cay-bitki-klasik-102', name:'Çay-Bitki Klasik 102gr', cat:'icecek', price:1520, old:1800, goals:['enerji','kilo'], pop:88, desc:'Gün boyu canlılık için ferahlatıcı klasik bitki çayı (büyük boy).' },
    { slug:'cay-bitki-limon', name:'Çay-Bitki Limon 51gr', cat:'icecek', price:990, old:null, goals:['enerji'], pop:80, desc:'Ferahlatıcı limonlu bitki çayı içeceği.' },
    { slug:'cay-bitki-ahududu', name:'Çay-Bitki Ahududu 51gr', cat:'icecek', price:990, old:null, goals:['enerji'], pop:79, desc:'Ferahlatıcı ahududu aromalı bitki çayı.' },
    { slug:'cay-bitki-seftali', name:'Çay-Bitki Şeftali 51gr', cat:'icecek', price:990, old:null, goals:['enerji'], pop:79, desc:'Ferahlatıcı şeftali aromalı bitki çayı.' },
    { slug:'protein-bar-limon', name:'Protein Bar Limonlu', cat:'atistirma', price:730, old:807, goals:['kas','kilo'], pop:72, desc:'Limonlu, pratik ve lezzetli protein atıştırması.' },
    { slug:'protein-cips-eksi-krema-sogan', name:'Protein Cips Ekşi Krema-Soğan', cat:'atistirma', price:850, old:1052, goals:['kas'], pop:67, desc:'Ekşi krema-soğan aromalı, protein dengeli cips.' },
    { slug:'yasam-uyeligi', name:'+Yaşam Üyeliği', cat:'paket', price:5000, old:5400, goals:[], pop:55, desc:'Beslenme merkezi üyeliği: avantajlı fiyat ve destek programı.' },
    { slug:'kilo-kontrol-1', name:'Kilo Kontrol Programı-1', cat:'paket', price:3290, old:4150, goals:['kilo'], pop:93, desc:'Kilo hedefin için kişiye uygun başlangıç programı (1).' },
    { slug:'kilo-kontrol-2', name:'Kilo Kontrol Programı-2', cat:'paket', price:4340, old:5650, goals:['kilo'], pop:87, desc:'Kilo kontrolü için kapsamlı program (2).' },
    { slug:'kilo-kontrol-3', name:'Kilo Kontrol Programı-3', cat:'paket', price:3820, old:4950, goals:['kilo'], pop:85, desc:'Kilo kontrolü için kapsamlı program (3).' },
    { slug:'kilo-kontrol-4', name:'Kilo Kontrol Programı-4', cat:'paket', price:4870, old:6150, goals:['kilo'], pop:83, desc:'Kilo kontrolü için kapsamlı program (4).' },
    { slug:'kilo-kontrol-5', name:'Kilo Kontrol Programı-5', cat:'paket', price:5820, old:6980, goals:['kilo'], pop:81, desc:'Kilo kontrolü için kapsamlı program (5).' },
    { slug:'kilo-kontrol-6', name:'Kilo Kontrol Programı-6', cat:'paket', price:7015, old:8510, goals:['kilo'], pop:79, desc:'Kilo kontrolü için kapsamlı program (6).' },
    { slug:'kilo-kontrol-7', name:'Kilo Kontrol Programı-7', cat:'paket', price:6065, old:7450, goals:['kilo'], pop:78, desc:'Kilo kontrolü için kapsamlı program (7).' },
    { slug:'kilo-kontrol-8', name:'Kilo Kontrol Programı-8', cat:'paket', price:9035, old:12100, goals:['kilo'], pop:77, desc:'Kilo kontrolü için en kapsamlı program (8).' },
    { slug:'kilo-alma-1', name:'Kilo Alma Programı-1', cat:'paket', price:4650, old:6300, goals:['kas'], pop:74, desc:'Sağlıklı kilo almak için program (1).' },
    { slug:'kilo-alma-2', name:'Kilo Alma Programı-2', cat:'paket', price:5470, old:6700, goals:['kas'], pop:73, desc:'Sağlıklı kilo almak için program (2).' },
    { slug:'kilo-alma-3', name:'Kilo Alma Programı-3', cat:'paket', price:6300, old:7820, goals:['kas'], pop:72, desc:'Sağlıklı kilo almak için program (3).' },
    { slug:'paket-bolgesel-incelme', name:'Bölgesel İncelme Paketi', cat:'paket', price:5015, old:6520, goals:['kilo'], pop:75, desc:'Bölgesel incelme hedefi için destekleyici set.' },
    { slug:'formul-1-tuzlu-karamel', name:'Formül 1 Tuzlu Karamel Shake', cat:'temel', price:1150, old:1620, goals:['kilo','enerji'], pop:89, desc:'Öğün yerine geçen, tuzlu karamel aromalı besleyici shake.' },
    { slug:'cay-bitki-klasik-51', name:'Çay-Bitki Klasik 51gr', cat:'icecek', price:990, old:null, goals:['enerji','kilo'], pop:80, desc:'Ferahlatıcı klasik bitki çayı içeceği.' }
  ];

  /* ---- görsel kaynağı (geçici): herbalexpress.com.tr/upload/product/...
     Daha sonra distribütör girişiyle RESMÎ Herbalife görselleriyle değiştirilecek.
     Bozuk/erişilemez olursa otomatik yer tutucuya düşer (imgFallback). ---- */
  const IMG_BASE = 'https://www.herbalexpress.com.tr/';
  const IMG = {
    'herbal-aloe-mango':'upload/product/herbal-aloe-konsantre-icecek-473-ml-product-20251215144628-kon.webp',
    'formul-1-ahududu':'upload/product/formul-1-ogun-yerine-gecen-besleyici-shake-karisimi-product-20251215135627-ahu.webp',
    'formul-1-corba':'upload/product/formul-1-ogun-yerine-gecen-corba-product-20251215140652-çorba.webp',
    'pro-drink-vanilya':'upload/product/pro-drink-vanilya-aromali-product-20251231105725-Herbalife-Pro-drink.png',
    'multi-fiber':'upload/product/multi-fiber-product-20251215144910-multi.webp',
    'soguk-kahve-latte':'upload/product/yuksek-proteinli-soguk-kahve-karisimi-product-20251215145111-cafe.webp',
    'heartwell':'upload/product/heartwell-229-g-product-20251215145708-heart.webp',
    'tri-blend-select':'upload/product/tri-blend-select-600-g-product-20251215150141-trii.webp',
    'formul-3-pro-boost':'upload/product/formul-3-pro-boost-268-g-product-20251215151002-boo.webp',
    'protein-bar-vanilya-badem':'upload/product/protein-bar-vanilya-aromali-bademli-product-20251215152359-badem.webp',
    'protein-cips-barbeku':'upload/product/protein-cips-barbeku-aromali-product-20251215152717-bar.webp',
    'skin-collagen-drink':'upload/product/herbalife-skin-collagen-drink-powder-171-g-product-20251215153146-col.webp',
    'vitamin-mineral-erkek':'upload/product/vitamin-ve-mineral-kompleks-erkekler-icin-60-tablet-product-20251215153544-er.webp',
    'formul-2-vitamin-mineral-kadin':'upload/product/formul-2-vitamin-ve-mineral-kompleks-kadinlar-icin-60-tablet-product-20251215153906-ka.webp',
    'liftoff-limon':'upload/product/liftoff-limon-product-20251215154124-li.webp',
    'thermo-complete':'upload/product/thermo-complete-product-20251215154229-ter.webp',
    'herbalifeline-max':'upload/product/herbalifeline-max-product-20251215154349-max.webp',
    'niteworks':'upload/product/niteworks-product-20251216110138-NİTE.webp',
    'xtra-cal':'upload/product/xtra-cal-product-20251216110253-CAL.webp',
    'pro-core':'upload/product/pro-core-product-20251216110523-P.webp',
    'night-mode':'upload/product/night-mode-product-20251216110650-Nİ.webp',
    'niacinamide-serum':'upload/product/niacinamide-serum-product-20251216111037-HL.webp',
    'yenileyici-jel-temizleyici':'upload/product/yenileyici-jel-temizleyici-product-20251216111234-J.webp',
    'yogun-sikilastirici-krem':'upload/product/yogun-sikilastirici-krem-product-20260625103646-krem.png',
    'besleyici-el-vucut-kremi':'upload/product/besleyici-el-ve-vucut-kremi-product-20251216111522-e.webp',
    'besleyici-goz-kremi':'upload/product/besleyici-goz-kremi-product-20251216111630-g.webp',
    'narenciye-yuz-temizleme':'upload/product/narenciye-ozlu-parlatici-yuz-temizleme-jeli-product-20251216113230-nar.webp',
    'skin-sikilastirici-goz-jeli':'upload/product/herbalife-skin-sikilastirici-goz-jeli-15ml-product-20251216113919-göz.webp',
    'skin-kirmizi-meyve-peeling':'upload/product/herbalife-skin-kirmizi-meyve-ozlu-peeling-120ml-product-20251216114319-kır.webp',
    'skin-nane-kil-maskesi':'upload/product/herbalife-skin-nane-ozlu-arindirici-kil-maskesi-120ml-product-20251216114512-nane.webp',
    'skin-besleyici-gece-kremi':'upload/product/herbalife-skin-besleyici-gece-kremi-50ml-product-20251216114647-gece.webp',
    'aloe-el-vucut-sampuani':'upload/product/herbal-aloe-el-ve-vucut-sampuani-250ml-product-20251216123106-şam.webp',
    'aloe-rahatlatici-jel':'upload/product/herbal-aloe-rahatlatici-jel-200ml-product-20251216123323-rahat.webp',
    'aloe-el-vucut-losyonu':'upload/product/herbal-aloe-el-ve-vucut-losyonu-200ml-product-20251216123505-los.webp',
    'aloe-guclendirici-sampuan':'upload/product/herbal-aloe-guclendirici-sampuan-250ml-product-20251216123628-güç.webp',
    'aloe-guclendirici-sac-kremi':'upload/product/herbal-aloe-guclendirici-sac-kremi-250ml-product-20251216123825-saç krem.webp',
    'h24-rb-promax':'upload/product/h24-rb-promax-product-20251216132830-pro.webp',
    'cr7-drive':'upload/product/cr7-drive-spor-icecegi-tozu-product-20251216133028-dr.webp',
    'paket-dengeli-yasam':'upload/product/herbalife-dengeli-yasam-paketi-product-20251224142058-tanisma-paketi1.png',
    'paket-cilt-kolajen':'upload/product/herbalife-yeni-seri-cilt-bakimi-kolajen-cilt-bakim-paketi-product-20251230180554-cilt-bakimi-kolajen-cilt-bakim-seti.webp',
    'paket-promax-prodrink-proboost':'upload/product/pro-max-prodrink-proboost-sporcu-protein-paketi-product-20251230181405-pro-max-pro-boost-protein-drink-mix.png',
    'paket-night-mode-niteworks':'upload/product/night-mode-niteworks-kaliteli-uyku-gece-toparlanma-paketi-product-20251231123136-night.png',
    'paket-thermo-cay-kahve':'upload/product/thermo-complete-herbalife-cay-proteinli-kahve-product-20251230182335-thermo-complate-herbalife-cay-proteinli-kahve.png',
    'paket-liftoff-procore-heartwell':'upload/product/lift-off-procore-hartwell-bagisiklik-destek-paketi-product-20251230182649-lift-off-procore-hartwell.png',
    'formul-1-vanilya':'upload/product/formul-1-ogun-yerine-gecen-besleyici-vanilya-aromali-shake-karisimi-product-20251231104946-vanilya-aromali-product-variation-20251215135439-vanilya.webp',
    'formul-1-muz':'upload/product/formul-1-ogun-yerine-gecen-besleyici-muz-aromali-shake-karisimi-product-20251231105507-IMG_0717-600x537.webp',
    'cay-bitki-klasik-102':'upload/product/cay-ve-bitki-ekstreli-aromali-icecek-tozu-klasik-102gr-product-20251231110738-klasik.png',
    'cay-bitki-limon':'upload/product/cay-ve-bitki-ekstreli-aromali-icecek-tozu-limon-51-gr-product-20251231110503-cay-limon-51g-5.png',
    'cay-bitki-ahududu':'upload/product/cay-ve-bitki-ekstreli-aromali-icecek-tozu-ahududu-51-gr-product-20251231110944-ahududu-product-variation-20251215144158-içecek ahu.webp',
    'cay-bitki-seftali':'upload/product/cay-ve-bitki-ekstreli-aromali-icecek-tozu-seftali-51-gr-product-20251231111033-seftali-51-gr-product-variation-20251215144416-içecek-şeftali.webp',
    'protein-bar-limon':'upload/product/protein-bar-limonlu-product-20251231111425-limonlu.png',
    'protein-cips-eksi-krema-sogan':'upload/product/protein-cips-eksi-krema-ve-sogan-aromali-product-20251231111828-eksi-sogan.png',
    'yasam-uyeligi':'upload/product/yasam-beslenme-ve-kilo-kontrol-merkezi-uyeligi-product-20260506105214-yasam-uyelik.jpg',
    'kilo-kontrol-1':'upload/product/kilo-verme-paketi-eko-paket-product-20260609112332-ChatGPT Image 9 Haz 2026 11_13_42.png',
    'kilo-kontrol-2':'upload/product/formda-kalma-seti-product-20260609114309-ChatGPT Image 9 Haz 2026 11_41_44.png',
    'kilo-kontrol-3':'upload/product/avantajli-paket-product-20260609122147-ChatGPT Image 9 Haz 2026 12_18_58.png',
    'kilo-kontrol-4':'upload/product/hafif-yasam-uclusu-product-20260609123128-yeni.png',
    'kilo-kontrol-5':'upload/product/metabolizma-hizlandirici-paket-product-20260609123558-multili.png',
    'kilo-kontrol-6':'upload/product/kilo-kontrol-programi-6-product-20260624120248-25.png',
    'kilo-kontrol-7':'upload/product/kalori-kontrol-paketi-product-20260610110408-1.png',
    'kilo-kontrol-8':'upload/product/kilo-kontrol-programi-8-product-20260623132636-resim1.png',
    'kilo-alma-1':'upload/product/kilo-alma-desek-paketi-product-20260610113137-kiloal.png',
    'kilo-alma-2':'upload/product/fit-hacim-paketi-product-20260610114806-vbgit.jpg',
    'kilo-alma-3':'upload/product/hizli-kilo-paketi-product-20260610121404---son.jpg',
    'paket-bolgesel-incelme':'upload/product/bolgesel-incelme-paketi-product-20260623134540-yeni böl.png',
    'formul-1-tuzlu-karamel':'upload/product/formul-1-ogun-yerine-gecen-besleyici-tuzlu-karamel-aromali-shake-karisimi-product-20260623123209-yeni.jfif',
    'cay-bitki-klasik-51':'upload/product/cay-ve-bitki-ekstreli-aromali-icecek-tozu-klasik-51-gr-product-20251215143319-klasik.webp'
  };

  const products = P.map((p, i) => ({
    id: i + 1,
    stock: p.stock !== false,
    old: p.old || null,
    goals: p.goals || [],
    ...p,
    img: IMG[p.slug] ? IMG_BASE + IMG[p.slug] : null
  }));

  const catName = (key) => (CATEGORIES.find(c => c.key === key) || {}).name || key;

  /* ---- görsel: gerçek dosya yoksa şık yer tutucu (data-URI SVG) ---- */
  const CAT_COLOR = {
    temel:'#2e9d5b', icecek:'#3b9ae1', atistirma:'#e8833a', takviye:'#7c5cd6',
    aktif:'#d64545', skin:'#cf7da6', aloe:'#3cb38b', paket:'#c79a30'
  };
  function placeholder(p) {
    const c = CAT_COLOR[p.cat] || '#2e9d5b';
    const svg =
      "<svg xmlns='http://www.w3.org/2000/svg' width='600' height='600'>" +
      "<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>" +
      "<stop offset='0' stop-color='" + c + "'/>" +
      "<stop offset='1' stop-color='" + c + "' stop-opacity='.6'/>" +
      "</linearGradient></defs>" +
      "<rect width='600' height='600' fill='url(#g)'/>" +
      "<text x='50%' y='50%' font-family='Arial,Helvetica,sans-serif' font-size='42' " +
      "font-weight='bold' fill='#ffffff' fill-opacity='.92' text-anchor='middle' " +
      "dominant-baseline='middle'>Herbalife</text></svg>";
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  function imgSrc(p) { return p.img ? encodeURI(p.img) : placeholder(p); }
  /* <img onerror> → erişilemeyen görseli yer tutucuyla değiştir (sonsuz döngü yok) */
  function imgFallback(el) { el.onerror = null; el.src = placeholder({ cat: el.getAttribute('data-cat') }); }

  /* ---- GERÇEK değerlendirme: puanlar /api/reviews'ten gelir (sahte yok) ---- */
  const ratings = {}; // slug -> { avg, count }  (özet önbelleği)
  let _sumPromise = null;
  // tüm ürünlerin puan özetini tek seferde çek (katalog grid için)
  function loadSummary() {
    if (_sumPromise) return _sumPromise;
    _sumPromise = fetch('/api/reviews/summary')
      .then(r => r.ok ? r.json() : { summary: {} })
      .then(d => { Object.assign(ratings, d.summary || {}); return ratings; })
      .catch(() => ratings);
    return _sumPromise;
  }
  function ratingOf(slug) { return ratings[slug] || null; }
  // yeni/güncellenen değerlendirme sonrası önbelleği güncelle (kartlar anında yenilensin)
  function setRating(slug, r) { if (slug && r) ratings[slug] = { avg: r.avg, count: r.count }; }
  // avg (0–5) → renkli yıldız glifleri (dolu altın, boş çizgi)
  function starGlyphs(avg) {
    const full = Math.max(0, Math.min(5, Math.round(avg || 0)));
    return "<span style='color:#f4b400;letter-spacing:1px'>" + '★'.repeat(full) + '</span>'
         + "<span style='color:var(--line,#d9d2c4);letter-spacing:1px'>" + '★'.repeat(5 - full) + '</span>';
  }
  // kart için yıldız satırı: puan varsa göster, yoksa "ilk değerlendiren sen ol"
  function starsRow(slug) {
    const r = ratings[slug];
    if (r && r.count > 0) {
      return "<div class='stars'>" + starGlyphs(r.avg)
        + " <b>" + r.avg.toFixed(1) + "</b> <span class='rv-count'>(" + r.count + ")</span></div>";
    }
    return "<div class='stars stars-empty'>" + starGlyphs(0)
      + " <span>Henüz değerlendirilmemiş</span></div>";
  }

  /* ---- ortak ürün kartı (ana sayfa + bulucu kullanır; mağazanın kendi kartı var) ---- */
  const fmtTRY = n => (n || 0).toLocaleString('tr-TR') + ' ₺';
  const discPct = p => (p.old && p.old > p.price) ? Math.round((1 - p.price / p.old) * 100) : 0;
  const escA = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const FAV = "<button class='fav' aria-label='Favori'><svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'><path d='M12 21C5 14 3 11 3 7.5A4.5 4.5 0 0 1 12 6a4.5 4.5 0 0 1 9 1.5C21 11 19 14 12 21z'/></svg></button>";
  function card(p, opts) {
    opts = opts || {};
    const pct = discPct(p), priced = p.stock && p.price;
    const showRib = opts.match || opts.rib; // rib DOM'da olsun (ana sayfa çalışma anında .match ekler)
    const priceHtml = priced
      ? "<span class='priceblock'><span class='price' style='font-weight:800;font-size:1.06rem;color:var(--ink)'>" + fmtTRY(p.price) + "</span>" + (p.old ? "<span class='oldprice'>" + fmtTRY(p.old) + "</span>" : "") + "</span>"
      : "<span class='soldlabel'>Stokta yok</span>";
    const addBtn = priced
      ? "<button class='btn btn-primary btn-sm add'>Sepete ekle</button>"
      : "<button class='btn btn-ghost btn-sm' disabled>Stok yok</button>";
    return "<article class='pcard" + (opts.match ? ' match' : '') + (priced ? '' : ' soldout') + "' " + (opts.attrs || '') + ">"
      + (showRib ? "<span class='match-rib'>✦ Sana uygun</span>" : '')
      + "<div class='picwrap'>" + (pct ? "<span class='disc-rib'>%" + pct + "</span>" : '')
      + "<img class='pic' src='" + imgSrc(p) + "' alt='" + escA(p.name) + "' loading='lazy' data-cat='" + p.cat + "' onerror='window.CATALOG.imgFallback(this)'>"
      + FAV + "</div>"
      + "<div class='body'><span class='cat'>" + escA(opts.catLabel || catName(p.cat)) + "</span><h3>" + escA(p.name) + "</h3>"
      + "<p>" + escA(p.desc.split('.')[0]) + ".</p>"
      + starsRow(p.slug)
      + "<div class='row'>" + priceHtml + addBtn + "</div></div></article>";
  }

  window.CATALOG = {
    categories: CATEGORIES, products, catName, imgSrc, placeholder, imgFallback,
    loadSummary, ratingOf, setRating, starGlyphs, starsRow, card, fmtTRY, discPct
  };
})();
