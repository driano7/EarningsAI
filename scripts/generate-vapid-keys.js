/*
 * Quartly Bot — scripts/generate-vapid-keys.ts
 * Copyright (c) Donovan Riaño. All rights reserved.
 * Use of this code requires prior authorization from the owner.
 *
 * Run: npx ts-node scripts/generate-vapid-keys.ts
 * Or: node -e "const webpush = require('web-push'); const keys = webpush.generateVAPIDKeys(); console.log(JSON.stringify(keys, null, 2));"
 */

const webPush = require("web-push");

const keys = webPush.generateVAPIDKeys();

console.log("=== VAPID Keys Generated ===");
console.log("");
console.log("Add these to your .env.local:");
console.log("");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY="${keys.publicKey}"`);
console.log(`VAPID_PRIVATE_KEY="${keys.privateKey}"`);
console.log("");
console.log("Then add to Vercel environment variables:");
console.log("- NEXT_PUBLIC_VAPID_PUBLIC_KEY (same as above)");
console.log("- VAPID_PRIVATE_KEY (same as above)");
