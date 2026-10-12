// Regenerates src/lib/roomHtml.ts from room-live.html (the Home screen's
// recoloured copy of the original room.html).
// Run after editing room-live.html: node scripts/generate-room-html.js
// Uses JSON.stringify so the HTML's own backticks/${...} template literals
// can never break out of the generated TS string.
const fs = require("fs");
const path = require("path");

const htmlPath = path.join(__dirname, "..", "room-live.html");
const outPath = path.join(__dirname, "..", "src", "lib", "roomHtml.ts");

const html = fs.readFileSync(htmlPath, "utf8");

const output = `// GENERATED FILE -- do not edit by hand.
// Regenerate with: node scripts/generate-room-html.js
export const ROOM_HTML = ${JSON.stringify(html)};
`;

fs.writeFileSync(outPath, output, "utf8");
console.log(`Wrote ${outPath} (${html.length} chars of HTML)`);
