// AI Canvas – vizuálna tvorba (M2 pravidlá):
//  - len keď recept explicitne povoľuje ilustráciu A niet vhodnej fotky
//  - výstup je VŽDY označený ako „Ilustrácia" (badge v UI aj prefix v alt texte)
//  - nikdy sa negeneruje realistické zviera vyzerajúce ako pacient kliniky
// Procedurálna SVG kompozícia v brand farbách kliniky (abstraktná, nie fotorealistická).

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const PAW =
  "M12 13.5c3.6 0 7 2.6 7 5.6 0 1.7-1.3 2.9-3 2.9-1.3 0-1.9-.8-4-.8s-2.7.8-4 .8c-1.7 0-3-1.2-3-2.9 0-3 3.4-5.6 7-5.6zM6.2 6.5c1.1 0 2 1.2 2 2.6S7.3 11.7 6.2 11.7s-2-1.2-2-2.6.9-2.6 2-2.6zm11.6 0c1.1 0 2 1.2 2 2.6s-.9 2.6-2 2.6-2-1.2-2-2.6.9-2.6 2-2.6zM9.4 2c1.2 0 2.1 1.3 2.1 2.9S10.6 7.8 9.4 7.8 7.3 6.5 7.3 4.9 8.2 2 9.4 2zm5.2 0c1.2 0 2.1 1.3 2.1 2.9s-.9 2.9-2.1 2.9-2.1-1.3-2.1-2.9S13.4 2 14.6 2z";

export function proceduralIllustration(
  prompt: string,
  brand: { name: string; brandColor?: string; accentColor?: string }
): string {
  const h = hash(prompt);
  const variant = h % 3;
  const p = brand.brandColor || "#0e5e4a";
  const s = brand.accentColor || "#e8a33d";
  const bg = "#faf6ef";
  const rot = (h % 40) - 20;

  const circles = Array.from({ length: 5 }, (_, i) => {
    const cx = 120 + ((h >> (i * 3)) % 900);
    const cy = 120 + ((h >> (i * 5)) % 900);
    const r = 60 + ((h >> (i * 7)) % 180);
    const col = i % 2 === 0 ? p : s;
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${col}" opacity="${i === 4 ? 0.12 : 0.08}"/>`;
  }).join("");

  const hero =
    variant === 0
      ? `<g transform="translate(470 350) scale(11) rotate(${rot} 12 12)"><path d="${PAW}" fill="${p}"/></g>`
      : variant === 1
        ? `<g transform="translate(430 330) scale(9)"><path d="${PAW}" fill="${p}"/><circle cx="19" cy="3" r="7" fill="${s}" opacity="0.9"/></g>`
        : `<g transform="translate(400 300) scale(10) rotate(${rot} 12 12)"><path d="${PAW}" fill="${p}"/><rect x="-2" y="24" width="30" height="3" rx="1.5" fill="${s}"/></g>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
  <rect width="1200" height="1200" fill="${bg}"/>
  ${circles}
  <rect x="60" y="60" width="1080" height="1080" rx="64" fill="none" stroke="${p}" stroke-width="6" opacity="0.25"/>
  ${hero}
  <text x="600" y="1085" text-anchor="middle" font-family="Georgia, serif" font-size="44" fill="${p}">${brand.name}</text>
</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
