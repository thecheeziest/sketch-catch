#!/bin/bash
# 로컬 인프라(PostgreSQL + Redis) 상태를 확인하고 필요하면 컨테이너를 시작한다.
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

if ! command -v colima &>/dev/null; then
  echo "❌ Colima가 설치되어 있지 않습니다."
  echo "   설치: brew install colima docker"
  exit 1
fi

if ! colima status 2>/dev/null | grep -q "colima is running"; then
  echo "▶ Colima 시작 중..."
  colima start
fi

echo "▶ DB/Redis 컨테이너 확인 중..."
docker compose -f "$ROOT_DIR/docker-compose.yml" up -d
