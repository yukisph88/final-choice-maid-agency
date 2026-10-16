# Final Choice - private review launcher (Windows). Serves the "site" folder on THIS computer only
# (http://localhost:PORT) and opens it in the browser. Nothing is installed and nothing leaves this computer.
# Close this window to stop it.
param([int]$Port = 4330, [switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$root = Join-Path $PSScriptRoot 'site'
if (-not (Test-Path (Join-Path $root 'en\index.html'))) { Write-Host 'The "site" folder is missing. Extract the whole zip first, then start again.' -ForegroundColor Red; Read-Host 'Press Enter to close'; exit 1 }

$types = @{ '.html'='text/html; charset=utf-8'; '.css'='text/css'; '.js'='text/javascript'; '.json'='application/json'; '.webp'='image/webp'; '.png'='image/png'; '.jpg'='image/jpeg'; '.jpeg'='image/jpeg'; '.svg'='image/svg+xml'; '.ico'='image/x-icon'; '.woff'='font/woff'; '.woff2'='font/woff2'; '.xml'='application/xml'; '.txt'='text/plain; charset=utf-8'; '.webmanifest'='application/manifest+json' }

$listener = $null
foreach ($p in $Port..($Port + 20)) {
  $try = New-Object System.Net.HttpListener
  $try.Prefixes.Add("http://localhost:$p/")
  try { $try.Start(); $listener = $try; $Port = $p; break } catch { $try.Close() }
}
if (-not $listener) { Write-Host 'Could not open a local port. Ask IT or see README.txt (Python option).' -ForegroundColor Red; Read-Host 'Press Enter to close'; exit 1 }

$url = "http://localhost:$Port/en/"
Write-Host ''
Write-Host '  FINAL CHOICE - PRIVATE REVIEW (not published)' -ForegroundColor Cyan
Write-Host "  Open: $url   (English)    http://localhost:$Port/ms/   (Bahasa Melayu)"
Write-Host '  Keep this window open while you browse. Close it to stop.'
Write-Host ''
if (-not $NoBrowser) { Start-Process $url }

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  try {
    $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
    if ($path.Contains('..')) { $ctx.Response.StatusCode = 400; $ctx.Response.Close(); continue }
    $file = Join-Path $root ($path.TrimStart('/').Replace('/', '\'))
    if (Test-Path $file -PathType Container) { $file = Join-Path $file 'index.html' }
    if (Test-Path $file -PathType Leaf) {
      $bytes = [IO.File]::ReadAllBytes($file)
      $ext = [IO.Path]::GetExtension($file).ToLower()
      $ctx.Response.ContentType = $(if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' })
      $ctx.Response.Headers.Add('Cache-Control', 'no-store')
    } else {
      $nf = Join-Path $root '404.html'
      $ctx.Response.StatusCode = 404
      $bytes = $(if (Test-Path $nf) { [IO.File]::ReadAllBytes($nf) } else { [Text.Encoding]::UTF8.GetBytes('Not found') })
      $ctx.Response.ContentType = 'text/html; charset=utf-8'
    }
    $ctx.Response.ContentLength64 = $bytes.Length
    $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  } catch { } finally { try { $ctx.Response.Close() } catch { } }
}
