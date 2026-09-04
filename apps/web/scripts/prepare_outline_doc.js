const fs = require('fs');
const path = require('path');

const imgBesnota = fs.readFileSync(path.resolve(__dirname, 'screenshot_besnota.png')).toString('base64');
const imgEutanazia = fs.readFileSync(path.resolve(__dirname, 'screenshot_eutanazia.png')).toString('base64');
const imgAnestezia = fs.readFileSync(path.resolve(__dirname, 'screenshot_anestezia.png')).toString('base64');
const imgKniha = fs.readFileSync(path.resolve(__dirname, 'screenshot_kniha_besnoty.png')).toString('base64');

const html = `
<p>Táto dokumentácia podrobne mapuje a ilustruje <strong>všetky tlačové zostavy, zákonné osvedčenia a úradné registre</strong> z VetSoftware V2, ktoré boli úspešne integrované a nasadené do systému <strong>OpenVPM AI</strong> pre ambulanciu MVDr. Martina Sýkoru (Rimavská Sobota).</p>

<h2>1. Veterinárne osvedčenie o vyšetrení zvieraťa (Poranenie človeka / Besnota)</h2>
<p><strong>Originálny súbor vo VetSoftware:</strong> <code>rep201</code> (panel <code>MadnessPanel</code>, prefix <code>h376</code>)<br>
<strong>Zákonný rámec:</strong> § 17 zákona NR SR č. 39/2007 Z. z. o veterinárnej starostlivosti a § 4 zákona č. 282/2002 Z. z.<br>
<strong>Účel:</strong> Zákonné osvedčenie pre humánneho lekára a RVPS pri poranení človeka zvieraťom. Nariaďuje povinnú 14-dňovú izoláciu a vyšetrenia v 1., 5. a 14. deň.</p>

<p><img src="data:image/png;base64,${imgBesnota}" alt="Veterinárne osvedčenie - Besnota (rep201)"></p>

<hr>

<h2>2. Informovaný súhlas s eutanáziou a asanáciou</h2>
<p><strong>Originálny súbor vo VetSoftware:</strong> <code>rep202</code> (panel <code>EutanazieProtokolPanel</code>, prefix <code>h377</code>)<br>
<strong>Účel:</strong> Právne záväzný informovaný súhlas vlastníka s humanitárnym usmrtením zvieraťa. Obsahuje povinnú 15-dňovú klauzulu o neporanení človeka (vylúčenie besnoty), voľbu naloženia s telom (kremácia / asanácia kafilériou / pochovanie) a slúži ako oficiálne potvrdenie pre odhlásenie zvieraťa z obecného alebo mestského úradu.</p>

<p><img src="data:image/png;base64,${imgEutanazia}" alt="Súhlas s eutanáziou a asanáciou (rep202)"></p>

<hr>

<h2>3. Súhlas s hospitalizáciou, zákrokom a anestéziou</h2>
<p><strong>Originálny súbor vo VetSoftware:</strong> <code>rep204</code> (panel <code>HospitProtokolPanel</code>, prefix <code>h379</code>)<br>
<strong>Účel:</strong> Chirurgický a anesteziologický informovaný súhlas. Poučenie o rizikách celkovej narkózy, súhlas s neodkladným rozšírením zákroku pri nálezoch, voľba predanesteziologického vyšetrenia krvi, voľba kardiopulmonálnej resuscitácie (KPR ÁNO / NIE - DNR) a záväzok úhrady nákladov.</p>

<p><img src="data:image/png;base64,${imgAnestezia}" alt="Súhlas s hospitalizáciou a anestéziou (rep204)"></p>

<hr>

<h2>4. Úradný register pre RVPS: Kniha očkovania proti besnote</h2>
<p><strong>Zákonný rámec:</strong> § 17 zákona č. 39/2007 Z. z.<br>
<strong>Rozsah v databáze:</strong> 135 vakcinácií proti besnote identifikovaných z 1 297 celkových očkovaní v ambulancii.<br>
<strong>Dáta výkazu:</strong> Dátum vakcinácie, meno pacienta, druh, plemeno, číslo mikročipu, meno a adresa vlastníka, telefón, názov a šarža vakcíny, dátum nasledujúcej revakcinácie.</p>

<p><img src="data:image/png;base64,${imgKniha}" alt="Kniha očkovania proti besnote - RVPS Register"></p>

<hr>

<h2>5. Zoznam všetkých 7 formulárov z TAB076 v OpenVPM AI</h2>
<p>Všetkých 7 formulárov bolo nasadených do tabuľky <code>consent_forms</code> a sú okamžite dostupné na elektronický podpis (E-Sign) cez QR kód v karte pacienta:</p>
<ol>
  <li><strong>vysetrenie-besnota</strong> – Veterinárne osvedčenie o vyšetrení zvieraťa (poranenie človeka / besnota)</li>
  <li><strong>suhlas-eutanazia</strong> – Súhlas s eutanáziou a asanáciou</li>
  <li><strong>suhlas-zakrok-anestezia</strong> – Súhlas s hospitalizáciou, zákrokom a anestéziou</li>
  <li><strong>suhlas-gdpr-crsz</strong> – Súhlas so spracovaním osobných údajov (GDPR / CRSZ / KVL SR)</li>
  <li><strong>kontrola-totoznosti</strong> – Potvrdenie o kontrole totožnosti zvieraťa (čip / tetovanie)</li>
  <li><strong>ziadanka-laboratorium</strong> – Žiadanka na laboratórne vyšetrenia</li>
  <li><strong>lekarska-sprava</strong> – Lekárska správa / Prepúšťacia správa</li>
</ol>

<h2>6. Finančná bilancia z VetSoftware V2</h2>
<ul>
  <li><strong>Celkový počet účtovných dokladov:</strong> 10 492</li>
  <li><strong>Celkový evidovaný obrat:</strong> 358 590,30 €</li>
  <li><strong>Časové rozpätie:</strong> Roky 2014 – 2026</li>
</ul>
`;

fs.writeFileSync(path.resolve(__dirname, 'outline_doc.html'), html, 'utf-8');
console.log('Saved outline_doc.html (size: ' + (html.length / 1024).toFixed(1) + ' KB)');
