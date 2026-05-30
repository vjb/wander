Add-Type -AssemblyName System.Drawing
$a = 'c:\Users\vjbel\hacks\wander\assets'
$files = @(
    "screenshot-01-landing.png",
    "screenshot-02-presets.png",
    "screenshot-03-form-filled.png",
    "screenshot-04-route.png",
    "screenshot-05-stops.png"
)
foreach ($f in $files) {
    $path = Join-Path $a $f
    $img = [System.Drawing.Image]::FromFile($path)
    Write-Host "$f : $($img.Width) x $($img.Height)"
    $img.Dispose()
}
