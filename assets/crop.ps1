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

# 01-landing: 2556x1513. Center the full hero+card. Hero starts at ~x=460, card ends ~x=1760
Crop-Img "$a\screenshot-01-landing.png" "$a\crop-01-landing.png" 460 20 1300 1150

# 02-presets: 2556x1777. App card center: card left ~770, right ~1790
Crop-Img "$a\screenshot-02-presets.png" "$a\crop-02-presets.png" 760 15 1040 1380

# 03-form-filled: same card position, content starts a bit lower
Crop-Img "$a\screenshot-03-form-filled.png" "$a\crop-03-form-filled.png" 760 200 1040 1200

# 04-route: content left ~640, right ~1640, full height to 1700
Crop-Img "$a\screenshot-04-route.png" "$a\crop-04-route.png" 640 0 1000 1680

# 05-stops: same crop as 04
Crop-Img "$a\screenshot-05-stops.png" "$a\crop-05-stops.png" 640 0 1000 1700
