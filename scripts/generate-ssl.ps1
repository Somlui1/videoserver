# Generate self-signed SSL certificate for development/testing on Windows
$SSL_DIR = Join-Path (Get-Item -Path $PSScriptRoot).Parent.FullName "nginx/ssl"
If (!(Test-Path $SSL_DIR)) {
    New-Item -ItemType Directory -Path $SSL_DIR
}

Write-Host "[SSL] Generating self-signed SSL certificate for Nginx..." -ForegroundColor Green

# 1. Try to find openssl in PATH
$openssl = Get-Command openssl -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source

# 2. If not found, try common Git for Windows paths
if (!$openssl) {
    $commonPaths = @(
        "$env:ProgramFiles\Git\usr\bin\openssl.exe",
        "${env:ProgramFiles(x86)}\Git\usr\bin\openssl.exe"
    )
    foreach ($p in $commonPaths) {
        if (Test-Path $p) {
            $openssl = $p
            break
        }
    }
}

If ($openssl) {
    Write-Host "   Using openssl from: $openssl"
    & $openssl req -x509 -nodes -days 365 -newkey rsa:2048 `
        -keyout (Join-Path $SSL_DIR "server.key") `
        -out (Join-Path $SSL_DIR "server.crt") `
        -subj "/C=TH/ST=Bangkok/O=AAPICO/CN=video-server" `
        -addext "subjectAltName=DNS:localhost,DNS:*.localhost,IP:127.0.0.1,IP:0.0.0.0"
}
Else {
    Write-Host "[ERROR] openssl.exe not found in PATH or Git folder." -ForegroundColor Red
    Write-Host "   Please ensure Git for Windows is installed in the default directory."
    Exit 1
}

If (Test-Path (Join-Path $SSL_DIR "server.crt")) {
    Write-Host "`n[SUCCESS] SSL certificate generated successfully!" -ForegroundColor Green
    Write-Host "   Certificate: $(Join-Path $SSL_DIR 'server.crt')"
    Write-Host "   Private Key: $(Join-Path $SSL_DIR 'server.key')"
}
Else {
    Write-Host "[FAILED] Failed to generate certificates." -ForegroundColor Red
}
