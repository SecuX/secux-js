# SecuX Wallet JS SDK

This package is for connecting with SecuX hardware wallet.

## Requirements

- [Node.js](https://nodejs.org/en/download/) version >= `14` or above (which can be checked by running `node -v`). You can use nvm for managing multiple Node versions on a single machine installed.

## Build

Install dependencies from the repository root. This repository does not require a `package-lock.json`.

```bash
npm install --include=dev --package-lock=false
```

After installation, `npx lerna` uses the Lerna executable installed in the root `node_modules`.

### Build all packages

Run the normal build for every package, followed by the protocol-device DFU build:

```bash
sh setup.sh
```

The Flutter-specific app-sui bundle is not included in `setup.sh` and must be built separately.

### Build one package

If its dependencies have already been built:

```bash
npx lerna run build \
    --scope "@secux/<package-name>" \
    --stream
```

For example:

```bash
npx lerna run build \
    --scope @secux/app-sui \
    --stream
```

### Build one package from a clean environment

Include and build all transitive dependencies before the selected package:

```bash
npx lerna run build \
    --scope "@secux/<package-name>" \
    --include-dependencies \
    --stream
```

Lerna sorts builds topologically by default, so dependencies are built before the selected package.

### Validate packages affected by a dependency change

When changing a lower-level package, include both its dependencies and all packages that depend on it:

```bash
npx lerna run build \
    --scope @secux/utility \
    --include-dependencies \
    --include-dependents \
    --stream
```

### Build the app-sui Flutter bundle

The Flutter production bundle, debug bundle, typecheck, and compatibility verification use a separate build:

```bash
npm run build:flutter:all --workspace @secux/app-sui
```

## Test

In root of downloaded secux-js package, use below command to run all unit tests.

```bash
npm run test:webusb
```

You can also run a test under sub-package folder.

## Released NPM

https://www.npmjs.com/search?q=%40secux
