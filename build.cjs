/** Produce a standalone game from the maintained source files. No dependencies. */
const fs = require("node:fs");
const path = require("node:path");
const read = (name) => fs.readFileSync(path.join(__dirname, name), "utf8");
let html = read("index.html");
html = html.replace(
  /<link\s+rel="stylesheet"\s+href="style.css(?:\?[^"<>]*)?"\s*\/?>/,
  () => `<style>\n${read("style.css")}\n</style>`,
);
for (const file of ["engine.js", "game.js"]) {
  const sourceTag = html.match(new RegExp(`<script src="${file.replace('.', '\\.')}(?:\\?[^"<>]*)?"></script>`))?.[0];
  if (!sourceTag) throw new Error(`Missing source tag: ${file}`);
  if (!html.includes(sourceTag)) throw new Error(`Missing source tag: ${file}`);
  html = html.replace(sourceTag, () => `<script>\n${read(file)}\n</script>`);
}
const cover = fs
  .readFileSync(path.join(__dirname, "assets", "tideglass-cover-v1.webp"))
  .toString("base64");
html = html.replaceAll(
  "assets/tideglass-cover-v1.webp",
  `data:image/webp;base64,${cover}`,
);
if (html.includes("script src=") || html.includes('href="style.css"'))
  throw new Error("Incomplete standalone build");
fs.writeFileSync(path.join(__dirname, "TIDEGLASS.html"), html);
console.log("Built TIDEGLASS.html");
