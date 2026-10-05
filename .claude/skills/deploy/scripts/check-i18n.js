const en = require("../../../../apps/web/messages/en.json");
const sk = require("../../../../apps/web/messages/sk.json");

function keys(o, p) {
  p = p || "";
  return Object.keys(o).flatMap(function (k) {
    var path = p ? p + "." + k : k;
    return typeof o[k] === "object" && o[k] !== null ? keys(o[k], path) : [path];
  });
}

var kEn = keys(en);
var kSk = keys(sk);
var sEn = new Set(kEn);
var sSk = new Set(kSk);
var missing = kEn.filter(function (k) { return !sSk.has(k); });
var extra = kSk.filter(function (k) { return !sEn.has(k); });

if (missing.length || extra.length) {
  console.error("i18n asymmetry detected!", JSON.stringify({ missing: missing, extra: extra }));
  process.exit(1);
} else {
  console.log("i18n 100% symmetric (" + kEn.length + " keys)");
}
