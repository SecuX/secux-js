#!/bin/sh

npx lerna clean
rm -rf node_modules
rm package-lock.json

npm install --include=dev
npx lerna run build