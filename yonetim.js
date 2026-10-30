/* SHERCAN Kimya — gizli yönetim paneli.
   Değişiklikler, öğretmenin kendi GitHub anahtarıyla doğrudan depolara kaydedilir.
   Site deposu: shercan-kimya (herkese açık). Kaynak deposu: shercan-kaynak (gizli; yazılı soruları, senaryolar, bütün PDF'ler). */
"use strict";
const SAHIP = "Shercan21", SITE = "shercan-kimya", KAYNAK = "shercan-kaynak", API = "https://api.github.com";
const SINIFLAR = [9, 10, 11];
const $ = (s, k = document) => k.querySelector(s);
const $$ = (s, k = document) => [...k.querySelectorAll(s)];
const ekran = $("#ekran");
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const metinOzet = (html, n = 140) => { const d = document.createElement("div"); d.innerHTML = String(html || "").replace(/<\/(td|th|tr|p|li|div)>/g, " $&"); const t = d.textContent.replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n) + "…" : t; };
const kopya = x => JSON.parse(JSON.stringify(x));
const depo = {
  al(k) { try { return localStorage.getItem("shr_yon_" + k); } catch { return null; } },
  koy(k, v) { try { v == null ? localStorage.removeItem("shr_yon_" + k) : localStorage.setItem("shr_yon_" + k, v); } catch {} },
};
let anahtar = depo.al("anahtar");
let kirli = false;          /* kaydedilmemiş değişiklik var mı */
window.addEventListener("beforeunload", e => { if (kirli) { e.preventDefault(); e.returnValue = ""; } });

/* ---------------- durum bildirimi ---------------- */
let durumZaman;
function durum(mesaj, tur = "", sure = 0) {
  const d = $("#durum");
  clearTimeout(durumZaman);
  d.className = "yon-durum " + tur;
  d.textContent = mesaj;
  if (sure) durumZaman = setTimeout(() => d.classList.add("gizli"), sure);
}
const durumKapat = () => $("#durum").classList.add("gizli");

/* ---------------- GitHub API ---------------- */
async function gh(yol, { method = "GET", body, ham } = {}) {
  const r = await fetch(API + yol, {
    method, cache: "no-store",
    headers: {
      Authorization: "Bearer " + anahtar,
      Accept: ham ? "application/vnd.github.raw+json" : "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) {
    let m = "";
    try { m = (await r.json()).message; } catch {}
    const h = new Error(r.status + (m ? " · " + m : ""));
    h.durum = r.status;
    throw h;
  }
  if (r.status === 204) return null;
  return ham ? r.text() : r.json();
}
const oku = (repo, yol) => gh(`/repos/${SAHIP}/${repo}/contents/${yol.split("/").map(encodeURIComponent).join("/")}?ref=main`, { ham: true });
const okuJSON = async (repo, yol) => JSON.parse(await oku(repo, yol));
const agac = repo => gh(`/repos/${SAHIP}/${repo}/git/trees/main?recursive=1`).then(d => d.tree);

/* Birden çok dosyayı tek bir kayıtla (commit) yazar.
   degisiklik: {yol, metin} | {yol, kaynakSha} (gizli depodaki dosyayı kopyalar) | {yol, sil:true} */
async function commitle(repo, degisiklikler, mesaj, ilerleme = () => {}) {
  const ref = await gh(`/repos/${SAHIP}/${repo}/git/ref/heads/main`);
  const ust = ref.object.sha;
  const ustKayit = await gh(`/repos/${SAHIP}/${repo}/git/commits/${ust}`);
  const girdiler = [];
  let i = 0;
  const isle = async d => {
    if (d.sil) { girdiler.push({ path: d.yol, mode: "100644", type: "blob", sha: null }); return; }
    let blob;
    if (d.kaynakSha) {
      const b = await gh(`/repos/${SAHIP}/${KAYNAK}/git/blobs/${d.kaynakSha}`);
      blob = await gh(`/repos/${SAHIP}/${repo}/git/blobs`, { method: "POST", body: { content: b.content.replace(/\n/g, ""), encoding: "base64" } });
    } else if (d.b64) {
      blob = await gh(`/repos/${SAHIP}/${repo}/git/blobs`, { method: "POST", body: { content: d.b64, encoding: "base64" } });
    } else {
      blob = await gh(`/repos/${SAHIP}/${repo}/git/blobs`, { method: "POST", body: { content: d.metin, encoding: "utf-8" } });
    }
    girdiler.push({ path: d.yol, mode: "100644", type: "blob", sha: blob.sha });
    ilerleme(++i, degisiklikler.length);
  };
  /* aynı anda en çok 4 dosya */
  const kuyruk = [...degisiklikler];
  await Promise.all(Array.from({ length: 4 }, async () => { while (kuyruk.length) await isle(kuyruk.shift()); }));
  if (!girdiler.length) return ust;
  const yeniAgac = await gh(`/repos/${SAHIP}/${repo}/git/trees`, { method: "POST", body: { base_tree: ustKayit.tree.sha, tree: girdiler } });
  const kayit = await gh(`/repos/${SAHIP}/${repo}/git/commits`, { method: "POST", body: { message: mesaj, tree: yeniAgac.sha, parents: [ust] } });
  await gh(`/repos/${SAHIP}/${repo}/git/refs/heads/main`, { method: "PATCH", body: { sha: kayit.sha } });
  return kayit.sha;
}

/* Gizli depoda soru/senaryo değişince GitHub sınavları ve PDF'leri yeniden üretir; bitmesini bekler. */
async function uretimiBekle(sha) {
  const bas = Date.now();
  while (Date.now() - bas < 20 * 60 * 1000) {
    await new Promise(r => setTimeout(r, 8000));
    let d;
    try { d = await gh(`/repos/${SAHIP}/${KAYNAK}/actions/runs?head_sha=${sha}&per_page=5`); }
    catch (h) {
      if (h.durum === 403) throw new Error("Anahtarınızda “Actions: Read-only” izni yok. Anahtarı bu izinle yeniden oluşturun.");
      throw h;
    }
    const run = d.workflow_runs[0];
    const dk = Math.round((Date.now() - bas) / 60000);
    if (!run) { durum(`Sınavlar ve PDF'ler hazırlanıyor… (${dk} dk)`); continue; }
    if (run.status !== "completed") { durum(`Sınavlar ve PDF'ler hazırlanıyor… (${dk} dk, genelde 2–4 dk sürer)`); continue; }
    if (run.conclusion !== "success") throw new Error("PDF üretimi başarısız oldu. Ayrıntı: " + run.html_url);
    return;
  }
  throw new Error("PDF üretimi 20 dakikada bitmedi. Biraz sonra Yazılılar sekmesinden yeniden yayınlayın.");
}

/* Açık yazılıların sınavlarını ve PDF'lerini gizli depodan siteye taşır, kapalıları siteden kaldırır. */
async function yayinla(aktif) {
  durum("Yayın hazırlanıyor…");
  let ayar = {};
  try { ayar = await okuJSON(SITE, "veri/ayar.json"); } catch {}
  ayar.yazili = { ...(ayar.yazili || {}), aktif };
  const deg = [{ yol: "veri/ayar.json", metin: JSON.stringify(ayar, null, 2) + "\n" }];
  const acik = e => aktif.includes(`${e.donem}-${e.yazili}`);
  for (const g of SINIFLAR) {
    const tam = await okuJSON(KAYNAK, `cikti/veri/yazili${g}.json`);
    tam.sinavlar = tam.sinavlar.filter(acik);
    deg.push({ yol: `veri/yazili${g}.json`, metin: JSON.stringify(tam) });
  }
  const [ka, si] = await Promise.all([agac(KAYNAK), agac(SITE)]);
  const sitePdf = new Map(si.filter(x => x.type === "blob" && /^pdf\/.+\.pdf$/.test(x.path)).map(x => [x.path, x.sha]));
  const istenen = new Set();
  for (const f of ka) {
    if (f.type !== "blob" || !/^cikti\/pdf\/.+\.pdf$/.test(f.path)) continue;
    const yol = f.path.replace(/^cikti\//, "");
    const m = yol.split("/").pop().match(/^\d+-sinif-(\d+)-donem-(\d+)-yazili/);
    if (!m || !aktif.includes(m[1] + "-" + m[2])) continue;
    istenen.add(yol);
    if (sitePdf.get(yol) !== f.sha) deg.push({ yol, kaynakSha: f.sha });
  }
  for (const yol of sitePdf.keys()) if (!istenen.has(yol)) deg.push({ yol, sil: true });
  await commitle(SITE, deg, "Yazılı yayını: " + (aktif.join(", ") || "hiçbiri"),
    (i, n) => durum(`Siteye gönderiliyor… ${i}/${n}`));
}

async function aktifYazililar() {
  try { return (await okuJSON(SITE, "veri/ayar.json")).yazili?.aktif || []; } catch { return []; }
}

/* Gizli depoya kaydet → PDF üretimini bekle → açık yazılıları yeniden yayınla */
async function kaynagaKaydetVeYayinla(degisiklikler, mesaj) {
  durum("Kaydediliyor…");
  const sha = await commitle(KAYNAK, degisiklikler, mesaj);
  await uretimiBekle(sha);
  await yayinla(await aktifYazililar());
}

/* ---------------- resimler ----------------
   Site resimleri shercan-kimya/img/yukle/ altına, yazılı resimleri gizli depoda resim/ altına yüklenir.
   Yazılı resimleri sınav üretilirken soruların içine gömülür; yazılı açılmadan sitede görünmez. */
const resimOnbellek = {};   /* yol -> data: adresi (önizleme için) */
function dosyaSec() {
  return new Promise(r => { const i = document.createElement("input"); i.type = "file"; i.accept = "image/*"; i.onchange = () => r(i.files[0] || null); i.click(); });
}
async function resimKucult(dosya, enBuyuk = 1400) {
  if (dosya.type === "image/svg+xml") return { blob: dosya, uzanti: "svg" };
  const bm = await createImageBitmap(dosya);
  const o = Math.min(1, enBuyuk / bm.width);
  const c = document.createElement("canvas");
  c.width = Math.round(bm.width * o); c.height = Math.round(bm.height * o);
  c.getContext("2d").drawImage(bm, 0, 0, c.width, c.height);
  let blob = await new Promise(r => c.toBlob(r, "image/webp", 0.86));
  if (!blob || blob.type !== "image/webp") blob = await new Promise(r => c.toBlob(r, "image/png"));
  return { blob, uzanti: blob.type === "image/webp" ? "webp" : "png" };
}
const blobB64 = b => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); });
async function resimYukle(gizli, klasor) {
  const dosya = await dosyaSec();
  if (!dosya) return null;
  if (dosya.size > 15e6) { alert("Resim çok büyük (en çok 15 MB)."); return null; }
  durum("Resim yükleniyor…");
  try {
    const { blob, uzanti } = await resimKucult(dosya);
    const veriUrl = await blobB64(blob);
    const ad = dosya.name.replace(/\.[^.]+$/, "").toLocaleLowerCase("tr").replace(/[^a-z0-9ğüşöçı]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "resim";
    const yol = `${klasor}/${Date.now().toString(36)}-${ad}.${uzanti}`;
    await commitle(gizli ? KAYNAK : SITE, [{ yol, b64: veriUrl.split(",")[1] }], "Resim eklendi: " + yol);
    resimOnbellek[yol] = veriUrl;
    durum("Resim yüklendi.", "tamam", 3000);
    return yol;
  } catch (h) { durum("Resim yüklenemedi: " + h.message, "hata"); return null; }
}
function imleceEkle(alan, metin) {
  const b = alan.selectionStart ?? alan.value.length, s = alan.selectionEnd ?? b;
  alan.value = alan.value.slice(0, b) + metin + alan.value.slice(s);
  alan.selectionStart = alan.selectionEnd = b + metin.length;
  alan.dispatchEvent(new Event("input", { bubbles: true }));
  alan.focus();
}
/* Metin kutusunun altına "Resim ekle" düğmesi koyar; seçilen resmi yükleyip <img> etiketini imlecin olduğu yere yazar */
function resimDugmesi(alan, gizli, klasor, kalip = y => `<img src="${y}" alt="">`) {
  const d = document.createElement("button");
  d.type = "button"; d.className = "dugme ikincil kucuk yon-resim"; d.textContent = "🖼 Resim ekle";
  d.addEventListener("click", async () => { const y = await resimYukle(gizli, klasor); if (y) imleceEkle(alan, kalip(y)); });
  alan.after(d);
  return d;
}
/* Önizlemede, yeni yüklenen ya da gizli depodaki resimleri göster */
async function gizliResimAl(yol) {
  if (resimOnbellek[yol]) return;
  resimOnbellek[yol] = "";
  try {
    const r = await fetch(`${API}/repos/${SAHIP}/${KAYNAK}/contents/${yol}?ref=main`, { cache: "no-store", headers: { Authorization: "Bearer " + anahtar, Accept: "application/vnd.github.raw+json" } });
    if (r.ok) resimOnbellek[yol] = await blobB64(await r.blob());
  } catch {}
}
function resimCoz(html, gizli) {
  return String(html).replace(/src="([^"]+)"/g, (t, y) => {
    if (resimOnbellek[y]) return `src="${resimOnbellek[y]}"`;
    return t;
  });
}

