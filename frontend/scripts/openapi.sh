#!/bin/sh

set -e

gen_path="./lib/api/generated"
mkdir -p "$gen_path"

npx openapi-generator-cli generate \
  -i http://localhost:5009/swagger/v1/swagger.json \
  -o "$gen_path" \
  -g typescript-fetch

# find all *.ts file and add @ts-nocheck except for client.ts
find "$gen_path" \
  -name '*.ts' \
  ! -name 'client.ts' \
  -exec sh -c '
    grep -q "@ts-nocheck" "$1" ||
      sed -i "1i// @ts-nocheck" "$1"
  ' _ {} \;
