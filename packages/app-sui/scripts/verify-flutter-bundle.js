"use strict";

const fs = require("fs");
const path = require("path");
const acorn = require("acorn");

const packageRoot = path.resolve(__dirname, "..");
const targets = process.argv.slice(2);
const bundlePaths = targets.length > 0
    ? targets
    : ["dist/index.flutter.js", "dist-debug/index.flutter.js"];
const requiredRuntimePolyfills = [
    {
        name: "Object.hasOwn",
        pattern: /Object\.defineProperty\(Object,\s*["']hasOwn["']/,
    },
    {
        name: "Array.prototype.at",
        pattern: /Object\.defineProperty\(Array\.prototype,\s*["']at["']/,
    },
    {
        name: "structuredClone",
        pattern: /structuredClone/,
    },
];

let failed = false;

for (const relativePath of bundlePaths) {
    const bundlePath = path.resolve(packageRoot, relativePath);

    if (!fs.existsSync(bundlePath)) {
        console.error(`Missing Flutter bundle: ${relativePath}`);
        failed = true;
        continue;
    }

    const source = fs.readFileSync(bundlePath, "utf8");

    try {
        acorn.parse(source, {
            ecmaVersion: 2020,
            sourceType: "script",
            allowHashBang: true,
        });

        for (const polyfill of requiredRuntimePolyfills) {
            if (!polyfill.pattern.test(source)) {
                throw new Error(`missing QuickJS runtime polyfill: ${polyfill.name}`);
            }
        }

        if (/Object\.hasOwn\s*\(/.test(source)) {
            throw new Error("unsupported Object.hasOwn() call remains in bundle");
        }

        if (!source.includes('__SECUX_SUI_BUNDLE__')) {
            throw new Error("missing Flutter bundle identity marker");
        }

        console.log(`OK ${relativePath} (${source.length} bytes, ES2020 parse)`);
    } catch (error) {
        console.error(`FAIL ${relativePath}: ${error.message}`);
        failed = true;
    }
}

if (failed) {
    process.exitCode = 1;
}