/* ---------------- ortak parçalar ---------------- */
async function islem(dugme, is, basari = "Kaydedildi. Sitede 1–2 dakika içinde görünür.") {
  if (dugme) dugme.disabled = true;
  try { await is(); kirli = false; durum(basari, "tamam", 7000); return true; }
  catch (h) { console.error(h); durum("Olmadı: " + (h.message || h), "hata"); return false; }
  finally { if (dugme) dugme.disabled = false; }
}
function sinifSecici(secili, ad = "sinif") {
  return `<select class="dar" id="${ad}">${SINIFLAR.map(g => `<option value="${g}"${g === secili ? " selected" : ""}>${g}. sınıf</option>`).join("")}</select>`;
}
function kaydetCubugu(metin = "Kaydedilmemiş değişiklikler var.") {
  return `<div class="yon-kaydet gizli" id="kaydetcubuk"><span>${metin}</span><button class="dugme vurgu" id="kaydet">Kaydet ve yayınla</button></div>`;
}
function degisti() { kirli = true; $("#kaydetcubuk")?.classList.remove("gizli"); }
const yukleniyor = () => { ekran.innerHTML = `<p class="bos">Yükleniyor…</p>`; };
function hataGoster(h) { ekran.innerHTML = `<div class="yon-kutu"><b>Yüklenemedi.</b><p>${esc(h.message || h)}</p></div>`; }
function onizle(alan, kutu, sarmala = x => x, gizli = false) {
  const g = () => {
    kutu.innerHTML = resimCoz(sarmala(alan.value), gizli);
    if (gizli) {
      const eksik = [...alan.value.matchAll(/src="(resim\/[^"]+)"/g)].map(m => m[1]).filter(y => resimOnbellek[y] === undefined);
      if (eksik.length) Promise.all(eksik.map(gizliResimAl)).then(g);
    }
  };
  alan.addEventListener("input", g); g();
}
function otomatikBoy(t) { const f = () => { t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight + 4, 640) + "px"; }; t.addEventListener("input", f); requestAnimationFrame(f); }
function sinifDegisince(sel, rota) { sel.addEventListener("change", () => { if (kirli && !confirm("Kaydedilmemiş değişiklikler silinsin mi?")) { sel.value = sel.dataset.eski; return; } kirli = false; location.hash = rota(sel.value); }); sel.dataset.eski = sel.value; }

/* ---------------- giriş ---------------- */
function girisSayfasi(hata) {
  $("#sekme").classList.add("gizli");
  ekran.innerHTML = `
    <h1>Yönetim girişi</h1>
    <p class="alt">Bu sayfa yalnız sizin içindir. Değişiklikleri kaydetmek için GitHub anahtarınız gerekir; anahtar yalnız bu tarayıcıda saklanır.</p>
    ${hata ? `<div class="yon-kutu" style="border-color:var(--oksijen)"><b>Anahtar kabul edilmedi.</b> ${esc(hata)}</div>` : ""}
    <div class="yon-kutu">
      <label class="alan" for="anahtar">GitHub anahtarı (token)</label>
      <input type="password" id="anahtar" autocomplete="off" placeholder="github_pat_…">
      <div class="yon-arac"><button class="dugme vurgu" id="gir">Giriş yap</button></div>
    </div>
    <h2>Anahtar nasıl oluşturulur? (bir kez)</h2>
    <ol class="yon-adim">
      <li><a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">Bu sayfayı açın</a> (GitHub › Settings › Developer settings › Fine-grained tokens › Generate new token).</li>
      <li><b>Token name:</b> <code>SHERCAN panel</code> · <b>Expiration:</b> 1 yıl.</li>
      <li><b>Repository access:</b> <i>Only select repositories</i> → <code>shercan-kimya</code> ve <code>shercan-kaynak</code>.</li>
      <li><b>Permissions › Repository permissions:</b> <i>Contents</i> → <b>Read and write</b>, <i>Actions</i> → <b>Read-only</b>.</li>
      <li><b>Generate token</b>'a basın, çıkan anahtarı kopyalayıp yukarıya yapıştırın.</li>
    </ol>
    <p class="alt">Anahtarı kimseyle paylaşmayın. Başka bir bilgisayarda panele girerseniz aynı anahtarı orada da yapıştırmanız gerekir.</p>`;
  $("#gir").addEventListener("click", async () => {
    const v = $("#anahtar").value.trim();
    if (!v) return;
    anahtar = v;
    durum("Anahtar kontrol ediliyor…");
    try {
      const [k, s] = await Promise.all([gh(`/repos/${SAHIP}/${KAYNAK}`), gh(`/repos/${SAHIP}/${SITE}`)]);
      if (!k.permissions?.push || !s.permissions?.push) throw new Error("Anahtarın iki depoya da yazma (Contents: Read and write) izni olmalı.");
      depo.koy("anahtar", v);
      durum("Giriş yapıldı.", "tamam", 3000);
      location.hash = "#/yazililar";
      yonlendir();
    } catch (h) { anahtar = null; durumKapat(); girisSayfasi(h.durum === 401 ? "Anahtar geçersiz ya da süresi dolmuş." : h.durum === 404 ? "Anahtarın shercan-kimya ve shercan-kaynak depolarına erişimi yok." : h.message); }
  });
}

/* ---------------- sekmeler ---------------- */
const SEKMELER = [
  ["yazililar", "Yazılı aç/kapat"], ["sorular", "Yazılı soruları"], ["senaryolar", "Senaryolar"],
  ["konu", "Konu anlatımı"], ["testler", "Testler"], ["karma", "Karma testler"], ["etkinlik", "Etkinlikler"], ["cikis", "Çıkış"],
];
function sekmeCiz(aktif) {
  const n = $("#sekme");
  n.classList.remove("gizli");
  n.innerHTML = SEKMELER.map(([k, ad]) => `<a href="#/${k}" class="${k === aktif ? "secili" : ""}">${ad}</a>`).join("");
}

