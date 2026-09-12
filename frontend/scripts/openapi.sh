#!/bin/sh

set -e

gen_path="./lib/api/generated"
mkdir -p "$gen_path"

# The running API is the source of truth, so it has to be up. Overridable because a second
# instance on another port is how you regenerate without stopping the one you are using:
#   API_URL=http://localhost:5019 npm run generate-api
api_url="${API_URL:-http://localhost:5009}"

if ! curl -sf "$api_url/swagger/v1/swagger.json" -o /dev/null; then
  echo "No API answering at $api_url." >&2
  echo "Start it with: dotnet run --project backend/backend.csproj" >&2
  echo "Or point this at another instance: API_URL=http://localhost:5019 npm run generate-api" >&2
  exit 1
fi

npx openapi-generator-cli generate \
  -i "$api_url/swagger/v1/swagger.json" \
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
