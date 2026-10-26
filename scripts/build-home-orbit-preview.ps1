$ErrorActionPreference = 'Stop'
$sourceRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$buildRoot = 'C:\tmp\fluxring-current-home'
if ((Resolve-Path -LiteralPath $buildRoot).Path -ne $buildRoot) { throw 'Unexpected build checkout path' }
$artifactDir = Join-Path $sourceRoot '..\..\artifacts\fluxringapp\home-starlight-depth'
New-Item -ItemType Directory -Force -Path $artifactDir | Out-Null
$changedFiles = @(
  'components\HomeStarlight.tsx', 'lib\i18n.tsx', 'components\HomeOrbit.tsx', 'components\HomeCosmos.tsx', 'components\CardSurface.tsx',
  'lib\homeOrbitPreview.ts', 'lib\backdropMode.ts', 'lib\homeCardShaders.ts',
  'screens\DiscoverScreen.tsx', 'screens\BackgroundLayersScreen.tsx',
  'components\HomeNebulaSpace.tsx', 'lib\homeNebulaSpace.ts', 'components\HomeStarfield.tsx', 'components\HomeNebulaRing.tsx', 'components\BackdropVeil.tsx',
  'lib\homeWatercolorTexture.ts', 'lib\homeAmbientModel.ts', 'lib\homePinkNoise.ts', 'lib\homeStarfieldModel.ts', 'lib\homeStarfieldImages.ts', 'lib\useHomeAmbientMotion.ts'
)
foreach ($relative in $changedFiles) {
  $target = Join-Path $buildRoot $relative
  $backup = Join-Path $artifactDir ('build-source-before\' + $relative)
  if ((Test-Path -LiteralPath $target) -and !(Test-Path -LiteralPath $backup)) {
    New-Item -ItemType Directory -Force -Path (Split-Path $backup) | Out-Null
    Copy-Item -LiteralPath $target -Destination $backup
  }
  Copy-Item -LiteralPath (Join-Path $sourceRoot $relative) -Destination $target
}
$gradleFile = Join-Path $buildRoot 'android\app\build.gradle'
$gradleText = Get-Content -LiteralPath $gradleFile -Raw
if ($gradleText -notmatch "applicationId 'com.fluxring.app.homepreview'") { throw 'Expected isolated HOME preview package' }
$versionCode = [int][Math]::Floor(([DateTimeOffset]::UtcNow.ToUnixTimeSeconds() - 1577836800) / 60)
$gradleText = $gradleText -replace 'versionCode \d+', "versionCode $versionCode"
Set-Content -LiteralPath $gradleFile -Value $gradleText -Encoding utf8NoBOM
$env:JAVA_HOME = 'C:\Users\tsuba\AppData\Local\Programs\jdk-17.0.20.1'
$env:ANDROID_HOME = 'C:\Users\tsuba\AppData\Local\Android\Sdk'
$env:APP_VARIANT = 'verify'
Push-Location (Join-Path $buildRoot 'android')
try {
  & '.\gradlew.bat' assembleRelease --offline '-PreactNativeArchitectures=arm64-v8a' "-Porg.gradle.java.installations.paths=$env:JAVA_HOME" '-Porg.gradle.java.installations.auto-download=false' --console=plain *> (Join-Path $artifactDir 'build.log')
  if ($LASTEXITCODE -ne 0) {
    Get-Content -LiteralPath (Join-Path $artifactDir 'build.log') -Tail 70
    throw 'Android build failed'
  }
} finally { Pop-Location }
$apkPath = Join-Path $artifactDir 'FluxRing-HOME-starlight-depth-arm64.apk'
Copy-Item -LiteralPath (Join-Path $buildRoot 'android\app\build\outputs\apk\release\app-release.apk') -Destination $apkPath
@{ package = 'com.fluxring.app.homepreview'; versionCode = $versionCode; sha256 = (Get-FileHash -LiteralPath $apkPath -Algorithm SHA256).Hash; files = $changedFiles } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $artifactDir 'build-info.json') -Encoding utf8NoBOM
Write-Output "APK: $apkPath"
Get-Content -LiteralPath (Join-Path $artifactDir 'build.log') -Tail 4
