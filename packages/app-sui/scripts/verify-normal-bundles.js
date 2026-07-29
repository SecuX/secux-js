"use strict";

const fs = require("fs");
const path = require("path");

const packageRoot = path.resolve(__dirname, "..");
const requiredFiles = [
    "dist/index.js",
    "lib/app-sui.js",
    "lib/app-sui.d.ts",
    "lib/interface.js",
    "lib/interface.d.ts",
    "lib/polyfill.js",
    "lib/polyfill.d.ts",
    "lib/utils.js",
    "lib/utils.d.ts",
];

let failed = false;

for (const relativePath of requiredFiles) {
    const filePath = path.resolve(packageRoot, relativePath);
    if (!fs.existsSync(filePath)) {
        console.error(`Missing normal app-sui build output: ${relativePath}`);
        failed = true;
    }
}

const commonjsPath = path.resolve(packageRoot, "lib/app-sui.js");
if (fs.existsSync(commonjsPath)) {
    const source = fs.readFileSync(commonjsPath, "utf8");

    if (!source.includes("module.exports")) {
        console.error("FAIL lib/app-sui.js: CommonJS export was not generated");
        failed = true;
    }

    if (/\brequire\s*\(\s*["']@mysten\//.test(source)) {
        console.error("FAIL lib/app-sui.js: ESM-only @mysten dependency remains external");
        failed = true;
    }
}

if (failed) {
    process.exitCode = 1;
} else {
    console.log("OK normal app-sui UMD, bundled CommonJS, and declarations");
}
