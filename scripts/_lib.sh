#!/usr/bin/env bash

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

usage_for() {
  local action="$1"
  cat <<EOF
Usage:
  scripts/$action <module> [args...]

Modules:
  repo              Whole repository aggregate.
  frontend          Employee workbench and Agent Copilot UI in apps/frontend.
  backend           Backend skeleton, Prisma schema, and application services.
  extension         Browser extension in apps/extension.
  agent-workbench   Agent Copilot workbench surface, backed by frontend + backend.

Aliases:
  all -> repo
  plugin, browser-extension -> extension
  employee-workbench, admin -> frontend
  agent, hermes -> agent-workbench
EOF
}

normalize_module() {
  case "${1:-repo}" in
    all)
      printf '%s\n' "repo"
      ;;
    plugin|browser-extension)
      printf '%s\n' "extension"
      ;;
    employee-workbench|admin)
      printf '%s\n' "frontend"
      ;;
    agent|hermes)
      printf '%s\n' "agent-workbench"
      ;;
    repo|frontend|backend|extension|agent-workbench)
      printf '%s\n' "$1"
      ;;
    *)
      printf 'Unknown module: %s\n' "$1" >&2
      return 2
      ;;
  esac
}

require_package_script() {
  local dir="$1"
  local script="$2"

  node -e '
const fs = require("fs");
const pkg = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
process.exit(pkg.scripts && pkg.scripts[process.argv[2]] ? 0 : 1);
' "$dir/package.json" "$script"
}

run_package_script() {
  local dir="$1"
  local script="$2"
  shift 2

  if [[ ! -f "$dir/package.json" ]]; then
    printf 'package.json not found: %s\n' "$dir" >&2
    return 1
  fi

  if ! require_package_script "$dir" "$script"; then
    printf 'Package script "%s" is not defined in %s/package.json.\n' "$script" "$dir" >&2
    return 1
  fi

  if [[ -f "$dir/pnpm-lock.yaml" || "$dir" == "$ROOT_DIR/apps/frontend" ]]; then
    pnpm --dir "$dir" "$script" "$@"
  elif [[ -f "$dir/package-lock.json" ]]; then
    (cd "$dir" && npm run "$script" -- "$@")
  else
    pnpm --dir "$dir" "$script" "$@"
  fi
}

run_backend_typecheck() {
  local prisma_schema="$ROOT_DIR/apps/backend/prisma/schema.prisma"

  if [[ -f "$prisma_schema" ]]; then
    npx --yes prisma validate --schema "$prisma_schema"
  fi

  local backend_ts_files=()
  if [[ -d "$ROOT_DIR/apps/backend/src" ]]; then
    while IFS= read -r file; do
      backend_ts_files+=("$file")
    done < <(find "$ROOT_DIR/apps/backend/src" -type f -name '*.ts' ! -path "$ROOT_DIR/apps/backend/src/generated/prisma/*" | sort)
  fi

  if ((${#backend_ts_files[@]})); then
    npx --yes -p typescript tsc \
      --noEmit \
      --strict \
      --module Node16 \
      --moduleResolution node16 \
      --target es2022 \
      "${backend_ts_files[@]}"
  else
    printf '%s\n' "No backend TypeScript files found; validated Prisma schema only."
  fi
}
