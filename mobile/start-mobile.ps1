$ErrorActionPreference = "Stop"

$network = Get-NetIPConfiguration |
  Where-Object {
    $_.NetAdapter.Status -eq "Up" -and
    $_.IPv4DefaultGateway -and
    $_.IPv4Address -and
    $_.InterfaceAlias -match "Wi-Fi|Wireless"
  } |
  Select-Object -First 1

if (-not $network) {
  $network = Get-NetIPConfiguration |
    Where-Object {
      $_.NetAdapter.Status -eq "Up" -and
      $_.IPv4DefaultGateway -and
      $_.IPv4Address
    } |
    Select-Object -First 1
}

$address = $network.IPv4Address |
  Where-Object { $_.IPAddress -notlike "169.254.*" } |
  Select-Object -First 1

if (-not $address) {
  throw "No active Wi-Fi IPv4 address found. Connect this laptop to the same Wi-Fi as your phone, then try again."
}

$ip = $address.IPAddress
$env:REACT_NATIVE_PACKAGER_HOSTNAME = $ip
$env:EXPO_PUBLIC_API_URL = "http://${ip}:5000"

Set-Location $PSScriptRoot
Write-Host "Expo QR and app API will use http://${ip}:5000"
npx expo start --lan --clear
