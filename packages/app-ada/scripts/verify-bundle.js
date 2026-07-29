"use strict";

const fs = require("fs");
const path = require("path");

const bundlePath = path.resolve(__dirname, "../dist/index.js");

if (!fs.existsSync(bundlePath)) {
    throw new Error("Missing app-ada bundle: dist/index.js");
}

const source = fs.readFileSync(bundlePath, "utf8");
const wrapper = source.slice(0, 4096);

if (
    !wrapper.includes("typeof exports") ||
    !wrapper.includes("typeof module") ||
    !wrapper.includes("module.exports")
) {
    throw new Error(
        "app-ada UMD environment detection is not at the top level; QuickJS may incorrectly call require()"
    );
}

if (wrapper.includes("exports:{}")) {
    throw new Error(
        "app-ada bundle contains an esbuild synthetic CommonJS wrapper before the UMD factory"
    );
}

if (!source.includes("SecuxADA")) {
    throw new Error("app-ada bundle does not expose the SecuxADA library");
}

console.log(`OK app-ada standalone UMD bundle (${source.length} bytes)`);
