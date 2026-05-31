Add-Type -AssemblyName System.Drawing

function Crop-Img {
    param($src, $dst, $x, $y, $w, $h)
    $img = [System.Drawing.Image]::FromFile($src)
    $bmp = New-Object System.Drawing.Bitmap($w, $h)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $srcRect = New-Object System.Drawing.Rectangle($x, $y, $w, $h)
    $dstRect = New-Object System.Drawing.Rectangle(0, 0, $w, $h)
    $g.DrawImage($img, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
    $g.Dispose()
    $img.Dispose()
    $bmp.Save($dst, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Saved $dst"
}

$a = 'c:\Users\vjbel\hacks\wander\assets'

# Scaled coordinates for 1920x1057 screenshots

# 01-landing: Center the full hero + card
Crop-Img "$a\screenshot-01-landing.png" "$a\crop-01-landing.png" 340 15 980 860

# 03-form-filled: Form with custom options and vibe selected
Crop-Img "$a\screenshot-03-form-filled.png" "$a\crop-03-form-filled.png" 570 150 780 900

# 04-route: Route map + top header
Crop-Img "$a\screenshot-04-route.png" "$a\crop-04-route.png" 480 0 750 1057

# 05-stops: Timeline stop cards with swap menu open
Crop-Img "$a\screenshot-05-stops.png" "$a\crop-05-stops.png" 480 0 750 1057
