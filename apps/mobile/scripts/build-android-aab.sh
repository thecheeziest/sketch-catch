#!/usr/bin/env bash
# Play 업로드용 release AAB 로컬 빌드
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
KEY_DIR="${SKETCHCATCH_KEY_DIR:-$HOME/dev-keys/sketch-catch}"
STORE_FILE="$KEY_DIR/upload.jks"
SERVER_URL="${SKETCHCATCH_SERVER_URL:-https://sketch-catch-server.onrender.com}"

if [[ ! -f "$STORE_FILE" ]]; then
  echo "업로드 키가 없습니다: $STORE_FILE" >&2
  exit 1
fi

read_keychain() {
  security find-generic-password -a sketch-catch-upload -s "$1" -w
}

export JAVA_HOME="$(/usr/libexec/java_home -v 17)"
export EXPO_PUBLIC_API_URL="$SERVER_URL"
export EXPO_PUBLIC_SOCKET_URL="$SERVER_URL"
export ORG_GRADLE_PROJECT_SKETCHCATCH_UPLOAD_STORE_FILE="$STORE_FILE"
export ORG_GRADLE_PROJECT_SKETCHCATCH_UPLOAD_KEY_ALIAS="$(keytool -list -keystore "$STORE_FILE" -storepass "$(read_keychain sketchcatch-android-store-password)" | awk -F, '/PrivateKeyEntry/ {print $1; exit}')"
ORG_GRADLE_PROJECT_SKETCHCATCH_UPLOAD_STORE_PASSWORD="$(read_keychain sketchcatch-android-store-password)"
ORG_GRADLE_PROJECT_SKETCHCATCH_UPLOAD_KEY_PASSWORD="$(read_keychain sketchcatch-android-key-password)"
export ORG_GRADLE_PROJECT_SKETCHCATCH_UPLOAD_STORE_PASSWORD ORG_GRADLE_PROJECT_SKETCHCATCH_UPLOAD_KEY_PASSWORD

cd "$APP_DIR"
npx expo prebuild --platform android --clean --no-install
(cd android && ./gradlew :app:bundleRelease)

echo "AAB: $APP_DIR/android/app/build/outputs/bundle/release/app-release.aab"
