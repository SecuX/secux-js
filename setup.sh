#!/bin/sh

set -eu

BUILD_CONCURRENCY=${BUILD_CONCURRENCY:-2}

npm install --include=dev --package-lock=false

npx lerna run build \
    --concurrency "$BUILD_CONCURRENCY" \
    --stream

npx lerna run build:dfu \
    --concurrency 1 \
    --stream \
    --scope @secux/protocol-device
