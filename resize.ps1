Add-Type -AssemblyName System.Drawing
$path = 'C:\Users\abhin\OneDrive\Desktop\TruetimeExtension'
$image = [System.Drawing.Image]::FromFile("$path\icon.png")

foreach ($size in 16, 48, 128) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bmp)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.DrawImage($image, 0, 0, $size, $size)
    $bmp.Save("$path\icon$size.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $graphics.Dispose()
    $bmp.Dispose()
}
$image.Dispose()