/* ================= 1) Yazılı aç/kapat ================= */
async function yazililarSayfasi() {
  yukleniyor();
  const [aktif, ...tamlar] = await Promise.all([aktifYazililar(), ...SINIFLAR.map(g => okuJSON(KAYNAK, `cikti/veri/yazili${g}.json`))]);
  const grup = new Map();
  tamlar.forEach((d, i) => d.sinavlar.forEach(e => {
    const k = `${e.donem}-${e.yazili}`;
    if (!grup.has(k)) grup.set(k, { donem: e.donem, yazili: e.yazili, say: {} });
    const x = grup.get(k); x.say[SINIFLAR[i]] = (x.say[SINIFLAR[i]] || 0) + 1;
  }));
  const anahtarlar = [...grup.keys()].sort();
  ekran.innerHTML = `
    <h1>Yazılı aç/kapat</h1>
    <p class="alt">Açık olan yazılılar öğrencilere görünür. Kapalı olanların soruları ve PDF'leri sitede hiç bulunmaz; yalnız gizli depoda durur.</p>
    <div class="yon-kutu">${anahtarlar.map(k => {
      const x = grup.get(k);
      return `<div class="yon-anahtar"><div><b>${x.donem}. Dönem ${x.yazili}. Yazılı</b>
        <small>${SINIFLAR.map(g => `${g}. sınıf: ${x.say[g] || 0} senaryo`).join(" · ")}</small></div>
        <label class="yon-dugmecik"><input type="checkbox" data-k="${k}" ${aktif.includes(k) ? "checked" : ""} aria-label="${x.donem}. Dönem ${x.yazili}. Yazılı açık"><span></span></label></div>`;
    }).join("") || `<p>Henüz sınav yok. Önce Senaryolar sekmesinden senaryo ekleyin.</p>`}</div>
    <p class="alt">Yeni bir yazılı (ör. 2. dönem) eklemek için önce <a href="#/senaryolar">Senaryolar</a> sekmesinde senaryolarını girin; burada kendiliğinden çıkar.</p>
    ${kaydetCubugu("Açık/kapalı ayarı değişti.")}`;
  $$("input[data-k]").forEach(c => c.addEventListener("change", degisti));
  $("#kaydet").addEventListener("click", e => islem(e.target, async () => {
    await yayinla($$("input[data-k]:checked").map(c => c.dataset.k));
    $("#kaydetcubuk").classList.add("gizli");
  }));
}

/* ================= 2) Yazılı soruları ================= */
function havuzCoz(metin) {
  const p = metin.split(/^=== /m);
  const bas = p.shift();
  const bloklar = p.map(b => {
    const i = b.indexOf("\n");
    const kaz = (i < 0 ? b : b.slice(0, i)).trim();
    const parca = (i < 0 ? "" : b.slice(i + 1)).split(/^--- /m);
    const baglam = parca.shift().trim();
    const maddeler = parca.map(x => {
      const j = x.indexOf("\n");
      const [h, puan] = x.slice(0, j).trim().split(/\s+/);
      const ic = x.slice(j + 1), k = ic.indexOf(">>>");
      return { h, p: +puan || 1, s: (k < 0 ? ic : ic.slice(0, k)).trim(), c: k < 0 ? "" : ic.slice(k + 3).trim() };
    });
    return { kaz, baglam, maddeler };
  });
  return { bas, bloklar };
}
function havuzYaz({ bas, bloklar }) {
  const temiz = s => String(s).replace(/^(===|---) /gm, "$1 ").replace(/^>>>/gm, " >>>");
  return (bas.trim() ? bas.trimEnd() + "\n\n" : "") + bloklar.map(q =>
    `=== ${q.kaz}\n${temiz(q.baglam)}\n` + q.maddeler.map(m => `--- ${m.h} ${m.p}\n${temiz(m.s)}\n>>>\n${temiz(m.c)}`).join("\n")
  ).join("\n\n") + "\n";
}
function gerekenler(senaryo, g) {
  const ger = {}, ad = {};
  (senaryo[g] || []).forEach(e => e.dagilim.forEach(([tam, n]) => {
    const kod = tam.split(" ")[0].replace(/\.$/, "");
    ger[kod] = (ger[kod] || 0) + n;
    ad[kod] = tam.slice(kod.length + 1).replace(/^[.\s]+/, "").trim();
  }));
  return { ger, ad };
}

