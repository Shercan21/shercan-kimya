/* SHERCAN Kimya — uygulama mantığı (tek sayfa, adres çubuğu #/ ile gezinir) */
(function () {
"use strict";

/* ================= sabit bilgiler ================= */
const TEMA = {
  1: { ad: "Etkileşim" },
  2: { ad: "Çeşitlilik" },
  3: { ad: "Sürdürülebilirlik" }
};

const UNITE = {
  9: {
    "1.1": { ad: "Kimya Bilimi ve Laboratuvar Güvenliği", ozet: "Günlük hayatta kimya, alt disiplinler, kariyer, kimyasalların güvenli kullanımı" },
    "1.2": { ad: "Atomun Yapısı ve Periyodik Tablo", ozet: "Atom teorileri, orbitaller, periyodik tablo, iyonlar, periyodik özellikler" },
    "2.1": { ad: "Kimyasal Türler Arası Güçlü Etkileşimler", ozet: "Metalik, iyonik ve kovalent bağ, Lewis yapısı, polarlık, adlandırma" },
    "2.2": { ad: "Zayıf Etkileşimler ve Sıvıların Özellikleri", ozet: "Moleküller arası kuvvetler, katılar, buhar basıncı, kaynama, viskozite, yüzey gerilimi" },
    "3.1": { ad: "Nanoteknoloji ve Yeşil Kimya", ozet: "Metal nanoparçacıklar, atık önleme, metal ve alaşımların çevresel etkileri" }
  },
  10: {
    "1.1": { ad: "Kimyasal Tepkimeler", ozet: "Kimyasal değişim, tepkime türleri, mol, denkleştirme, stokiyometri" },
    "1.2": { ad: "Gazlar", ozet: "Gazların özellikleri, gaz yasaları, ideal gaz, difüzyon ve efüzyon" },
    "2.1": { ad: "Çözeltiler", ozet: "Çözünme, çözünürlük, derişim birimleri, koligatif özellikler" },
    "3.1": { ad: "Yeşil Kimya", ozet: "Mikro ölçekli deneyler, atmosferdeki tepkimeler ve küresel sorunlar" }
  },
  11: {
    "1.1": { ad: "Kimyasal Tepkimelerde Enerji", ozet: "Ekzotermik ve endotermik tepkimeler, bağ enerjisi, oluşum entalpisi" },
    "1.2": { ad: "Kimyasal Tepkimelerde Hız", ozet: "Çarpışma teorisi, ortalama hız, hıza etki eden faktörler, hız denklemi" },
    "2.1": { ad: "Kimyasal Denge", ozet: "Tersinir tepkimeler, denge sabiti, tepkime oranı, Le Chatelier ilkesi" },
    "2.2": { ad: "Asit-Baz Dengesi", ozet: "Suyun iyonlaşması, asit-baz teorileri, pH, nötralleşme, titrasyon" },
    "2.3": { ad: "Çözünürlük Dengesi", ozet: "Molar çözünürlük, çözünürlük çarpımı, ortak iyon etkisi" },
    "3.1": { ad: "Sürdürülebilirlik", ozet: "Yeşil hidrojen, nanoteknolojik ürünler, mikro ve nanoplastikler" }
  }
};

const SINIFLAR = [9, 10, 11];
const $ = (s, k) => (k || document).querySelector(s);
const ekran = $("#ekran");

/* ================= kalıcı kayıt ================= */
const depo = {
  al(k, v) { try { const x = localStorage.getItem("shr_" + k); return x === null ? v : JSON.parse(x); } catch (e) { return v; } },
  koy(k, v) { try { localStorage.setItem("shr_" + k, JSON.stringify(v)); } catch (e) {} }
};
let sinif = depo.al("sinif", 9);
if (!SINIFLAR.includes(sinif)) sinif = 9;

/* ================= veri ================= */
const veri = {};
function veriYukle(g) {
  if (veri[g]) return Promise.resolve(veri[g]);
  return fetch("veri/" + g + ".json").then(r => {
    if (!r.ok) throw new Error("veri");
    return r.json();
  }).then(d => (veri[g] = dizinle(g, d)));
}

/* bölümleri ünitelere dağıtır, bağlam testlerini önündeki kazanıma bağlar */
function dizinle(g, bolumler) {
  const unite = {}, karma = [], byId = {};
  let sonKazanim = null;
  bolumler.forEach(b => {
    byId[b.id] = b;
    b.kod = (b.baslik.match(/^(\d\.\d\.\d)/) || [])[1] || null;
    if (b.tur === "karma") { karma.push(b); return; }
    const u = b.unite || "?";
    (unite[u] = unite[u] || []).push(b);
    if (b.tur === "kazanim") { sonKazanim = b; b.baglamlar = []; }
    else if (b.tur === "baglam" && sonKazanim && sonKazanim.unite === b.unite) { sonKazanim.baglamlar.push(b); b.ust = sonKazanim; }
  });
  return { g, bolumler, unite, karma, byId };
}

function testAnahtar(g, id, ti) { return g + "|" + id + "|" + ti; }
function skorlar() { return depo.al("skor", {}); }
function soruSayisi(b) { return b.testler.reduce((a, t) => a + t.sorular.length, 0); }

function seviyeAdi(b, t) {
  if (b.tur === "baglam") return "Bağlam";
  if (b.tur === "sarmal") return "Sarmal";
  if (b.tur === "karma") return "Karma";
  return t.seviye || "Test";
}

function cip(g, b, ti, etiket) {
  const t = b.testler[ti];
  const sk = skorlar()[testAnahtar(g, b.id, ti)];
  const sv = seviyeAdi(b, t);
  const a = document.createElement("a");
  a.className = "cip" + (sk ? " cozuldu" : "");
  a.dataset.sv = sv;
  a.href = "#/" + g + "/t/" + b.id + "/" + ti;
  a.innerHTML = '<span class="nokta"></span>' + (etiket || sv) + ", " + t.sorular.length + " soru" +
    (sk ? " <em>" + sk.b + "/" + sk.n + "</em>" : "");
  return a;
}

/* ünitedeki çözülmüş test oranı */
function uniteIlerleme(g, liste) {
  const sk = skorlar();
  let top = 0, coz = 0;
  liste.forEach(b => b.testler.forEach((_, ti) => { top++; if (sk[testAnahtar(g, b.id, ti)]) coz++; }));
  return top ? coz / top : 0;
}

/* ================= üst çubuk ================= */
function sinifCubugu() {
  const n = $("#sinif-sec");
  n.innerHTML = SINIFLAR.map(g => `<button data-g="${g}" aria-pressed="${g === sinif}">${g}</button>`).join("");
}
$("#sinif-sec").addEventListener("click", e => {
  const b = e.target.closest("button[data-g]");
  if (!b) return;
  sinifDegis(+b.dataset.g);
});
function sinifDegis(g) {
  sinif = g; depo.koy("sinif", g); sinifCubugu();
  const h = location.hash.replace(/^#\/(9|10|11)\b/, "#/" + g);
  if (/^#\/(9|10|11)\/(t|konu\/)/.test(location.hash)) location.hash = "#/" + g + (location.hash.includes("/konu") ? "/konu" : "/testler");
  else if (h !== location.hash) location.hash = h;
  else yonlendir();
}

/* ================= ekranlar ================= */
function baslik(t) { document.title = t ? t + " | SHERCAN Kimya" : "SHERCAN Kimya"; }
function goster(html) { ekran.innerHTML = html; window.scrollTo(0, 0); }
function hata() {
  goster('<p class="bos">Veriler yüklenemedi. İnternet bağlantını kontrol edip sayfayı yenile; uygulama bir kez açıldıktan sonra çevrimdışı da çalışır.</p>');
}

function anaSayfa() {
  baslik("");
  veriYukle(sinif).then(v => {
    const nT = v.bolumler.reduce((a, b) => a + b.testler.length, 0);
    const nS = v.bolumler.reduce((a, b) => a + soruSayisi(b), 0);
    const sk = skorlar();
    const cozulen = Object.keys(sk).filter(k => k.startsWith(sinif + "|")).length;
    const yanlis = depo.al("yanlis", []).filter(y => y.g === sinif).length;
    const uniteSay = Object.keys(UNITE[sinif]).length;
    goster(`
      <section class="giris">
        <h1>Bugün hangi sınıfla çalışıyorsun?</h1>
        <p class="alt">SHERCAN soru bankasının bütün testleri ve konu anlatımları burada. Soruyu cevapladığın anda çözümü açılır.</p>
        <div class="toplar" role="group" aria-label="Sınıf">
          ${SINIFLAR.map((g, i) => (i ? '<span class="bag"></span>' : "") +
            `<button class="top" data-g="${g}" aria-pressed="${g === sinif}">${g}<small>sınıf</small></button>`).join("")}
        </div>
        <div class="yollar">
          <a class="yol ana" href="#/${sinif}/testler">
            <span class="simge">✏️</span>
            <div><b>Testler</b><span>${nT} test, ${nS} soru. Kolay, orta, zor, bağlam temelli ve sarmal.</span></div>
          </a>
          <a class="yol" href="#/${sinif}/konu">
            <span class="simge">📗</span>
            <div><b>Konu anlatımı</b><span>${uniteSay} ünite, çözümlü örneklerle. Her konunun sonunda testleri var.</span></div>
          </a>
          <a class="yol" href="#/${sinif}/etkinlik">
            <span class="simge">🧩</span>
            <div><b>Etkinlikler</b><span>Doğru-yanlış, eşleştirme, boşluk doldurma, kavram haritası. Her kazanım için.</span></div>
          </a>
          <a class="yol" href="#/${sinif}/yazili">
            <span class="simge">📝</span>
            <div><b>Yazılıya hazırlık</b><span>Ortak yazılı senaryolarına göre sınavlar, cevaplar ve PDF kâğıtlar.</span></div>
          </a>
          <a class="yol" href="#/${sinif}/karma">
            <span class="simge">🧪</span>
            <div><b>Karma testler</b><span>${v.karma.length} deneme, bütün konulardan karışık.</span></div>
          </a>
          <a class="yol" href="#/${sinif}/yanlis">
            <span class="simge">📕</span>
            <div><b>Yanlış defterim</b><span>${yanlis ? yanlis + " soru seni bekliyor." : "Yanlış yaptığın sorular burada toplanır."}</span></div>
          </a>
        </div>
        <p class="ozet"><span><b>${cozulen}</b> test çözdün</span></p>
      </section>`);
    ekran.querySelector(".toplar").addEventListener("click", e => {
      const b = e.target.closest(".top");
      if (b) sinifDegis(+b.dataset.g);
    });
  }).catch(hata);
}

function testlerSayfasi(g) {
  baslik(g + ". sınıf testler");
  veriYukle(g).then(v => {
    let h = `<a class="geri" href="#/">← Ana sayfa</a><h1>${g}. sınıf testler</h1>
      <p class="alt">Bir üniteye gir; her konunun kolay, orta ve zor testleri ile bağlam temelli testi bir arada.</p>`;
    let sonTema = null;
    Object.keys(UNITE[g]).forEach(kod => {
      const tema = +kod[0];
      if (tema !== sonTema) {
        if (sonTema !== null) h += "</div>";
        h += `<div class="tema"><h2>${tema}. Tema: ${TEMA[tema].ad}</h2>`;
        sonTema = tema;
      }
      const liste = v.unite[kod] || [];
      const tS = liste.reduce((a, b) => a + b.testler.length, 0);
      const qS = liste.reduce((a, b) => a + soruSayisi(b), 0);
      const il = Math.round(uniteIlerleme(g, liste) * 100);
      h += `<a class="unite" href="#/${g}/u/${kod}">
        <span class="kod">${kod}</span>
        <div style="flex:1"><b>${UNITE[g][kod].ad}</b><span>${tS} test, ${qS} soru</span>
        <div class="cubuk" aria-label="Çözülen testler yüzde ${il}"><i style="width:${il}%"></i></div></div>
        <span class="ok">›</span></a>`;
    });
    h += `</div><div class="tema"><h2>Karma testler</h2>
      <a class="unite" href="#/${g}/karma"><span class="kod">K</span>
      <div style="flex:1"><b>Bütün konulardan karışık</b><span>${v.karma.length} test</span></div><span class="ok">›</span></a></div>`;
    goster(h);
  }).catch(hata);
}

function uniteSayfasi(g, kod) {
  Promise.all([veriYukle(g), etkYukle(g).catch(() => [])]).then(([v, etk]) => {
    const u = UNITE[g][kod];
    if (!u) return anaSayfa();
    baslik(u.ad);
    const liste = v.unite[kod] || [];
    const h = `<a class="geri" href="#/${g}/testler">← Üniteler</a>
      <h1>${u.ad}</h1><p class="alt">${u.ozet}.</p>
      <a class="dugme ikincil" href="#/${g}/konu/${kod}" style="margin:-4px 0 22px">Önce konu anlatımını oku</a>
      <div id="liste"></div>`;
    goster(h);
    const kap = $("#liste");
    liste.forEach(b => {
      if (b.tur === "baglam" && b.ust) return;    /* kazanım kartının içinde gösterilir */
      const d = document.createElement("div");
      d.className = "kazanim" + (b.tur === "sarmal" ? " sarmal" : b.tur === "baglam" ? " baglam" : "");
      let ad = b.baslik, not = "";
      if (b.tur === "sarmal") { ad = b.baslik.replace(/\s*\(.*$/, ""); not = "Ünitenin bütün konularından, tekrar için."; }
      d.innerHTML = `<h3>${ad}</h3>${not ? `<p class="not">${not}</p>` : ""}<div class="cipler"></div>`;
      const c = d.querySelector(".cipler");
      b.testler.forEach((_, ti) => c.appendChild(cip(g, b, ti)));
      (b.baglamlar || []).forEach(bb => bb.testler.forEach((_, ti) => c.appendChild(cip(g, bb, ti, "Bağlam temelli"))));
      if (b.tur === "kazanim") etkBul(etk, b.baslik.split(" ")[0]).forEach(e => c.appendChild(etkCip(g, e)));
      kap.appendChild(d);
    });
  }).catch(hata);
}

function karmaSayfasi(g) {
  baslik(g + ". sınıf karma testler");
  veriYukle(g).then(v => {
    goster(`<a class="geri" href="#/${g}/testler">← Testler</a><h1>Karma testler</h1>
      <p class="alt">Her test bütün kazanımlardan karışık sorular içerir. Dönem sonu ve sınav öncesi tekrar için.</p>
      <div class="karma-izgara" id="liste"></div>`);
    const kap = $("#liste");
    v.karma.forEach((b, k) => kap.appendChild(cip(g, b, 0, "Karma " + String(k + 1).padStart(2, "0"))));
  }).catch(hata);
}

/* ================= test motoru ================= */
let T = null;   /* aktif test */

function testBaslat(g, id, ti) {
  veriYukle(g).then(v => {
    const b = v.byId[id];
    if (!b || !b.testler[+ti]) return anaSayfa();
    const t = b.testler[+ti];
    const anahtar = testAnahtar(g, id, ti);
    const kayit = depo.al("devam", {})[anahtar];
    T = {
      g, b, ti: +ti, anahtar, mod: "normal",
      sorular: t.sorular.map((q, qi) => ({ q, ref: { g, id, ti: +ti, qi } })),
      secim: kayit && kayit.length === t.sorular.length ? kayit : new Array(t.sorular.length).fill(null),
      i: 0
    };
    const ilkBos = T.secim.indexOf(null);
    T.devam = kayit && ilkBos > 0;
    T.i = ilkBos < 0 ? 0 : ilkBos;
    if (ilkBos < 0) { T.secim.fill(null); T.i = 0; T.devam = false; }
    baslik(testBasligi(T));
    soruCiz();
  }).catch(hata);
}

function testBasligi(T) {
  if (T.mod === "defter") return "Yanlış defteri";
  const b = T.b;
  if (b.tur === "karma") return b.baslik.replace(/\s*[—–-]+\s*Tüm.*$/, "");
  if (b.tur === "sarmal") return b.baslik.replace(/\s*\(.*$/, "");
  return b.baslik + (b.tur === "kazanim" && b.testler[T.ti].seviye ? ", " + b.testler[T.ti].seviye.toLocaleLowerCase("tr") : "");
}

function geriAdresi() {
  if (T.mod === "defter") return "#/" + T.g + "/yanlis";
  if (T.b.tur === "karma") return "#/" + T.g + "/karma";
  return "#/" + T.g + "/u/" + (T.b.unite || "");
}

function soruCiz() {
  const { q } = T.sorular[T.i];
  const cevap = T.secim[T.i];
  const harfOnly = q.sik.every(s => !s);
  const zincir = T.sorular.map((_, k) => {
    const s = T.secim[k];
    const dur = s === null ? "" : (s === T.sorular[k].q.d ? " d" : " y");
    return `<button class="b${dur}${k === T.i ? " simdi" : ""}" data-k="${k}" aria-label="${k + 1}. soru">${k + 1}</button>`;
  }).join("");
  const sik = q.sik.map((s, k) => {
    let cls = "", m = "";
    if (cevap !== null) {
      if (k === q.d) { cls = " d"; m = "✓"; }
      else if (k === cevap) { cls = " y"; m = "✕"; }
    }
    return `<button class="sik${cls}" data-k="${k}" ${cevap !== null ? "disabled" : ""}>
      <span class="h">${"ABCDE"[k]}</span>${harfOnly ? "" : `<span>${s}</span>`}<span class="m">${m}</span></button>`;
  }).join("");
  const sonMu = T.i === T.sorular.length - 1;
  const hepsi = T.secim.every(x => x !== null);
  goster(`
    <a class="geri" href="${geriAdresi()}">← ${T.mod === "defter" ? "Yanlış defteri" : "Testten çık"}</a>
    <div class="zincir" role="group" aria-label="Sorular">${zincir}</div>
    ${T.devam ? '<p class="devam">Kaldığın yerden devam ediyorsun.</p>' : ""}
    <article class="kart">
      <div class="kart-ust"><span class="no">${String(T.i + 1).padStart(2, "0")}</span>
        <span class="yer">${T.mod === "defter" ? kaynakAdi(T.sorular[T.i].ref) : testBasligi(T)}${q.z && T.b && T.b.tur !== "kazanim" ? ", " + q.z.toLocaleLowerCase("tr") : ""}</span></div>
      ${q.beceri ? `<span class="beceri">${q.beceri}</span>` : ""}
      <div class="soru">${tabloSar(q.s)}</div>
      <div class="siklar${harfOnly ? " harf" : ""}">${sik}</div>
      ${cevap !== null ? `<div class="cozum"><b class="bas">${cevap === q.d ? "Doğru." : "Doğru cevap " + "ABCDE"[q.d] + "."}</b>${q.c ? tabloSar(q.c) : ""}</div>` : ""}
      ${cevap !== null ? `<button class="dugme" id="ileri">${hepsi ? "Sonucu gör" : "Sonraki soru"}</button>` : ""}
    </article>`);
  T.devam = false;
  ekran.querySelector(".siklar").addEventListener("click", e => {
    const b = e.target.closest(".sik");
    if (!b || b.disabled) return;
    cevapla(+b.dataset.k);
  });
  ekran.querySelector(".zincir").addEventListener("click", e => {
    const b = e.target.closest(".b");
    if (!b) return;
    T.i = +b.dataset.k; soruCiz();
  });
  const il = $("#ileri");
  if (il) il.addEventListener("click", ileri);
}

function tabloSar(h) { return h.replace(/<table>/g, '<div class="tablo-sar"><table>').replace(/<\/table>/g, "</table></div>"); }

function cevapla(k) {
  T.secim[T.i] = k;
  const { q, ref } = T.sorular[T.i];
  const yanlisDefteri = depo.al("yanlis", []);
  const ayni = y => y.g === ref.g && y.id === ref.id && y.ti === ref.ti && y.qi === ref.qi;
  if (k !== q.d) {
    if (!yanlisDefteri.some(ayni)) { yanlisDefteri.push(ref); depo.koy("yanlis", yanlisDefteri); }
  } else if (T.mod === "defter") {
    depo.koy("yanlis", yanlisDefteri.filter(y => !ayni(y)));
  }
  if (T.mod === "normal") {
    const d = depo.al("devam", {}); d[T.anahtar] = T.secim; depo.koy("devam", d);
  }
  soruCiz();
}

function ileri() {
  const bos = T.secim.indexOf(null);
  if (bos < 0) return sonucCiz();
  /* önce sıradaki boş soruya, yoksa baştaki boşa */
  let n = T.secim.indexOf(null, T.i + 1);
  T.i = n < 0 ? bos : n;
  soruCiz();
}

function sonucCiz() {
  const n = T.sorular.length;
  const dogru = T.sorular.filter((s, k) => T.secim[k] === s.q.d).length;
  if (T.mod === "normal") {
    const sk = skorlar();
    const eski = sk[T.anahtar];
    sk[T.anahtar] = { b: Math.max(dogru, eski ? eski.b : 0), n, s: dogru, t: Date.now() };
    depo.koy("skor", sk);
    const d = depo.al("devam", {}); delete d[T.anahtar]; depo.koy("devam", d);
  }
  const oran = dogru / n;
  const yorum = oran >= .85 ? "Çok iyi. Bu konu sende oturmuş; bir üst seviyeye geçebilirsin."
    : oran >= .6 ? "İyi gidiyorsun. Yanlış yaptığın soruların çözümlerini bir kez daha oku."
    : oran >= .35 ? "Temel var ama eksikler de var. Konu anlatımına dönüp örnekleri tekrar çöz."
    : "Moralini bozma. Önce konu anlatımını oku, sonra bu testi baştan çöz.";
  /* zorluk dökümü */
  const dokum = {};
  T.sorular.forEach((s, k) => {
    const z = s.q.z || "Genel";
    dokum[z] = dokum[z] || [0, 0];
    dokum[z][1]++; if (T.secim[k] === s.q.d) dokum[z][0]++;
  });
  const dokumH = Object.keys(dokum).length > 1
    ? `<p class="ozet">${Object.entries(dokum).map(([z, [a, b]]) => `<span>${z}: <b>${a}/${b}</b></span>`).join("")}</p>` : "";
  const yanlisSay = n - dogru;
  const konuLink = T.mod === "normal" && T.b.unite && T.b.tur !== "karma"
    ? `<a class="dugme ikincil" href="#/${T.g}/konu/${T.b.unite}${T.b.kod ? "?k=" + T.b.kod : (T.b.ust && T.b.ust.kod ? "?k=" + T.b.ust.kod : "")}">Konu anlatımına dön</a>` : "";
  const zincir = T.sorular.map((s, k) => `<button class="b ${T.secim[k] === s.q.d ? "d" : "y"}" data-k="${k}">${k + 1}</button>`).join("");
  goster(`
    <a class="geri" href="${geriAdresi()}">← Listeye dön</a>
    <div class="kart">
      <p class="yer" style="color:var(--soluk)">${testBasligi(T)}</p>
      <div class="puan"><b>${dogru}</b><span>/ ${n} doğru</span></div>
      ${dokumH}
      <p class="yorum">${yorum}</p>
      <div class="zincir" style="margin-top:16px">${zincir}</div>
      ${yanlisSay ? `<button class="dugme vurgu" id="yanlis-coz">${yanlisSay} yanlışı tekrar çöz</button>` : ""}
      ${konuLink}
      <button class="dugme ikincil" id="paylas">Sonucu paylaş</button>
      ${T.mod === "normal" ? `<button class="dugme ikincil" id="bastan">Testi baştan çöz</button>` : ""}
    </div>`);
  ekran.querySelector(".zincir").addEventListener("click", e => {
    const b = e.target.closest(".b"); if (!b) return;
    T.i = +b.dataset.k; soruCiz();
  });
  const yb = $("#yanlis-coz");
  if (yb) yb.addEventListener("click", () => {
    const liste = T.sorular.filter((s, k) => T.secim[k] !== s.q.d);
    T = Object.assign({}, T, { mod: T.mod === "defter" ? "defter" : "tekrar", sorular: liste, secim: new Array(liste.length).fill(null), i: 0 });
    soruCiz();
  });
  const bb = $("#bastan");
  if (bb) bb.addEventListener("click", () => { T.secim = new Array(n).fill(null); T.i = 0; soruCiz(); });
  $("#paylas").addEventListener("click", async () => {
    const metin = `SHERCAN Kimya, ${testBasligi(T)}: ${n} soruda ${dogru} doğru yaptım.`;
    try {
      if (navigator.share) await navigator.share({ title: "SHERCAN Kimya", text: metin, url: location.href.split("#")[0] });
      else { await navigator.clipboard.writeText(metin); $("#paylas").textContent = "Panoya kopyalandı"; }
    } catch (e) {}
  });
}

/* ================= yanlış defteri ================= */
function kaynakAdi(ref) {
  const v = veri[ref.g]; if (!v) return "";
  const b = v.byId[ref.id]; if (!b) return "";
  if (b.tur === "karma") return b.baslik.replace(/\s*[—–-]+\s*Tüm.*$/, "");
  if (b.tur === "sarmal") return b.baslik.replace(/\s*\(.*$/, "");
  return b.baslik;
}

function yanlisSayfasi(g) {
  baslik("Yanlış defteri");
  veriYukle(g).then(v => {
    const liste = depo.al("yanlis", []).filter(y => y.g === g && v.byId[y.id] && v.byId[y.id].testler[y.ti] && v.byId[y.id].testler[y.ti].sorular[y.qi]);
    if (!liste.length) {
      goster(`<a class="geri" href="#/">← Ana sayfa</a><h1>Yanlış defterim</h1>
        <p class="bos">Defterin boş. Testlerde yanlış yaptığın her soru buraya eklenir; burada doğru çözünce defterden silinir.</p>
        <a class="dugme" href="#/${g}/testler">Test çözmeye başla</a>`);
      return;
    }
    const gruplar = {};
    liste.forEach(y => { const ad = kaynakAdi(y); gruplar[ad] = (gruplar[ad] || 0) + 1; });
    goster(`<a class="geri" href="#/">← Ana sayfa</a><h1>Yanlış defterim</h1>
      <p class="alt">${g}. sınıfta ${liste.length} soru. Doğru çözdüğün soru defterden silinir.</p>
      <button class="dugme vurgu" id="hepsi">Hepsini çöz</button>
      <h2>Konulara göre</h2>
      <div class="kazanim"><ul style="margin-left:18px">${Object.entries(gruplar).map(([a, n]) => `<li>${a}: <b>${n}</b></li>`).join("")}</ul></div>
      <button class="dugme ikincil" id="temizle">Defteri temizle</button>`);
    $("#hepsi").addEventListener("click", () => {
      T = {
        g, b: null, mod: "defter",
        sorular: liste.map(y => ({ q: v.byId[y.id].testler[y.ti].sorular[y.qi], ref: y })),
        i: 0
      };
      T.secim = new Array(T.sorular.length).fill(null);
      soruCiz();
    });
    $("#temizle").addEventListener("click", () => {
      depo.koy("yanlis", depo.al("yanlis", []).filter(y => y.g !== g));
      yanlisSayfasi(g);
    });
  }).catch(hata);
}

/* ================= konu anlatımı ================= */
function konuListesi(g) {
  baslik(g + ". sınıf konu anlatımı");
  let h = `<a class="geri" href="#/">← Ana sayfa</a><h1>${g}. sınıf konu anlatımı</h1>
    <p class="alt">Her ünite kazanım kazanım anlatılıyor. Örneklerin çözümleri kapalı; önce kendin dene, sonra aç. Her konunun sonunda kitaptaki testlerine geçebilirsin.</p>`;
  let sonTema = null;
  Object.keys(UNITE[g]).forEach(kod => {
    const tema = +kod[0];
    if (tema !== sonTema) { if (sonTema !== null) h += "</div>"; h += `<div class="tema"><h2>${tema}. Tema: ${TEMA[tema].ad}</h2>`; sonTema = tema; }
    h += `<a class="unite" href="#/${g}/konu/${kod}"><span class="kod">${kod}</span>
      <div style="flex:1"><b>${UNITE[g][kod].ad}</b><span>${UNITE[g][kod].ozet}</span></div><span class="ok">›</span></a>`;
  });
  goster(h + "</div>");
}

const konuOnbellek = {};
function konuSayfasi(g, kod, hedef) {
  const u = UNITE[g][kod];
  if (!u) return konuListesi(g);
  baslik(u.ad);
  goster(`<p class="bos">Yükleniyor…</p>`);
  const al = konuOnbellek[g + kod] ? Promise.resolve(konuOnbellek[g + kod])
    : fetch("konu/" + g + "/" + kod + ".html").then(r => { if (!r.ok) throw 0; return r.text(); });
  Promise.all([al, veriYukle(g), etkYukle(g).catch(() => [])]).then(([html, v, etk]) => {
    konuOnbellek[g + kod] = html;
    goster(`<a class="geri" href="#/${g}/konu">← Üniteler</a>
      <h1>${u.ad}</h1><p class="alt">${g}. sınıf, ${+kod[0]}. Tema: ${TEMA[+kod[0]].ad}</p>
      <nav class="icindekiler" id="icindekiler" aria-label="Bu ünitede"></nav>
      <article class="konu">${html}</article>
      <div class="testbag"><b>Ünite tekrar testi</b><div class="cipler" id="sarmal"></div></div>
      <a class="dugme" href="#/${g}/u/${kod}">Ünitenin bütün testleri</a>`);
    /* içindekiler */
    const ic = $("#icindekiler");
    ekran.querySelectorAll(".konu > section[id]").forEach(s => {
      const h2 = s.querySelector("h2");
      const k = h2.querySelector(".k");
      const a = document.createElement("a");
      a.href = "#/" + g + "/konu/" + kod + "?k=" + s.id.replace(/^k-/, "").replace(/-/g, ".");
      a.innerHTML = (k ? "<span>" + k.textContent + "</span>" : "") + h2.childNodes[h2.childNodes.length - 1].textContent;
      ic.appendChild(a);
    });
    /* her bölümün sonuna testleri ekle */
    const liste = v.unite[kod] || [];
    ekran.querySelectorAll(".testbag[data-kod]").forEach(tb => {
      const kodlar = tb.dataset.kod.split(",");
      const c = document.createElement("div"); c.className = "cipler";
      liste.filter(b => b.tur === "kazanim" && kodlar.some(k => b.baslik.startsWith(k + " ") || b.baslik.startsWith(k + "-") || b.baslik.startsWith(k + " –"))).forEach(b => {
        b.testler.forEach((_, ti) => c.appendChild(cip(g, b, ti, (b.baslik.match(/^\S+-([A-D])\b/) ? b.baslik.match(/^\S+-([A-D])\b/)[1] + ", " : "") + seviyeAdi(b, b.testler[ti]))));
        (b.baglamlar || []).forEach(bb => bb.testler.forEach((_, ti) => c.appendChild(cip(g, bb, ti, "Bağlam temelli"))));
      });
      kodlar.forEach(k => etkBul(etk, k).forEach(e => c.insertBefore(etkCip(g, e), c.firstChild)));
      if (!c.children.length) { tb.remove(); return; }
      tb.innerHTML = "<b>Bu konunun etkinlik ve testleri</b>"; tb.appendChild(c);
    });
    const sar = $("#sarmal");
    liste.filter(b => b.tur === "sarmal").forEach(b => b.testler.forEach((_, ti) => sar.appendChild(cip(g, b, ti, b.baslik.replace(/\s*\(.*$/, "")))));
    if (!sar.children.length) sar.parentNode.remove();
    if (hedef) {
      const el = document.getElementById("k-" + hedef.replace(/\./g, "-"));
      if (el) setTimeout(() => el.scrollIntoView({ block: "start" }), 30);
    }
  }).catch(() => goster(`<a class="geri" href="#/${g}/konu">← Üniteler</a><p class="bos">Bu ünitenin konu anlatımı açılamadı. İnternet bağlantını kontrol edip yeniden dene.</p>`));
}

/* ================= etkinlikler ================= */
const etkVeri = {};
function etkYukle(g) {
  if (etkVeri[g]) return Promise.resolve(etkVeri[g]);
  return fetch("veri/etk" + g + ".json").then(r => { if (!r.ok) throw 0; return r.json(); }).then(d => (etkVeri[g] = d));
}
/* "1.1.2" → "1.1.2-3"; "1.2.3-A" → "1.2.3-A" */
function etkBul(liste, kod) {
  return (liste || []).filter(e => e.kod === kod || (e.kod.startsWith(kod + "-") && /^\d$/.test(e.kod.slice(kod.length + 1))));
}
function etkUnite(e) { return e.kod.slice(0, 3); }
function etkCip(g, e) {
  const a = document.createElement("a");
  const bitti = (depo.al("etk", {})[g + "|" + e.kod] || []).length;
  a.className = "cip" + (bitti ? " cozuldu" : "");
  a.dataset.sv = "Etkinlik";
  a.href = "#/" + g + "/etk/" + encodeURIComponent(e.kod);
  a.innerHTML = '<span class="nokta"></span>Etkinlikler, ' + e.etkinlikler.length + (bitti ? " <em>" + bitti + "/" + e.etkinlikler.length + "</em>" : "");
  return a;
}

function etkinlikListesi(g) {
  baslik(g + ". sınıf etkinlikler");
  etkYukle(g).then(liste => {
    let h = `<a class="geri" href="#/">← Ana sayfa</a><h1>${g}. sınıf etkinlikler</h1>
      <p class="alt">SHERCAN etkinlik kitabının bütün etkinlikleri. Cevabını yaz ya da seç, sonra kontrol et.</p>`;
    let sonU = null;
    liste.forEach(e => {
      const u = etkUnite(e);
      if (u !== sonU) {
        if (sonU !== null) h += "</div>";
        h += `<div class="tema"><h2>${u} ${UNITE[g][u] ? UNITE[g][u].ad : ""}</h2>`;
        sonU = u;
      }
      const bitti = (depo.al("etk", {})[g + "|" + e.kod] || []).length;
      h += `<a class="unite" href="#/${g}/etk/${encodeURIComponent(e.kod)}"><span class="kod">${e.kod.replace(/^\d\.\d\./, "")}</span>
        <div style="flex:1"><b>${e.ad}</b><span>${e.etkinlikler.length} etkinlik${bitti ? ", " + bitti + " tamamlandı" : ""}</span></div><span class="ok">›</span></a>`;
    });
    goster(h + "</div>");
  }).catch(hata);
}

const ETK_AD = { dy: "Doğru mu, yanlış mı?", es: "Eşleştirme", bo: "Boşluk doldurma", au: "Açık uçlu", kh: "Kavram haritası", ta: "Tablo tamamlama" };
const sade = s => String(s || "").replace(/<[^>]+>/g, "").toLocaleLowerCase("tr").replace(/[^\p{L}\p{N}+−-]/gu, "");
function benzer(girilen, cevap) {
  const g = sade(girilen); if (!g) return false;
  const secenek = String(cevap).replace(/^örn[.:]?\s*/i, "").split(/\s*(?:\/|;|,| veya | ya da )\s*/).map(sade).filter(Boolean);
  return secenek.some(c => c === g || (g.length >= 4 && (c.includes(g) || g.includes(c))));
}

function etkinlikSayfasi(g, kod) {
  etkYukle(g).then(liste => {
    const e = liste.find(x => x.kod === kod);
    if (!e) return etkinlikListesi(g);
    baslik(e.ad + ", etkinlikler");
    const i = liste.indexOf(e);
    const u = etkUnite(e);
    const onceki = liste[i - 1], sonraki = liste[i + 1];
    goster(`<a class="geri" href="#/${g}/etkinlik">← Etkinlikler</a>
      <h1>${e.ad}</h1><p class="alt">${kod}. ${e.amac}.</p>
      <a class="dugme ikincil" href="#/${g}/konu/${u}?k=${kod.replace(/-\d$/, "")}" style="margin:-4px 0 22px">Konu anlatımını aç</a>
      <div id="etk-liste"></div>
      ${sonraki ? `<a class="dugme" href="#/${g}/etk/${encodeURIComponent(sonraki.kod)}">Sonraki konu: ${sonraki.ad}</a>` : ""}
      ${onceki ? `<a class="dugme ikincil" href="#/${g}/etk/${encodeURIComponent(onceki.kod)}">Önceki konu: ${onceki.ad}</a>` : ""}`);
    const kap = $("#etk-liste");
    e.etkinlikler.forEach(et => kap.appendChild(etkinlikCiz(g, e, et)));
  }).catch(hata);
}

function etkTamam(g, kod, no) {
  const d = depo.al("etk", {}); const k = g + "|" + kod;
  d[k] = d[k] || []; if (!d[k].includes(no)) d[k].push(no); depo.koy("etk", d);
}

function etkinlikCiz(g, e, et) {
  const kart = document.createElement("section");
  kart.className = "etk kart";
  const c = et.cevap || {};
  let govde = "";
  if (et.tur === "dy") {
    govde = et.maddeler.map(m => `<div class="dy" data-h="${m.h}"><p><b>${m.h})</b> ${m.t}</p>
      <div class="dy-sec" role="group" aria-label="${m.h} şıkkı"><button data-v="1">Doğru</button><button data-v="0">Yanlış</button></div>
      <p class="etk-cevap gizli"></p></div>`).join("");
  } else if (et.tur === "es") {
    const ops = '<option value="">Seç</option>' + et.sag.map(s => `<option value="${s.h}">${s.h}) ${s.t.replace(/<[^>]+>/g, "")}</option>`).join("");
    govde = `<ul class="es-sag">${et.sag.map(s => `<li><b>${s.h})</b> ${s.t}</li>`).join("")}</ul>` +
      et.sol.map(s => `<div class="es" data-n="${s.n}"><p><b>${s.n}.</b> ${s.t}</p><select aria-label="${s.n}. maddenin karşılığı">${ops}</select><p class="etk-cevap gizli"></p></div>`).join("");
  } else if (et.tur === "bo") {
    const kel = et.kelimeler || [];
    const sec = n => kel.length
      ? `<select class="bos" data-n="${n}" aria-label="${n}. boşluk"><option value="">(${n})</option>${kel.map(k => `<option>${k.replace(/<[^>]+>/g, "")}</option>`).join("")}</select>`
      : `<input class="bos" data-n="${n}" aria-label="${n}. boşluk" placeholder="(${n})">`;
    govde = (kel.length ? `<p class="kelimeler">${kel.map(k => `<span>${k}</span>`).join("")}</p>` : "") +
      et.cumleler.map(s => `<p class="bo">${s.replace(/\((\d+)\)\s*_+/g, (_, n) => sec(n))}</p>`).join("");
  } else if (et.tur === "au") {
    govde = et.sorular.map((s, k) => `<div class="au"><p><b>${k + 1}.</b> ${s}</p><textarea rows="3" aria-label="${k + 1}. sorunun cevabı"></textarea>
      <p class="etk-cevap gizli"><b>Örnek cevap:</b> ${c[k + 1] || ""}</p></div>`).join("");
  } else if (et.tur === "kh") {
    govde = `<figure class="kh"><img src="${et.gorsel}" alt="Kavram haritası, numaralı boş kutularla"></figure>` +
      (et.bos || []).map(n => `<label class="kh-bos"><span>(${n})</span><input data-n="${n}"></label>`).join("");
  } else if (et.tur === "ta") {
    govde = `<div class="tablo-sar"><table>${et.tablo.map((r, ri) => "<tr>" + r.map(h => {
      const m = /^\((\d+)\)$/.exec(h || "");
      if (ri === 0) return `<th>${h || ""}</th>`;
      return m ? `<td><input data-n="${m[1]}" aria-label="(${m[1]}) boşluğu" placeholder="(${m[1]})"></td>` : `<td>${h || ""}</td>`;
    }).join("") + "</tr>").join("")}</table></div>`;
  }
  kart.innerHTML = `<h2><span class="k">Etkinlik ${et.no}</span>${ETK_AD[et.tur] || ""}</h2>
    ${et.yonerge ? `<p class="yonerge">${et.yonerge.replace(/Yanlış bulduğunuz.*$/, "")}</p>` : ""}
    <div class="etk-govde">${govde}</div>
    <p class="etk-sonuc gizli" role="status"></p>
    <div class="etk-dugmeler">${et.tur === "au" ? `<button class="dugme vurgu kontrol">Örnek cevapları göster</button>` : `<button class="dugme vurgu kontrol">Kontrol et</button>`}
    <button class="dugme ikincil sifirla">Temizle</button></div>`;

  kart.addEventListener("click", ev => {
    const b = ev.target.closest(".dy-sec button");
    if (b) { b.parentNode.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b)); }
  });
  kart.querySelector(".sifirla").addEventListener("click", () => {
    kart.replaceWith(etkinlikCiz(g, e, et));
  });
  kart.querySelector(".kontrol").addEventListener("click", () => {
    let dogru = 0, top = 0;
    const isaret = (el, ok, metin) => {
      top++; if (ok) dogru++;
      const cv = el.querySelector(".etk-cevap") || el;
      el.classList.remove("ok", "hata"); el.classList.add(ok ? "ok" : "hata");
      if (cv.classList && cv.classList.contains("etk-cevap")) { cv.innerHTML = metin; cv.classList.remove("gizli"); }
    };
    if (et.tur === "dy") kart.querySelectorAll(".dy").forEach(d => {
      const h = d.dataset.h, cv = c[h] || {}, s = d.querySelector('[aria-pressed="true"]');
      const ok = s && (s.dataset.v === "1") === cv.d;
      isaret(d, ok, `<b>${cv.d ? "Doğru" : "Yanlış"}.</b> ${cv.a || ""}`);
    });
    if (et.tur === "es") kart.querySelectorAll(".es").forEach(d => {
      const n = d.dataset.n, v = d.querySelector("select").value, dc = c[n];
      const sag = et.sag.find(s => s.h === dc);
      isaret(d, v === dc, `<b>Cevap: ${dc})</b> ${sag ? sag.t : ""}`);
    });
    if (et.tur === "bo") kart.querySelectorAll(".bos").forEach(el => {
      const n = el.dataset.n, ok = benzer(el.value, c[n]);
      top++; if (ok) dogru++;
      el.classList.remove("ok", "hata"); el.classList.add(ok ? "ok" : "hata");
      let ip = el.nextElementSibling;
      if (!ip || !ip.classList.contains("ipucu")) { ip = document.createElement("span"); ip.className = "ipucu"; el.after(ip); }
      ip.innerHTML = ok ? "✓" : "→ " + (c[n] || "");
    });
    if (et.tur === "kh" || et.tur === "ta") kart.querySelectorAll("input[data-n]").forEach(el => {
      const n = el.dataset.n, ok = benzer(el.value, c[n]);
      top++; if (ok) dogru++;
      el.classList.remove("ok", "hata"); el.classList.add(ok ? "ok" : "hata");
      let ip = el.parentNode.querySelector(".ipucu");
      if (!ip) { ip = document.createElement("span"); ip.className = "ipucu"; el.after(ip); }
      ip.innerHTML = (ok ? "✓ " : "Cevap: ") + (c[n] || "");
    });
    if (et.tur === "au") kart.querySelectorAll(".etk-cevap").forEach(x => x.classList.remove("gizli"));
    const s = kart.querySelector(".etk-sonuc");
    if (et.tur !== "au") {
      s.textContent = dogru === top ? `Hepsi doğru: ${dogru}/${top}.` : `${top} maddeden ${dogru} tanesi doğru. Yanlışların altında doğru cevap yazıyor.`;
      if (et.tur === "kh" || et.tur === "ta" || (et.tur === "bo" && !(et.kelimeler || []).length)) s.textContent += " Yazdığın cevabı kendi ifadenle de kurmuş olabilirsin; anlamı aynıysa doğru say.";
      s.classList.remove("gizli");
    }
    etkTamam(g, e.kod, et.no);
  });
  return kart;
}

/* ================= yazılıya hazırlık ================= */
const yaziliVeri = {};
function yaziliYukle(g) {
  if (yaziliVeri[g]) return Promise.resolve(yaziliVeri[g]);
  return fetch("veri/yazili" + g + ".json").then(r => { if (!r.ok) throw 0; return r.json(); }).then(d => (yaziliVeri[g] = d));
}

/* Hangi yazılıların öğrenciye açık olduğu veri/ayar.json'dan okunur ("dönem-yazılı", ör. "1-1"). */
let ayarSoz = null;
function ayarYukle() {
  if (!ayarSoz) ayarSoz = fetch("veri/ayar.json", { cache: "no-store" }).then(r => r.ok ? r.json() : {}).catch(() => ({}))
    .then(a => { a.yazili = a.yazili || {}; a.yazili.aktif = a.yazili.aktif || ["1-1"]; return a; });
  return ayarSoz;
}

function yaziliSayfasi(g, id) {
  baslik(g + ". sınıf yazılıya hazırlık");
  Promise.all([yaziliYukle(g), ayarYukle()]).then(([d, ayar]) => {
    const tumu = d.sinavlar;
    const acik = x => ayar.yazili.aktif.includes(`${x.donem}-${x.yazili}`);
    const sinavlar = tumu.filter(acik);
    if (!sinavlar.length) { goster(`<a class="geri" href="#/">← Ana sayfa</a><h1>Yazılıya hazırlık</h1><p class="bos">Yazılı sınavları sınav zamanı yaklaşınca burada açılacak.</p>`); return; }
    let e = sinavlar.find(x => x.id === id);
    if (!e) e = sinavlar.find(x => x.id === depo.al("yazili" + g, "")) || sinavlar[0];
    depo.koy("yazili" + g, e.id);
    const donemler = [1, 2];
    const yazililar = [...new Set(tumu.filter(x => x.donem === e.donem).map(x => x.yazili))];
    const sen = sinavlar.filter(x => x.donem === e.donem && x.yazili === e.yazili);
    const ad = `${g}-sinif-${e.donem}-donem-${e.yazili}-yazili-senaryo-${e.senaryo}`;
    const sorular = e.sorular.map((q, i) => `
      <section class="ysoru">
        <div class="ysbas"><span class="no">${i + 1}</span><b>Soru ${i + 1}</b><span class="yk">${q.kazanim}</span><span class="yp">${q.puan} puan</span></div>
        <div class="ybaglam">${tabloSar(q.baglam)}</div>
        ${q.maddeler.map(m => `<div class="ymadde"><b>${m.h})</b><div>${m.s}</div><span class="yp">${m.p} p</span>
          <div class="ycevap gizli"><b>Cevap:</b> ${m.c}</div></div>`).join("")}
        <button class="dugme ikincil ycevap-dugme" aria-expanded="false">Cevabı göster</button>
      </section>`).join("");
    goster(`<a class="geri" href="#/">← Ana sayfa</a>
      <h1>${g}. sınıf yazılıya hazırlık</h1>
      <p class="alt">Ortak yazılı sınav senaryolarına göre hazırlandı. Dönemi, yazılıyı ve senaryoyu seç; soruları çöz, sonra cevaplara bak.</p>
      <div class="ysecim">
        <div class="ysatir"><span>Dönem</span><div class="cipler">${donemler.map(d => {
          const ilk = sinavlar.find(x => x.donem === d);
          return ilk ? `<a class="cip${d === e.donem ? " secili" : ""}" href="#/${g}/yazili/${ilk.id}">${d}. Dönem</a>`
            : `<span class="cip pasif" title="Sınav zamanı açılacak">${d}. Dönem</span>`;
        }).join("")}</div></div>
        <div class="ysatir"><span>Yazılı</span><div class="cipler">${yazililar.map(y => {
          const ilk = sinavlar.find(x => x.donem === e.donem && x.yazili === y);
          return ilk ? `<a class="cip${y === e.yazili ? " secili" : ""}" href="#/${g}/yazili/${ilk.id}">${y}. Yazılı</a>`
            : `<span class="cip pasif" title="Sınav zamanı açılacak">${y}. Yazılı · yakında</span>`;
        }).join("")}</div></div>
        <div class="ysatir"><span>Senaryo</span><div class="cipler">${sen.map(x =>
          `<a class="cip${x.id === e.id ? " secili" : ""}" href="#/${g}/yazili/${x.id}">${x.senaryo}</a>`).join("")}</div></div>
      </div>
      <article class="ykagit">
        <header class="ykbas">
          <b>${g}. Sınıf Kimya · ${e.donem}. Dönem ${e.yazili}. Ortak Yazılı</b>
          <span>Senaryo ${e.senaryo} · ${e.sorular.length} soru · 100 puan · ${e.sure} dakika</span>
        </header>
        <div class="yindir">
          <a class="dugme" href="pdf/${g}/${ad}.pdf" download="${ad}.pdf">Sınav kâğıdını indir (PDF)</a>
          <a class="dugme ikincil" href="pdf/${g}/${ad}-cevap-anahtari.pdf" download="${ad}-cevap-anahtari.pdf">Cevap anahtarını indir (PDF)</a>
        </div>
        ${sorular}
        <button class="dugme vurgu" id="yhepsi">Bütün cevapları göster</button>
      </article>`);
    ekran.querySelectorAll(".ycevap-dugme").forEach(b => b.addEventListener("click", () => {
      const ac = b.getAttribute("aria-expanded") !== "true";
      b.closest(".ysoru").querySelectorAll(".ycevap").forEach(c => c.classList.toggle("gizli", !ac));
      b.setAttribute("aria-expanded", ac); b.textContent = ac ? "Cevabı gizle" : "Cevabı göster";
    }));
    $("#yhepsi").addEventListener("click", () => {
      const ac = ekran.querySelector(".ycevap.gizli") !== null;
      ekran.querySelectorAll(".ycevap").forEach(c => c.classList.toggle("gizli", !ac));
      ekran.querySelectorAll(".ycevap-dugme").forEach(b => { b.setAttribute("aria-expanded", ac); b.textContent = ac ? "Cevabı gizle" : "Cevabı göster"; });
      $("#yhepsi").textContent = ac ? "Bütün cevapları gizle" : "Bütün cevapları göster";
    });
  }).catch(() => goster(`<a class="geri" href="#/">← Ana sayfa</a><h1>Yazılıya hazırlık</h1><p class="bos">Bu sınıfın yazılı sınavları henüz eklenmedi.</p>`));
}

/* ================= yönlendirme ================= */
function yonlendir() {
  const [yol, sorgu] = location.hash.replace(/^#\/?/, "").split("?");
  const p = yol.split("/").filter(Boolean);
  const k = new URLSearchParams(sorgu || "").get("k");
  if (p[0] && SINIFLAR.includes(+p[0]) && +p[0] !== sinif) { sinif = +p[0]; depo.koy("sinif", sinif); }
  sinifCubugu();
  const g = sinif;
  if (!p.length) return anaSayfa();
  switch (p[1]) {
    case "testler": return testlerSayfasi(g);
    case "u": return uniteSayfasi(g, p[2]);
    case "karma": return karmaSayfasi(g);
    case "t": return testBaslat(g, p[2], p[3] || 0);
    case "konu": return p[2] ? konuSayfasi(g, p[2], k) : konuListesi(g);
    case "yanlis": return yanlisSayfasi(g);
    case "etkinlik": return etkinlikListesi(g);
    case "yazili": return yaziliSayfasi(g, p[2]);
    case "etk": return etkinlikSayfasi(g, decodeURIComponent(p[2] || ""));
    default: return anaSayfa();
  }
}
window.addEventListener("hashchange", yonlendir);

/* ================= açılış ================= */
(function () {
  const a = $("#acilis");
  const kapat = () => { a.classList.add("kapan"); setTimeout(() => a.remove(), 550); };
  const ilkKez = !depo.al("gordu", false);
  const az = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (az || (!ilkKez && sessionStorage.getItem("shr_acildi"))) { a.remove(); return; }
  try { sessionStorage.setItem("shr_acildi", "1"); } catch (e) {}
  depo.koy("gordu", true);
  a.addEventListener("click", kapat);
  setTimeout(kapat, ilkKez ? 1700 : 900);
})();

/* ================= akıllı tahta: büyük ekranda büyüt ================= */
function olcek() {
  const w = innerWidth, h = innerHeight;
  let z = 1;
  if (w >= 1000 && h >= 600) z = Math.max(1, Math.min(w * 0.8 / 640, h / 760, 2.2));
  document.body.style.zoom = z === 1 ? "" : z.toFixed(2);
}
addEventListener("resize", olcek);
olcek();

/* ================= kurulum ve çevrimdışı ================= */
let kurOlayi = null;
addEventListener("beforeinstallprompt", e => {
  e.preventDefault(); kurOlayi = e;
  if (!depo.al("kurma", false)) $("#kur").classList.remove("gizli");
});
$("#kur-evet").addEventListener("click", async () => {
  $("#kur").classList.add("gizli");
  if (kurOlayi) { kurOlayi.prompt(); kurOlayi = null; }
});
$("#kur-hayir").addEventListener("click", () => { $("#kur").classList.add("gizli"); depo.koy("kurma", true); });
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

yonlendir();
})();
