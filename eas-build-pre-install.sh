#!/usr/bin/env bash
# eas-build-pre-install.sh — EAS Build フック（npm install の前に実行される）
# ------------------------------------------------------------------
# google-services.json / GoogleService-Info.plist は .gitignore 対象
# （@react-native-firebase/app 導入時に追加。lib/remoteConfig.ts 参照）。
# リポジトリには含まれないため、EAS Build 環境では
#   eas secret:create --scope project --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json
#   eas secret:create --scope project --name GOOGLE_SERVICES_INFO_PLIST --type file --value ./GoogleService-Info.plist
# で登録したファイル型シークレットを、app.json が期待する相対パス
# （./google-services.json・./GoogleService-Info.plist）へこのフックでコピーする。
# シークレット未登録のビルドでも他のエラーを埋もれさせないよう、
# 無ければ警告だけ出して続行する（後段の config plugin が本来のエラーを出す）。

set -e

if [ -n "$GOOGLE_SERVICES_JSON" ] && [ -f "$GOOGLE_SERVICES_JSON" ]; then
  cp "$GOOGLE_SERVICES_JSON" ./google-services.json
  echo "eas-build-pre-install: google-services.json を配置しました"
else
  echo "eas-build-pre-install: 警告 — GOOGLE_SERVICES_JSON シークレットが未設定です"
fi

if [ -n "$GOOGLE_SERVICES_INFO_PLIST" ] && [ -f "$GOOGLE_SERVICES_INFO_PLIST" ]; then
  cp "$GOOGLE_SERVICES_INFO_PLIST" ./GoogleService-Info.plist
  echo "eas-build-pre-install: GoogleService-Info.plist を配置しました"
else
  echo "eas-build-pre-install: 警告 — GOOGLE_SERVICES_INFO_PLIST シークレットが未設定です"
fi
