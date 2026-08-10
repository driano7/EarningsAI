import fs from "fs";
const vals = {};
for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
  process.env[m[1]] = v;
}
const { kv } = await import("@vercel/kv");
const keys = [];
for await (const k of kv.scanIterator({ match: "chatbot:prebuilt:*" })) keys.push(k);
for (const k of keys) await kv.del(k);
console.log("deleted prebuilt:", keys.length);
process.exit(0);
