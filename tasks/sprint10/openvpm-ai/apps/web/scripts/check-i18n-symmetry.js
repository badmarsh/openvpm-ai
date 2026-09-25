const en = require("../messages/en.json");
const sk = require("../messages/sk.json");

function keys(obj, prefix) {
  return Object.keys(obj).flatMap((k) => {
    const path = prefix ? `${prefix}.${k}` : k;
    return typeof obj[k] === "object" && obj[k] !== null
      ? keys(obj[k], path)
      : [path];
  });
}

const a = keys(en.settings.booking, "settings.booking");
const b = keys(sk.settings.booking, "settings.booking");

console.log("en booking keys:", a.length);
console.log("sk booking keys:", b.length);
console.log("missing in sk:", a.filter((x) => !b.includes(x)));
console.log("extra in sk:", b.filter((x) => !a.includes(x)));