async function sorularSayfasi(g, secKaz, acSira) {
  g = +g || 9;
  yukleniyor();
  const [metin, senaryo, uretilen] = await Promise.all([oku(KAYNAK, `yazili/${g}.txt`).catch(h => h.durum === 404 ? "" : Promise.reject(h)), okuJSON(KAYNAK, "senaryo.json"),
    okuJSON(KAYNAK, `cikti/veri/yazili${g}.json`).catch(() => ({ sinavlar: [] }))]);
  const havuz = havuzCoz(metin);
  /* hangi soru hangi senaryoda çıkıyor */
  const imza = h => metinOzet(String(h).replace(/src="data:[^"]+"/g, ""), 120);
  const sinavlar = uretilen.sinavlar.slice().sort((a, b) => (a.donem - b.donem) || (a.yazili - b.yazili) || (a.senaryo - b.senaryo));
  const havuzBul = q => havuz.bloklar.findIndex(b => b.kaz === q.kazanim && imza(b.baglam) === imza(q.baglam));
  const kullanim = {};
  sinavlar.forEach(e => e.sorular.forEach(q => { const i = havuzBul(q); if (i >= 0) (kullanim[i] = kullanim[i] || []).push(`${e.donem}.D ${e.yazili}.Y S${e.senaryo}`); }));
  let gorunum = depo.al("soruGorunum") || "senaryo";
  let sinavId = depo.al("soruSinav" + g);
  if (!sinavlar.some(e => e.id === sinavId)) sinavId = sinavlar[0]?.id;
  const { ger, ad } = gerekenler(senaryo, g);
  const kodlar = () => [...new Set([...Object.keys(ger), ...havuz.bloklar.map(b => b.kaz)])].sort((a, b) => a.localeCompare(b, "tr", { numeric: true }));
  let kaz = secKaz && kodlar().includes(secKaz) ? secKaz : kodlar()[0] || "";

  function senaryoGorunumu() {
    const e = sinavlar.find(x => x.id === sinavId);
    return `
      <div class="yon-arac">${sinifSecici(g)}
        <select id="sinav" style="flex:1;min-width:220px">${sinavlar.map(x => `<option value="${x.id}"${x.id === sinavId ? " selected" : ""}>${x.donem}. Dönem ${x.yazili}. Yazılı · Senaryo ${x.senaryo}</option>`).join("")}</select></div>
      ${e ? `<p class="alt">${e.sorular.length} soru · 100 puan. Değiştirmek istediğiniz sorunun yanındaki “Düzenle”ye basın; kaydedince bu sınav da kendiliğinden güncellenir.</p>
      <div class="yon-liste">${e.sorular.map((q, n) => { const i = havuzBul(q); return `<div class="yon-oge"><span class="no">${n + 1}</span><div class="govde">
        <b>${esc(q.kazanim)}</b> <span class="yon-rozet">${q.puan} puan</span>${i >= 0 && kullanim[i]?.length > 1 ? `<span class="yon-rozet">${kullanim[i].length} senaryoda</span>` : ""}
        <div class="yon-onizle" style="margin-top:6px">${q.baglam}${q.maddeler.map(m => `<p style="margin-top:6px"><b>${esc(m.h)})</b> ${m.s} <small>(${m.p} p)</small></p>`).join("")}</div></div>
        ${i >= 0 ? `<button class="dugme ikincil kucuk" data-duzenle="${i}">Düzenle</button>` : ""}</div>`; }).join("")}</div>`
        : `<p class="bos">Henüz üretilmiş sınav yok.</p>`}
      <div id="duzenleyici"></div>
      ${kaydetCubugu()}`;
  }

  function ciz() {
    const say = {}; havuz.bloklar.forEach(b => say[b.kaz] = (say[b.kaz] || 0) + 1);
    const liste = havuz.bloklar.map((b, i) => ({ b, i })).filter(x => x.b.kaz === kaz);
    ekran.innerHTML = `
      <h1>Yazılı soruları</h1>
      <p class="alt">Her kazanım için en az senaryolarda istenen kadar soru olmalı; yoksa sorular sınavlarda tekrar eder. Kaydedince sınavlar ve PDF'ler yeniden üretilir (2–4 dk).</p>
      <div class="cipler" style="margin-bottom:6px"><button class="cip${gorunum === "senaryo" ? " secili" : ""}" data-gor="senaryo">Senaryoya göre</button><button class="cip${gorunum === "kazanim" ? " secili" : ""}" data-gor="kazanim">Kazanıma göre</button></div>
      ${gorunum === "senaryo" ? senaryoGorunumu() : `
      <div class="yon-arac">${sinifSecici(g)}
        <select id="kaz" style="flex:1;min-width:220px">${kodlar().map(k => {
          const v = say[k] || 0, n = ger[k] || 0;
          return `<option value="${k}"${k === kaz ? " selected" : ""}>${k} — ${v}/${n} soru${v < n ? " ⚠" : ""}</option>`;
        }).join("")}</select>
        <button class="dugme ikincil kucuk" id="yenikaz">Yeni kazanım kodu</button></div>
      ${kaz ? `<p class="alt"><b>${esc(kaz)}</b> ${esc(ad[kaz] || "")}<span class="yon-rozet ${((say[kaz] || 0) < (ger[kaz] || 0)) ? "uyari" : "tamam"}">havuzda ${say[kaz] || 0} · senaryolarda ${ger[kaz] || 0}</span></p>` : ""}
      <div class="yon-liste">${liste.map(({ b, i }, s) => `
        <div class="yon-oge" data-i="${i}"><span class="no">${s + 1}</span>
          <div class="govde"><div class="ozet">${esc(metinOzet(b.baglam))}</div>
            <small>${b.maddeler.map(m => `${esc(m.h)}) ${m.p}p`).join(" · ")} — ${kullanim[i] ? "Çıktığı sınavlar: " + kullanim[i].join(", ") : "henüz hiçbir sınavda yok"}</small></div>
          <button class="dugme ikincil kucuk" data-duzenle="${i}">Düzenle</button>
          <button class="dugme tehlike kucuk" data-sil="${i}">Sil</button></div>`).join("") || `<p class="bos">Bu kazanımda soru yok.</p>`}</div>
      <div class="yon-arac"><button class="dugme" id="yeni">+ Yeni soru</button></div>
      <div id="duzenleyici"></div>
      ${kaydetCubugu()}`}`;
    if (kirli) $("#kaydetcubuk").classList.remove("gizli");
    sinifDegisince($("#sinif"), v => `#/sorular/${v}`);
    $$("[data-gor]").forEach(c => c.addEventListener("click", () => { gorunum = c.dataset.gor; depo.koy("soruGorunum", gorunum); ciz(); }));
    $("#sinav")?.addEventListener("change", e => { sinavId = e.target.value; depo.koy("soruSinav" + g, sinavId); ciz(); });
    $("#kaz")?.addEventListener("change", e => { kaz = e.target.value; ciz(); });
    $("#yenikaz")?.addEventListener("click", () => {
      const k = prompt("Kazanım kodu (ör. KİM.11.2.4):", `KİM.${g}.`);
      if (k && k.trim()) { kaz = k.trim(); ciz(); }
    });
    if (acSira !== undefined && gorunum !== "kazanim") { gorunum = "kazanim"; return ciz(); }
    if (acSira !== undefined) {
      const hedef = havuz.bloklar.map((b, i) => ({ b, i })).filter(x => x.b.kaz === kaz)[+acSira];
      acSira = undefined;
      if (hedef) duzenle(hedef.i);
    }
    $$("[data-sil]").forEach(d => d.addEventListener("click", () => {
      if (!confirm("Bu soru silinsin mi?")) return;
      havuz.bloklar.splice(+d.dataset.sil, 1); degisti(); ciz();
    }));
    $$("[data-duzenle]").forEach(d => d.addEventListener("click", () => duzenle(+d.dataset.duzenle)));
    $("#yeni")?.addEventListener("click", () => duzenle(-1));
    $("#kaydet").addEventListener("click", e => islem(e.target, async () => {
      await kaynagaKaydetVeYayinla([{ yol: `yazili/${g}.txt`, metin: havuzYaz(havuz) }], `${g}. sınıf yazılı soruları güncellendi`);
      $("#kaydetcubuk").classList.add("gizli");
    }, "Kaydedildi; sınavlar ve PDF'ler yenilendi, açık yazılılar sitede güncellendi."));
  }

  function duzenle(i) {
    const q = i >= 0 ? kopya(havuz.bloklar[i]) : { kaz, baglam: "", maddeler: [{ h: "a", p: 5, s: "", c: "" }, { h: "b", p: 5, s: "", c: "" }] };
    const kutu = $("#duzenleyici");
    const maddeCiz = () => q.maddeler.map((m, j) => `
      <div class="yon-madde" data-j="${j}">
        <div class="ust-satir"><b>Madde</b><input type="text" data-a="h" value="${esc(m.h)}" aria-label="Harf">
          <input type="number" min="1" data-a="p" value="${m.p}" aria-label="Puan"> <span>ham puan</span>
          <button class="dugme tehlike kucuk" data-msil="${j}" style="margin-left:auto">Maddeyi sil</button></div>
        <label class="alan">Soru</label><textarea data-a="s">${esc(m.s)}</textarea>
        <label class="alan">Cevap</label><textarea data-a="c">${esc(m.c)}</textarea>
      </div>`).join("");
    kutu.innerHTML = `<div class="yon-kutu" id="soruform">
      <h2 style="margin-top:0">${i >= 0 ? "Soruyu düzenle" : "Yeni soru"}</h2>
      <label class="alan" for="fkaz">Kazanım kodu</label><input type="text" id="fkaz" value="${esc(q.kaz)}">
      <div class="yon-iki"><div><label class="alan" for="fbag">Giriş metni (bağlam) — tablo, alt/üst simge için HTML kullanılabilir</label>
        <textarea id="fbag" class="buyuk" style="min-height:180px">${esc(q.baglam)}</textarea></div>
        <div><label class="alan">Önizleme</label><div class="yon-onizle" id="fon"></div></div></div>
      <div id="maddeler">${maddeCiz()}</div>
      <div class="yon-arac"><button class="dugme ikincil kucuk" id="madde-ekle">+ Madde ekle</button></div>
      <p class="alt">Puanlar sınavda kendiliğinden 100'e ölçeklenir; burada maddeler arasındaki oran önemlidir. Alt simge: <code>H&lt;sub&gt;2&lt;/sub&gt;O</code>, üst simge: <code>10&lt;sup&gt;−3&lt;/sup&gt;</code></p>
      <div class="yon-arac"><button class="dugme vurgu" id="tamam">Soruyu listeye ekle</button><button class="dugme ikincil" id="vazgec">Vazgeç</button></div></div>`;
    $("#tamam").textContent = i >= 0 ? "Değişikliği uygula" : "Soruyu listeye ekle";
    onizle($("#fbag"), $("#fon"), x => x, true);
    resimDugmesi($("#fbag"), true, "resim");
    const oku_ = () => {
      q.kaz = $("#fkaz").value.trim(); q.baglam = $("#fbag").value;
      $$("#maddeler .yon-madde").forEach((d, j) => {
        const m = q.maddeler[j];
        m.h = $('[data-a="h"]', d).value.trim() || "a"; m.p = Math.max(1, parseInt($('[data-a="p"]', d).value) || 1);
        m.s = $('[data-a="s"]', d).value; m.c = $('[data-a="c"]', d).value;
      });
    };
    const bagla = () => {
      $$("[data-msil]").forEach(b => b.addEventListener("click", () => { oku_(); q.maddeler.splice(+b.dataset.msil, 1); $("#maddeler").innerHTML = maddeCiz(); bagla(); }));
      $$("#maddeler textarea").forEach(otomatikBoy);
      $$('#maddeler textarea[data-a="s"]').forEach(t => resimDugmesi(t, true, "resim"));
    };
    bagla();
    $("#madde-ekle").addEventListener("click", () => {
      oku_(); const h = "abcçdefgğh"[q.maddeler.length] || "x";
      q.maddeler.push({ h, p: 5, s: "", c: "" }); $("#maddeler").innerHTML = maddeCiz(); bagla();
    });
    $("#vazgec").addEventListener("click", () => { kutu.innerHTML = ""; });
    $("#tamam").addEventListener("click", () => {
      oku_();
      if (!q.kaz) return alert("Kazanım kodunu yazın.");
      if (!q.maddeler.length || q.maddeler.some(m => !m.s.trim())) return alert("Her maddenin sorusu dolu olmalı.");
      if (i >= 0) havuz.bloklar[i] = q;
      else {
        /* aynı kazanımın son sorusunun arkasına ekle */
        let son = -1; havuz.bloklar.forEach((b, k) => { if (b.kaz === q.kaz) son = k; });
        havuz.bloklar.splice(son < 0 ? havuz.bloklar.length : son + 1, 0, q);
      }
      kaz = q.kaz; degisti(); ciz();
      durum("Soru listeye eklendi. Yayınlamak için “Kaydet ve yayınla”ya basın.", "", 5000);
    });
    $("#soruform").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  ciz();
}

/* ================= 3) Senaryolar ================= */
async function senaryolarSayfasi(g) {
  g = +g || 9;
  yukleniyor();
  const [senaryo, metin, uretilen] = await Promise.all([okuJSON(KAYNAK, "senaryo.json"), oku(KAYNAK, `yazili/${g}.txt`).catch(() => ""),
    okuJSON(KAYNAK, `cikti/veri/yazili${g}.json`).catch(() => ({ sinavlar: [] }))]);
  const havuz = havuzCoz(metin).bloklar;
  const havuzSay = {}; havuz.forEach(b => havuzSay[b.kaz] = (havuzSay[b.kaz] || 0) + 1);
  const imza = h => metinOzet(String(h).replace(/src="data:[^"]+"/g, ""), 120);
  /* sınavdaki sorunun havuzdaki sırasını bul (düzenleme bağlantısı için) */
  const havuzSira = q => { const im = imza(q.baglam); const ayni = havuz.map((b, i) => ({ b, i })).filter(x => x.b.kaz === q.kazanim); const k = ayni.findIndex(x => imza(x.b.baglam) === im); return k; };
  senaryo[g] = senaryo[g] || [];
  const liste = senaryo[g];
  const kazanimlar = () => [...new Set(Object.values(senaryo).flat().flatMap(e => e.dagilim.map(d => d[0])).filter(t => t.includes(`.${g}.`)))].sort((a, b) => a.localeCompare(b, "tr", { numeric: true }));
  const sirala = () => liste.sort((a, b) => (a.donem - b.donem) || (a.yazili - b.yazili) || (a.senaryo - b.senaryo));
  let donemSec = +(depo.al("senDonem") || 1);

  function ciz() {
    sirala();
    const { ger } = gerekenler(senaryo, g);
    const eksik = Object.keys(ger).filter(k => (havuzSay[k] || 0) < ger[k]);
    const gruplar = {};
    liste.forEach((e, i) => e.donem === donemSec && (gruplar[`${e.donem}-${e.yazili}`] = gruplar[`${e.donem}-${e.yazili}`] || []).push({ e, i }));
    ekran.innerHTML = `
      <h1>Senaryolar</h1>
      <p class="alt">MEB ortak yazılı senaryoları. Her senaryo bir sınavdır; satırlar o sınavda hangi kazanımdan kaç soru olacağını gösterir. Yeni eklenen yazılı, siz <a href="#/yazililar">Yazılı aç/kapat</a> sekmesinden açana kadar öğrenciye görünmez.</p>
      <div class="yon-arac">${sinifSecici(g)}
        <div class="cipler" style="margin:0">${[1, 2].map(d => `<button class="cip${d === donemSec ? " secili" : ""}" data-donem="${d}">${d}. Dönem · ${liste.filter(e => e.donem === d).length}</button>`).join("")}</div>
        <button class="dugme" id="yeni">+ Yeni senaryo</button></div>
      ${eksik.length ? `<div class="yon-kutu" style="border-color:var(--oksijen)"><b>Soru havuzu yetersiz:</b> ${eksik.map(k => `<a href="#/sorular/${g}/${encodeURIComponent(k)}">${esc(k)}</a> (${havuzSay[k] || 0}/${ger[k]})`).join(", ")}. Bu kazanımlarda sorular sınavlarda tekrar eder.</div>` : ""}
      ${Object.entries(gruplar).map(([k, xs]) => `<h2>${k.split("-")[0]}. Dönem ${k.split("-")[1]}. Yazılı</h2>
        <div class="yon-liste">${xs.map(({ e, i }) => `<div class="yon-oge"><span class="no">S${e.senaryo}</span>
          <div class="govde"><div class="ozet">${e.dagilim.map(([t, n]) => `${esc(t.split(" ")[0].replace(/\.$/, ""))} ×${n}`).join(" · ")}</div>
          <small>${e.dagilim.reduce((a, d) => a + d[1], 0)} soru</small></div>
          <button class="dugme ikincil kucuk" data-duzenle="${i}">Düzenle</button>
          <button class="dugme ikincil kucuk" data-kopya="${i}">Kopyala</button>
          <button class="dugme tehlike kucuk" data-sil="${i}">Sil</button></div>`).join("")}</div>`).join("") || `<p class="bos">${donemSec}. dönem için henüz senaryo yok. “+ Yeni senaryo” ile ekleyin; isterseniz 1. dönemden bir senaryoyu “Kopyala” ile alıp dönemini değiştirin.</p>`}
      <div id="duzenleyici"></div>
      <datalist id="kazliste">${kazanimlar().map(t => `<option value="${esc(t)}">`).join("")}</datalist>
      ${kaydetCubugu()}`;
    if (kirli) $("#kaydetcubuk").classList.remove("gizli");
    sinifDegisince($("#sinif"), v => `#/senaryolar/${v}`);
    $("#yeni").addEventListener("click", () => duzenle(-1));
    $$("[data-donem]").forEach(c => c.addEventListener("click", () => { donemSec = +c.dataset.donem; depo.koy("senDonem", donemSec); ciz(); }));
    $$("[data-duzenle]").forEach(d => d.addEventListener("click", () => duzenle(+d.dataset.duzenle)));
    $$("[data-kopya]").forEach(d => d.addEventListener("click", () => {
      const e = kopya(liste[+d.dataset.kopya]);
      e.senaryo = Math.max(0, ...liste.filter(x => x.donem === e.donem && x.yazili === e.yazili).map(x => x.senaryo)) + 1;
      liste.push(e); degisti(); ciz(); duzenle(liste.indexOf(e));
    }));
    $$("[data-sil]").forEach(d => d.addEventListener("click", () => {
      const e = liste[+d.dataset.sil];
      if (!confirm(`${e.donem}. dönem ${e.yazili}. yazılı senaryo ${e.senaryo} silinsin mi?`)) return;
      liste.splice(+d.dataset.sil, 1); degisti(); ciz();
    }));
    $("#kaydet").addEventListener("click", ev => islem(ev.target, async () => {
      liste.forEach(e => { e.toplam = e.dagilim.reduce((a, d) => a + d[1], 0); });
      await kaynagaKaydetVeYayinla([{ yol: "senaryo.json", metin: JSON.stringify(senaryo, null, 1) + "\n" }], `${g}. sınıf senaryoları güncellendi`);
      $("#kaydetcubuk").classList.add("gizli");
    }, "Kaydedildi; sınavlar ve PDF'ler yeniden üretildi."));
  }

  function sinavSorulari(e) {
    const sv = uretilen.sinavlar.find(x => x.id === `${e.donem}-${e.yazili}-${e.senaryo}`);
    if (!sv) return `<p class="alt" style="margin-top:14px">Bu senaryonun sınavı henüz üretilmedi; kaydettikten birkaç dakika sonra soruları burada görünür.</p>`;
    return `<h2>Bu senaryodaki sorular</h2>
      <p class="alt">Sınavda çıkan sorular, kazanımlarıyla birlikte. Bir soruyu değiştirmek için “Soruyu düzenle”ye basın.</p>
      <div class="yon-liste">${sv.sorular.map((q, n) => {
        const k = havuzSira(q);
        return `<div class="yon-oge"><span class="no">${n + 1}</span><div class="govde">
          <b>${esc(q.kazanim)}</b> <span class="yon-rozet">${q.puan} puan</span>
          <div class="yon-onizle" style="margin-top:6px">${q.baglam}${q.maddeler.map(m => `<p style="margin-top:6px"><b>${esc(m.h)})</b> ${m.s} <small>(${m.p} p)</small></p>`).join("")}</div></div>
          ${k >= 0 ? `<a class="dugme ikincil kucuk" href="#/sorular/${g}/${encodeURIComponent(q.kazanim)}/${k}">Soruyu düzenle</a>` : ""}</div>`;
      }).join("")}</div>`;
  }

  function duzenle(i) {
    const son = liste.filter(x => x.donem === donemSec).pop();
    const e = i >= 0 ? kopya(liste[i]) : { donem: donemSec, yazili: son?.yazili || 1, senaryo: 1, dagilim: [["", 1]] };
    if (i < 0) e.senaryo = Math.max(0, ...liste.filter(x => x.donem === e.donem && x.yazili === e.yazili).map(x => x.senaryo)) + 1;
    const kutu = $("#duzenleyici");
    const satirlar = () => e.dagilim.map(([t, n], j) => `<div class="yon-satir" style="margin:6px 0" data-j="${j}">
      <input type="text" list="kazliste" data-a="t" value="${esc(t)}" title="${esc(t)}" style="flex:1;min-width:240px" placeholder="KİM.${g}.1.1. Kazanım metni">
      <input type="number" class="dar" min="1" max="10" data-a="n" value="${n}" style="width:80px" aria-label="Soru sayısı">
      <button class="dugme tehlike kucuk" data-ssil="${j}" aria-label="Satırı sil">✕</button></div>`).join("");
    kutu.innerHTML = `<div class="yon-kutu" id="senform"><h2 style="margin-top:0">${i >= 0 ? "Senaryoyu düzenle" : "Yeni senaryo"}</h2>
      <div class="yon-satir">
        <label>Dönem <select class="dar" id="fdon"><option${e.donem == 1 ? " selected" : ""}>1</option><option${e.donem == 2 ? " selected" : ""}>2</option></select></label>
        <label>Yazılı <select class="dar" id="fyaz"><option${e.yazili == 1 ? " selected" : ""}>1</option><option${e.yazili == 2 ? " selected" : ""}>2</option><option${e.yazili == 3 ? " selected" : ""}>3</option></select></label>
        <label>Senaryo no <input type="number" class="dar" id="fsen" min="1" value="${e.senaryo}" style="width:90px"></label></div>
      <label class="alan">Kazanım ve soru sayısı (kazanımı listeden seçebilir ya da tam metnini yazabilirsiniz)</label>
      <div id="satirlar">${satirlar()}</div>
      <div class="yon-arac"><button class="dugme ikincil kucuk" id="satir-ekle">+ Satır ekle</button><span id="toplam"></span></div>
      <div class="yon-arac"><button class="dugme vurgu" id="tamam">${i >= 0 ? "Değişikliği uygula" : "Senaryoyu ekle"}</button><button class="dugme ikincil" id="vazgec">Vazgeç</button></div>
      ${i >= 0 ? sinavSorulari(liste[i]) : ""}</div>`;
    const oku_ = () => {
      e.donem = +$("#fdon").value; e.yazili = +$("#fyaz").value; e.senaryo = +$("#fsen").value || 1;
      e.dagilim = $$("#satirlar [data-j]").map(d => [$('[data-a="t"]', d).value.trim(), Math.max(1, parseInt($('[data-a="n"]', d).value) || 1)]);
      $("#toplam").textContent = "Toplam " + e.dagilim.reduce((a, d) => a + d[1], 0) + " soru";
    };
    const bagla = () => {
      $$("[data-ssil]").forEach(b => b.addEventListener("click", () => { oku_(); e.dagilim.splice(+b.dataset.ssil, 1); $("#satirlar").innerHTML = satirlar(); bagla(); }));
      $$("#satirlar input").forEach(x => x.addEventListener("input", oku_));
      oku_();
    };
    bagla();
    $("#satir-ekle").addEventListener("click", () => { oku_(); e.dagilim.push(["", 1]); $("#satirlar").innerHTML = satirlar(); bagla(); });
    $("#vazgec").addEventListener("click", () => { kutu.innerHTML = ""; });
    $("#tamam").addEventListener("click", () => {
      oku_();
      e.dagilim = e.dagilim.filter(d => d[0]);
      if (!e.dagilim.length) return alert("En az bir kazanım satırı girin.");
      const kotu = e.dagilim.find(d => !/^KİM\.\d+\.\d+\.\d+/.test(d[0]));
      if (kotu) return alert("Kazanım “KİM.9.1.3. …” biçiminde kodla başlamalı: " + kotu[0]);
      const cakisan = liste.findIndex((x, k) => k !== i && x.donem === e.donem && x.yazili === e.yazili && x.senaryo === e.senaryo);
      if (cakisan >= 0) return alert("Bu dönem/yazılı için aynı numarada bir senaryo zaten var.");
      if (i >= 0) liste[i] = e; else liste.push(e);
      donemSec = e.donem; depo.koy("senDonem", donemSec);
      degisti(); ciz();
    });
    $("#senform").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  ciz();
}

/* ================= 4) Konu anlatımı ================= */
async function konuSayfasi(g, dosya) {
  g = +g || 9;
  yukleniyor();
  const dizin = (await gh(`/repos/${SAHIP}/${SITE}/contents/konu/${g}?ref=main`)).filter(f => f.name.endsWith(".html")).map(f => f.name.replace(/\.html$/, ""))
    .sort((a, b) => a.localeCompare(b, "tr", { numeric: true }));
  dosya = dizin.includes(dosya) ? dosya : dizin[0];
  const yol = `konu/${g}/${dosya}.html`;
  const ham = await oku(SITE, yol);
  const parcalar = ham.split(/(?=<section id="k-)/);
  const onek = parcalar[0].startsWith("<section") ? "" : parcalar.shift();
  const bolumler = parcalar.map(p => p.trim());
  const bilgi = s => ({ id: (s.match(/<section id="([^"]+)"/) || [])[1] || "?", ad: metinOzet((s.match(/<h2[^>]*>([\s\S]*?)<\/h2>/) || [])[1] || "", 90) });

  function ciz() {
    ekran.innerHTML = `
      <h1>Konu anlatımı</h1>
      <p class="alt">Her ünite bölümlerden oluşur. Bölümün HTML'ini düzenleyebilir, yanında önizlemesini görebilirsiniz. Bölümün <code>id</code>'si (ör. <code>k-1-2-3</code>) kazanım koduna göre testleri bağlar; değiştirmeyin.</p>
      <div class="yon-arac">${sinifSecici(g)}
        <select class="dar" id="dosya">${dizin.map(d => `<option${d === dosya ? " selected" : ""}>${d}</option>`).join("")}</select>
        <a class="dugme ikincil kucuk" href="./#/${g}/konu/${dosya}" target="_blank" rel="noopener">Sitede gör ↗</a></div>
      <div class="yon-liste">${bolumler.map((s, i) => { const b = bilgi(s); return `<div class="yon-oge"><span class="no">${i + 1}</span>
        <div class="govde"><b>${esc(b.ad)}</b><div class="ozet"><code>${esc(b.id)}</code></div></div>
        <button class="dugme ikincil kucuk" data-yukari="${i}" ${i ? "" : "disabled"} aria-label="Yukarı taşı">↑</button>
        <button class="dugme ikincil kucuk" data-duzenle="${i}">Düzenle</button>
        <button class="dugme tehlike kucuk" data-sil="${i}">Sil</button></div>`; }).join("")}</div>
      <div class="yon-arac"><button class="dugme" id="yeni">+ Yeni bölüm</button></div>
      <div id="duzenleyici"></div>
      ${kaydetCubugu()}`;
    if (kirli) $("#kaydetcubuk").classList.remove("gizli");
    sinifDegisince($("#sinif"), v => `#/konu/${v}`);
    sinifDegisince($("#dosya"), v => `#/konu/${g}/${v}`);
    $$("[data-duzenle]").forEach(d => d.addEventListener("click", () => duzenle(+d.dataset.duzenle)));
    $$("[data-yukari]").forEach(d => d.addEventListener("click", () => { const i = +d.dataset.yukari; [bolumler[i - 1], bolumler[i]] = [bolumler[i], bolumler[i - 1]]; degisti(); ciz(); }));
    $$("[data-sil]").forEach(d => d.addEventListener("click", () => { if (confirm("Bu bölüm silinsin mi?")) { bolumler.splice(+d.dataset.sil, 1); degisti(); ciz(); } }));
    $("#yeni").addEventListener("click", () => {
      const kod = prompt("Bölümün kazanım kodu (ör. 1.2.4):", dosya + ".");
      if (!kod) return;
      bolumler.push(`<section id="k-${kod.trim().replace(/\./g, "-")}">\n<h2><span class="k">${esc(kod.trim())}</span>Başlık</h2>\n<p>Metin…</p>\n</section>`);
      degisti(); ciz(); duzenle(bolumler.length - 1);
    });
    $("#kaydet").addEventListener("click", e => islem(e.target, async () => {
      await commitle(SITE, [{ yol, metin: onek + bolumler.join("\n\n") + "\n" }], `Konu anlatımı güncellendi: ${g}. sınıf ${dosya}`);
      $("#kaydetcubuk").classList.add("gizli");
    }));
  }

  function duzenle(i) {
    const kutu = $("#duzenleyici");
    kutu.innerHTML = `<div class="yon-kutu" id="konuform"><h2 style="margin-top:0">${esc(bilgi(bolumler[i]).ad)}</h2>
      <div class="yon-iki"><div><label class="alan" for="fhtml">HTML</label><textarea id="fhtml" class="buyuk">${esc(bolumler[i])}</textarea></div>
      <div><label class="alan">Önizleme</label><div class="yon-onizle konu" id="fon"></div></div></div>
      <p class="alt">Sık kullanılanlar: <code>&lt;h3&gt;Alt başlık&lt;/h3&gt;</code> · <code>&lt;div class="tanim"&gt;…&lt;/div&gt;</code> · <code>&lt;div class="formul"&gt;…&lt;/div&gt;</code> · <code>&lt;b&gt;kalın&lt;/b&gt;</code></p>
      <div class="yon-arac"><button class="dugme vurgu" id="tamam">Değişikliği uygula</button><button class="dugme ikincil" id="vazgec">Vazgeç</button></div></div>`;
    onizle($("#fhtml"), $("#fon"));
    resimDugmesi($("#fhtml"), false, `img/yukle/${g}`, y => `\n<figure><img src="${y}" alt=""><figcaption>Açıklama</figcaption></figure>\n`);
    $("#vazgec").addEventListener("click", () => { kutu.innerHTML = ""; });
    $("#tamam").addEventListener("click", () => {
      const v = $("#fhtml").value.trim();
      if (!/^<section id="k-[^"]+">[\s\S]*<\/section>$/.test(v)) return alert("Bölüm <section id=\"k-…\"> ile başlayıp </section> ile bitmeli.");
      bolumler[i] = v; degisti(); ciz();
    });
    $("#konuform").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  ciz();
}

/* ================= 5–6) Testler ve karma testler ================= */
const SEVIYELER = ["Kolay", "Orta", "Zor"];
async function testSayfasi(g, karmaMi, bolumId) {
  g = +g || 9;
  yukleniyor();
  const yol = `veri/${g}.json`;
  const veri = await okuJSON(SITE, yol);
  const sekme = karmaMi ? "karma" : "testler";
  const uygun = b => karmaMi ? b.tur === "karma" : b.tur !== "karma";
  let b = veri.find(x => x.id === bolumId && uygun(x)) || veri.find(uygun);
  let ti = 0;

  function ciz() {
    const bolumler = veri.filter(uygun);
    ekran.innerHTML = `
      <h1>${karmaMi ? "Karma testler" : "Testler"}</h1>
      <p class="alt">${karmaMi ? "Bütün konulardan karışık denemeler." : "Kazanım, bağlam ve ünite tekrar (sarmal) testleri."} Soru metni ve şıklarda HTML kullanılabilir; doğru şıkkı yuvarlakla işaretleyin.</p>
      <div class="yon-arac">${sinifSecici(g)}
        <select id="bolum" style="flex:1;min-width:240px">${bolumler.map(x => `<option value="${x.id}"${x === b ? " selected" : ""}>${esc(x.baslik)}${x.tur === "kazanim" ? "" : " · " + x.tur}</option>`).join("")}</select>
        ${karmaMi ? `<button class="dugme ikincil kucuk" id="yenibolum">+ Yeni karma test</button>` : ""}</div>
      ${b ? `<div class="cipler">${b.testler.map((t, i) => `<button class="cip${i === ti ? " secili" : ""}" data-t="${i}" ${t.seviye ? `data-sv="${t.seviye}"` : ""}><span class="nokta"></span>${t.seviye || "Test " + (i + 1)} · ${t.sorular.length} soru</button>`).join("")}
        <button class="cip" id="yenitest">+ Test</button></div>
        ${b.testler[ti] ? `<div class="yon-arac">
          ${b.testler[ti].seviye !== undefined && b.testler[ti].seviye !== null ? `<label>Seviye <select class="dar" id="tsev">${SEVIYELER.map(s => `<option${s === b.testler[ti].seviye ? " selected" : ""}>${s}</option>`).join("")}</select></label>` : ""}
          <button class="dugme tehlike kucuk" id="testsil">Bu testi sil</button>
          ${karmaMi ? `<button class="dugme tehlike kucuk" id="bolumsil">Bu karma testi tamamen sil</button>` : ""}</div>
        <div class="yon-liste">${b.testler[ti].sorular.map((q, i) => `<div class="yon-oge"><span class="no">${i + 1}</span>
          <div class="govde"><div class="ozet">${esc(metinOzet(q.s))}</div><small>Doğru: ${"ABCDE"[q.d]} · ${q.z || ""}</small></div>
          <button class="dugme ikincil kucuk" data-yukari="${i}" ${i ? "" : "disabled"} aria-label="Yukarı taşı">↑</button>
          <button class="dugme ikincil kucuk" data-duzenle="${i}">Düzenle</button>
          <button class="dugme tehlike kucuk" data-sil="${i}">Sil</button></div>`).join("") || `<p class="bos">Bu testte soru yok.</p>`}</div>
        <div class="yon-arac"><button class="dugme" id="yeni">+ Yeni soru</button></div>` : ""}` : `<p class="bos">Henüz yok.</p>`}
      <div id="duzenleyici"></div>
      ${kaydetCubugu()}`;
    if (kirli) $("#kaydetcubuk").classList.remove("gizli");
    sinifDegisince($("#sinif"), v => `#/${sekme}/${v}`);
    $("#bolum")?.addEventListener("change", e => { b = veri.find(x => x.id === e.target.value); ti = 0; ciz(); });
    $$("[data-t]").forEach(c => c.addEventListener("click", () => { ti = +c.dataset.t; ciz(); }));
    $("#yenitest")?.addEventListener("click", () => {
      const sev = b.tur === "kazanim" ? (SEVIYELER.find(s => !b.testler.some(t => t.seviye === s)) || "Orta") : null;
      b.testler.push({ seviye: sev, sorular: [] }); ti = b.testler.length - 1; degisti(); ciz();
    });
    $("#tsev")?.addEventListener("change", e => { b.testler[ti].seviye = e.target.value; degisti(); ciz(); });
    $("#testsil")?.addEventListener("click", () => { if (confirm("Bu test ve içindeki bütün sorular silinsin mi?")) { b.testler.splice(ti, 1); ti = 0; degisti(); ciz(); } });
    $("#bolumsil")?.addEventListener("click", () => { if (confirm("Bu karma test tamamen silinsin mi?")) { veri.splice(veri.indexOf(b), 1); b = veri.find(uygun); ti = 0; degisti(); ciz(); } });
    $("#yenibolum")?.addEventListener("click", () => {
      const ids = veri.map(x => x.id), on = (ids[0] || "bkq000").replace(/\d+$/, ""), uz = ((ids[0] || "bkq000").match(/\d+$/) || ["000"])[0].length;
      const no = Math.max(-1, ...ids.map(x => parseInt((x.match(/\d+$/) || ["-1"])[0]))) + 1;
      const kac = veri.filter(x => x.tur === "karma").length + 1;
      const yeni = { id: on + String(no).padStart(uz, "0"), baslik: `Karma Test ${String(kac).padStart(2, "0")} — Tüm kazanımlardan karışık`, tur: "karma", tema: null, unite: null, testler: [{ seviye: null, sorular: [] }] };
      veri.push(yeni); b = yeni; ti = 0; degisti(); ciz();
    });
    const sorular = () => b.testler[ti].sorular;
    $$("[data-sil]").forEach(d => d.addEventListener("click", () => { if (confirm("Bu soru silinsin mi?")) { sorular().splice(+d.dataset.sil, 1); degisti(); ciz(); } }));
    $$("[data-yukari]").forEach(d => d.addEventListener("click", () => { const i = +d.dataset.yukari, s = sorular(); [s[i - 1], s[i]] = [s[i], s[i - 1]]; degisti(); ciz(); }));
    $$("[data-duzenle]").forEach(d => d.addEventListener("click", () => duzenle(+d.dataset.duzenle)));
    $("#yeni")?.addEventListener("click", () => duzenle(-1));
    $("#kaydet").addEventListener("click", e => islem(e.target, async () => {
      await commitle(SITE, [{ yol, metin: JSON.stringify(veri) }], `${g}. sınıf ${karmaMi ? "karma testler" : "testler"} güncellendi`);
      $("#kaydetcubuk").classList.add("gizli");
    }));
  }

  function duzenle(i) {
    const s = b.testler[ti].sorular;
    const q = i >= 0 ? kopya(s[i]) : { s: "", sik: ["", "", "", "", ""], d: 0, c: "", z: b.testler[ti].seviye || "Orta" };
    const kutu = $("#duzenleyici");
    kutu.innerHTML = `<div class="yon-kutu" id="testform"><h2 style="margin-top:0">${i >= 0 ? `Soru ${i + 1}` : "Yeni soru"}</h2>
      <div class="yon-iki"><div><label class="alan" for="fs">Soru</label><textarea id="fs" style="min-height:140px">${esc(q.s)}</textarea></div>
        <div><label class="alan">Önizleme</label><div class="yon-onizle" id="fon"></div></div></div>
      <label class="alan">Şıklar (doğru olanı işaretleyin)</label>
      <div class="yon-sik">${q.sik.map((x, j) => `<input type="radio" name="dogru" value="${j}" ${q.d === j ? "checked" : ""} aria-label="${"ABCDE"[j]} doğru">
        <input type="text" data-sik="${j}" value="${esc(x)}" placeholder="${"ABCDE"[j]} şıkkı">`).join("")}</div>
      <label class="alan" for="fc">Çözüm</label><textarea id="fc">${esc(q.c)}</textarea>
      <label class="alan" for="fz">Zorluk</label><select class="dar" id="fz">${SEVIYELER.map(z => `<option${z === q.z ? " selected" : ""}>${z}</option>`).join("")}</select>
      <div class="yon-arac"><button class="dugme vurgu" id="tamam">${i >= 0 ? "Değişikliği uygula" : "Soruyu ekle"}</button><button class="dugme ikincil" id="vazgec">Vazgeç</button></div></div>`;
    onizle($("#fs"), $("#fon"));
    resimDugmesi($("#fs"), false, `img/yukle/${g}`);
    otomatikBoy($("#fc"));
    resimDugmesi($("#fc"), false, `img/yukle/${g}`);
    $("#vazgec").addEventListener("click", () => { kutu.innerHTML = ""; });
    $("#tamam").addEventListener("click", () => {
      q.s = $("#fs").value.trim(); q.sik = $$("[data-sik]").map(x => x.value.trim());
      q.d = +($("input[name=dogru]:checked")?.value ?? 0); q.c = $("#fc").value.trim(); q.z = $("#fz").value;
      if (!q.s) return alert("Soru metni boş olamaz.");
      if (q.sik.some(x => !x)) return alert("Beş şıkkın hepsini doldurun.");
      if (!/^<(p|div|table|figure)/.test(q.s)) q.s = `<p>${q.s}</p>`;
      if (i >= 0) s[i] = q; else s.push(q);
      degisti(); ciz();
    });
    $("#testform").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  ciz();
}

/* ================= 7) Etkinlikler ================= */
const ETK_TUR = { dy: "Doğru / Yanlış", es: "Eşleştirme", bo: "Boşluk doldurma", au: "Açık uçlu", ta: "Tablo tamamlama", kh: "Kavram haritası" };
const ALAN_AD = { yonerge: "Yönerge", maddeler: "Maddeler", h: "Harf", t: "Metin", d: "Doğru mu?", cevap: "Cevap", baslik: "Sütun başlıkları", sol: "Sol sütun", sag: "Sağ sütun",
  n: "No", kelimeler: "Kelimeler", cumleler: "Cümleler", sorular: "Sorular", tablo: "Tablo (satırlar)", gorsel: "Görsel yolu", bos: "Boş kutu numaraları", no: "Sıra no", tur: "Tür" };
function bosKopya(x) {
  if (Array.isArray(x)) return x.slice(0, 2).map(bosKopya);
  if (x && typeof x === "object") { const o = {}; for (const k in x) o[k] = k === "tur" ? x[k] : bosKopya(x[k]); return o; }
  if (typeof x === "string") return "";
  if (typeof x === "boolean") return false;
  return x;
}
/* JSON yapısını kendiliğinden form olarak çizer; değişince yerinde günceller */
function formYap(kap, deger, degisince) {
  const yap = (v, yaz, ad) => {
    const kutu = document.createElement("div");
    if (Array.isArray(v)) {
      const fs = document.createElement("fieldset");
      fs.innerHTML = `<legend>${esc(ad)} (${v.length})</legend>`;
      v.forEach((x, i) => {
        const s = document.createElement("div"); s.className = "yon-dizi-oge";
        const ic = yap(x, y => { v[i] = y; degisince(); }, `${i + 1}`);
        const sil = document.createElement("button"); sil.className = "dugme tehlike kucuk"; sil.textContent = "✕"; sil.setAttribute("aria-label", "Sil");
        sil.onclick = () => { v.splice(i, 1); degisince(true); };
        s.append(ic, sil); fs.append(s);
      });
      const ekle = document.createElement("button"); ekle.className = "dugme ikincil kucuk"; ekle.textContent = "+ Ekle";
      ekle.onclick = () => { v.push(v.length ? bosKopya(v[v.length - 1]) : ""); degisince(true); };
      fs.append(ekle); kutu.append(fs);
    } else if (v && typeof v === "object") {
      const fs = document.createElement("fieldset");
      fs.innerHTML = `<legend>${esc(ad)}</legend>`;
      const sayisal = Object.keys(v).length && Object.keys(v).every(k => /^\d+$/.test(k));
      Object.keys(v).forEach(k => {
        if (v === deger && (k === "tur" || k === "no")) return;  /* tür ve sıra no panelce yönetilir */
        const s = document.createElement("div"); s.className = "yon-dizi-oge";
        s.append(yap(v[k], y => { v[k] = y; degisince(); }, ALAN_AD[k] || k));
        if (sayisal) { const sil = document.createElement("button"); sil.className = "dugme tehlike kucuk"; sil.textContent = "✕"; sil.onclick = () => { delete v[k]; degisince(true); }; s.append(sil); }
        fs.append(s);
      });
      if (sayisal) {
        const ekle = document.createElement("button"); ekle.className = "dugme ikincil kucuk"; ekle.textContent = "+ Ekle";
        ekle.onclick = () => { const n = Math.max(0, ...Object.keys(v).map(Number)) + 1; v[n] = ""; degisince(true); };
        fs.append(ekle);
      }
      kutu.append(fs);
    } else if (typeof v === "boolean") {
      kutu.innerHTML = `<label><input type="checkbox" ${v ? "checked" : ""}> ${esc(ad)}</label>`;
      $("input", kutu).onchange = e => yaz(e.target.checked);
    } else if (typeof v === "number") {
      kutu.innerHTML = `<label class="alan">${esc(ad)}</label><input type="number" value="${v}">`;
      $("input", kutu).oninput = e => yaz(Number(e.target.value));
    } else {
      const uzun = String(v ?? "").length > 70;
      kutu.innerHTML = `<label class="alan">${esc(ad)}</label>${uzun ? `<textarea>${esc(v)}</textarea>` : `<input type="text" value="${esc(v)}">`}`;
      const g = $("input,textarea", kutu); g.oninput = e => yaz(e.target.value);
      if (uzun) otomatikBoy(g);
      if (ad === ALAN_AD.gorsel) {
        const d = document.createElement("button"); d.type = "button"; d.className = "dugme ikincil kucuk yon-resim"; d.textContent = "🖼 Resim seç";
        d.onclick = async () => { const y = await resimYukle(false, formYap.klasor); if (y) { g.value = y; yaz(y); } };
        const on = document.createElement("img"); on.className = "yon-kucukresim"; on.alt = "";
        const goster = () => { on.src = resimOnbellek[g.value] || g.value; on.hidden = !g.value; };
        g.addEventListener("input", goster); d.addEventListener("click", () => setTimeout(goster, 0)); goster();
        kutu.append(d, on);
      } else if (formYap.resimli) {
        g.addEventListener("focus", () => { formYap.sonAlan = g; });
      }
    }
    return kutu;
  };
  kap.innerHTML = "";
  kap.append(yap(deger, () => {}, "Etkinlik"));
}

async function etkinlikSayfasi(g, kod) {
  g = +g || 9;
  formYap.klasor = `img/etk/${g}`; formYap.resimli = true;
  yukleniyor();
  const yol = `veri/etk${g}.json`;
  const veri = await okuJSON(SITE, yol);
  let k = veri.find(x => x.kod === kod) || veri[0];
  const ornek = {};
  veri.forEach(x => x.etkinlikler.forEach(e => { ornek[e.tur] = ornek[e.tur] || e; }));

  function ciz() {
    ekran.innerHTML = `
      <h1>Etkinlikler</h1>
      <p class="alt">Kazanımı seçin, etkinliği düzenleyin. Kavram haritası görselleri <code>img/etk/${g}/</code> klasöründedir.</p>
      <div class="yon-arac">${sinifSecici(g)}
        <select id="kaz" style="flex:1;min-width:240px">${veri.map(x => `<option value="${esc(x.kod)}"${x === k ? " selected" : ""}>${esc(x.kod)} ${esc(x.ad)} (${x.etkinlikler.length})</option>`).join("")}</select>
        <a class="dugme ikincil kucuk" href="./#/${g}/etk/${encodeURIComponent(k.kod)}" target="_blank" rel="noopener">Sitede gör ↗</a></div>
      <div class="yon-kutu"><label class="alan" for="kad">Kazanım adı</label><input type="text" id="kad" value="${esc(k.ad)}">
        <label class="alan" for="kamac">Amaç</label><input type="text" id="kamac" value="${esc(k.amac)}"></div>
      <div class="yon-liste">${k.etkinlikler.map((e, i) => `<div class="yon-oge"><span class="no">${e.no ?? i + 1}</span>
        <div class="govde"><b>${ETK_TUR[e.tur] || e.tur}</b><div class="ozet">${esc(metinOzet(e.yonerge, 110))}</div></div>
        <button class="dugme ikincil kucuk" data-yukari="${i}" ${i ? "" : "disabled"} aria-label="Yukarı taşı">↑</button>
        <button class="dugme ikincil kucuk" data-duzenle="${i}">Düzenle</button>
        <button class="dugme tehlike kucuk" data-sil="${i}">Sil</button></div>`).join("")}</div>
      <div class="yon-arac"><select class="dar" id="yenitur">${Object.entries(ETK_TUR).filter(([t]) => ornek[t]).map(([t, ad]) => `<option value="${t}">${ad}</option>`).join("")}</select>
        <button class="dugme" id="yeni">+ Yeni etkinlik</button></div>
      <div id="duzenleyici"></div>
      ${kaydetCubugu()}`;
    if (kirli) $("#kaydetcubuk").classList.remove("gizli");
    sinifDegisince($("#sinif"), v => `#/etkinlik/${v}`);
    $("#kaz").addEventListener("change", e => { k = veri.find(x => x.kod === e.target.value); ciz(); });
    $("#kad").addEventListener("input", e => { k.ad = e.target.value; degisti(); });
    $("#kamac").addEventListener("input", e => { k.amac = e.target.value; degisti(); });
    const yenidenNumarala = () => k.etkinlikler.forEach((e, i) => { e.no = i + 1; });
    $$("[data-sil]").forEach(d => d.addEventListener("click", () => { if (confirm("Bu etkinlik silinsin mi?")) { k.etkinlikler.splice(+d.dataset.sil, 1); yenidenNumarala(); degisti(); ciz(); } }));
    $$("[data-yukari]").forEach(d => d.addEventListener("click", () => { const i = +d.dataset.yukari, s = k.etkinlikler; [s[i - 1], s[i]] = [s[i], s[i - 1]]; yenidenNumarala(); degisti(); ciz(); }));
    $$("[data-duzenle]").forEach(d => d.addEventListener("click", () => duzenle(+d.dataset.duzenle)));
    $("#yeni").addEventListener("click", () => {
      const t = $("#yenitur").value, o = ornek[t];
      const e = bosKopya(o); e.tur = t; e.yonerge = o.yonerge; e.no = k.etkinlikler.length + 1;
      k.etkinlikler.push(e); degisti(); ciz(); duzenle(k.etkinlikler.length - 1);
    });
    $("#kaydet").addEventListener("click", e => islem(e.target, async () => {
      await commitle(SITE, [{ yol, metin: JSON.stringify(veri) }], `${g}. sınıf etkinlikleri güncellendi`);
      $("#kaydetcubuk").classList.add("gizli");
    }));
  }

  function duzenle(i) {
    const e = k.etkinlikler[i];
    const kutu = $("#duzenleyici");
    kutu.innerHTML = `<div class="yon-kutu" id="etkform"><h2 style="margin-top:0">${ETK_TUR[e.tur] || e.tur} · ${e.no ?? i + 1}</h2>
      <p class="alt">Alanlar doğrudan etkinliği değiştirir. Bitince aşağıdaki “Kaydet ve yayınla”ya basın.
        Bir metnin içine resim koymak için önce o metin kutusuna tıklayın, sonra “Resim ekle”ye basın.</p>
      <div class="yon-arac"><button type="button" class="dugme ikincil kucuk" id="etkresim">🖼 Resim ekle</button></div>
      <div id="etkalan"></div><div class="yon-arac"><button class="dugme ikincil" id="kapat">Kapat</button></div></div>`;
    const cizForm = () => formYap($("#etkalan"), e, yapisal => { degisti(); if (yapisal) cizForm(); });
    cizForm();
    $("#etkresim").addEventListener("click", async () => {
      const alan = formYap.sonAlan;
      if (!alan || !document.contains(alan)) return alert("Önce resmin gireceği metin kutusuna tıklayın.");
      const y = await resimYukle(false, `img/etk/${g}`);
      if (y) imleceEkle(alan, `<img src="${y}" alt="">`);
    });
    $("#kapat").addEventListener("click", () => { kutu.innerHTML = ""; ciz(); });
    $("#etkform").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  ciz();
}

/* ---------------- yönlendirme ---------------- */
async function yonlendir() {
  if (!anahtar) return girisSayfasi();
  const p = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  const s = p[0] || "yazililar";
  sekmeCiz(s);
  try {
    switch (s) {
      case "sorular": return await sorularSayfasi(p[1], p[2], p[3]);
      case "senaryolar": return await senaryolarSayfasi(p[1]);
      case "konu": return await konuSayfasi(p[1], p[2]);
      case "testler": return await testSayfasi(p[1], false, p[2]);
      case "karma": return await testSayfasi(p[1], true, p[2]);
      case "etkinlik": return await etkinlikSayfasi(p[1], p[2]);
      case "cikis":
        if (confirm("Bu tarayıcıdaki anahtar silinsin mi? Sonra yeniden girmeniz gerekir.")) { depo.koy("anahtar", null); anahtar = null; kirli = false; return girisSayfasi(); }
        location.hash = "#/yazililar"; return;
      default: return await yazililarSayfasi();
    }
  } catch (h) {
    console.error(h);
    if (h.durum === 401) { depo.koy("anahtar", null); anahtar = null; return girisSayfasi("Anahtarın süresi dolmuş ya da silinmiş."); }
    hataGoster(h);
  }
}
let oncekiHash = location.hash;
window.addEventListener("hashchange", () => {
  if (kirli && !confirm("Kaydedilmemiş değişiklikler var. Sayfadan çıkılsın mı?")) { history.replaceState(null, "", oncekiHash); return; }
  kirli = false; oncekiHash = location.hash; yonlendir();
});
yonlendir();
