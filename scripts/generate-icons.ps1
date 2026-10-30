Add-Type -AssemblyName System.Drawing

function Draw-FontStudioIcon([int]$size) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
    $g.Clear([System.Drawing.Color]::Transparent)

    $scale = $size / 256.0
    
    # 1. Background Squircle / Rounded Rectangle
    $margin = 12.0 * $scale
    $rectWidth = $size - (2.0 * $margin)
    $radius = 48.0 * $scale
    
    $bgPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $radius * 2.0
    $bgPath.AddArc($margin, $margin, $d, $d, 180, 90)
    $bgPath.AddArc($margin + $rectWidth - $d, $margin, $d, $d, 270, 90)
    $bgPath.AddArc($margin + $rectWidth - $d, $margin + $rectWidth - $d, $d, $d, 0, 90)
    $bgPath.AddArc($margin, $margin + $rectWidth - $d, $d, $d, 90, 90)
    $bgPath.CloseFigure()

    # Drop shadow for squircle
    if ($size -ge 32) {
        $shadowColor = [System.Drawing.Color]::FromArgb(70, 0, 0, 0)
        $shadowBrush = New-Object System.Drawing.SolidBrush($shadowColor)
        $shadowPath = New-Object System.Drawing.Drawing2D.GraphicsPath
        $sOff = 4.0 * $scale
        $shadowPath.AddArc($margin, $margin + $sOff, $d, $d, 180, 90)
        $shadowPath.AddArc($margin + $rectWidth - $d, $margin + $sOff, $d, $d, 270, 90)
        $shadowPath.AddArc($margin + $rectWidth - $d, $margin + $rectWidth - $d + $sOff, $d, $d, 0, 90)
        $shadowPath.AddArc($margin, $margin + $rectWidth - $d + $sOff, $d, $d, 90, 90)
        $shadowPath.CloseFigure()
        $g.FillPath($shadowBrush, $shadowPath)
        $shadowBrush.Dispose()
        $shadowPath.Dispose()
    }

    # Background gradient: Indigo-900 (#1e1b4b) to Slate-950 (#090d16)
    $cTop = [System.Drawing.Color]::FromArgb(255, 30, 27, 75)
    $cBottom = [System.Drawing.Color]::FromArgb(255, 10, 15, 30)
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.PointF(0, $margin)),
        (New-Object System.Drawing.PointF(0, $size - $margin)),
        $cTop,
        $cBottom
    )
    $g.FillPath($bgBrush, $bgPath)
    $bgBrush.Dispose()

    # Outer border: Glowing Indigo/Cyan
    $borderColor = [System.Drawing.Color]::FromArgb(180, 99, 102, 241) # #6366f1
    $borderPen = New-Object System.Drawing.Pen($borderColor, [Math]::Max(1.0, 3.0 * $scale))
    $g.DrawPath($borderPen, $bgPath)
    $borderPen.Dispose()

    # 2. Typography Guide Lines (Subtle grid in background)
    if ($size -ge 48) {
        $gridPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(40, 99, 102, 241), [Math]::Max(1.0, 1.0 * $scale))
        $gridPen.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash
        # Cap height line
        $g.DrawLine($gridPen, 35.0 * $scale, 65.0 * $scale, 221.0 * $scale, 65.0 * $scale)
        # Mean line
        $g.DrawLine($gridPen, 35.0 * $scale, 128.0 * $scale, 221.0 * $scale, 128.0 * $scale)
        # Baseline
        $g.DrawLine($gridPen, 35.0 * $scale, 195.0 * $scale, 221.0 * $scale, 195.0 * $scale)
        $gridPen.Dispose()
    }

    # 3. Main Letter "F" Shape (Stylized Vector Glyph)
    $fPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    
    # Stem: X: 64 to 98
    # Top bar: Y: 60 to 92, X: 64 to 196
    # Crossbar: Y: 124 to 154, X: 64 to 166
    # Stem bottom: Y: 60 to 200
    
    $p1 = New-Object System.Drawing.PointF(64.0 * $scale, 60.0 * $scale)
    $p2 = New-Object System.Drawing.PointF(196.0 * $scale, 60.0 * $scale)
    $p3 = New-Object System.Drawing.PointF(196.0 * $scale, 94.0 * $scale)
    $p4 = New-Object System.Drawing.PointF(102.0 * $scale, 94.0 * $scale)
    $p5 = New-Object System.Drawing.PointF(102.0 * $scale, 124.0 * $scale)
    $p6 = New-Object System.Drawing.PointF(168.0 * $scale, 124.0 * $scale)
    $p7 = New-Object System.Drawing.PointF(168.0 * $scale, 154.0 * $scale)
    $p8 = New-Object System.Drawing.PointF(102.0 * $scale, 154.0 * $scale)
    $p9 = New-Object System.Drawing.PointF(102.0 * $scale, 200.0 * $scale)
    $p10 = New-Object System.Drawing.PointF(64.0 * $scale, 200.0 * $scale)

    $points = [System.Drawing.PointF[]]@($p1, $p2, $p3, $p4, $p5, $p6, $p7, $p8, $p9, $p10)
    $fPath.AddPolygon($points)

    # Letter Gradient: Electric Indigo (#818cf8) to Vibrant Cyan (#38bdf8)
    $fGrad = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.PointF(64.0 * $scale, 60.0 * $scale)),
        (New-Object System.Drawing.PointF(196.0 * $scale, 200.0 * $scale)),
        [System.Drawing.Color]::FromArgb(255, 255, 255, 255),
        [System.Drawing.Color]::FromArgb(255, 199, 210, 254) # Indigo-200
    )
    $g.FillPath($fGrad, $fPath)
    $fGrad.Dispose()

    # 4. Accent Vector Crossbar Overlay in Electric Cyan / Purple
    $accentBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.PointF(64.0 * $scale, 124.0 * $scale)),
        (New-Object System.Drawing.PointF(175.0 * $scale, 154.0 * $scale)),
        [System.Drawing.Color]::FromArgb(255, 99, 102, 241),
        [System.Drawing.Color]::FromArgb(255, 56, 189, 248) # Cyan-400
    )
    $accentRect = New-Object System.Drawing.RectangleF(64.0 * $scale, 124.0 * $scale, 104.0 * $scale, 30.0 * $scale)
    $g.FillRectangle($accentBrush, $accentRect)
    $accentBrush.Dispose()

    # 5. Typographic Bezier Nodes / Anchors (Precision Studio aesthetic)
    if ($size -ge 48) {
        $nodeBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 56, 189, 248))
        $nodePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 15, 23, 42), [Math]::Max(1.0, 1.5 * $scale))
        $nodeSize = 10.0 * $scale
        
        $nodePoints = @(
            (New-Object System.Drawing.PointF(196.0 * $scale, 60.0 * $scale)),
            (New-Object System.Drawing.PointF(168.0 * $scale, 124.0 * $scale)),
            (New-Object System.Drawing.PointF(64.0 * $scale, 60.0 * $scale)),
            (New-Object System.Drawing.PointF(64.0 * $scale, 200.0 * $scale))
        )

        foreach ($np in $nodePoints) {
            $nr = New-Object System.Drawing.RectangleF($np.X - ($nodeSize / 2.0), $np.Y - ($nodeSize / 2.0), $nodeSize, $nodeSize)
            $g.FillEllipse($nodeBrush, $nr)
            $g.DrawEllipse($nodePen, $nr)
        }
        $nodeBrush.Dispose()
        $nodePen.Dispose()
    }

    # 6. Sparkle / Studio Accent Star in Top Right
    if ($size -ge 64) {
        $starBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
            (New-Object System.Drawing.PointF(185.0 * $scale, 25.0 * $scale)),
            (New-Object System.Drawing.PointF(225.0 * $scale, 65.0 * $scale)),
            [System.Drawing.Color]::FromArgb(255, 250, 204, 21), # Amber/Gold
            [System.Drawing.Color]::FromArgb(255, 244, 63, 94)   # Rose-500
        )
        $starPath = New-Object System.Drawing.Drawing2D.GraphicsPath
        $cx = 205.0 * $scale
        $cy = 45.0 * $scale
        $rOuter = 16.0 * $scale
        $rInner = 5.0 * $scale
        
        $starPoints = New-Object System.Collections.Generic.List[System.Drawing.PointF]
        for ($i = 0; $i -lt 8; $i++) {
            $angle = ($i * [Math]::PI / 4.0) - ([Math]::PI / 2.0)
            $r = if ($i % 2 -eq 0) { $rOuter } else { $rInner }
            $starPoints.Add((New-Object System.Drawing.PointF($cx + ($r * [Math]::Cos($angle)), $cy + ($r * [Math]::Sin($angle)))))
        }
        $starPath.AddPolygon($starPoints.ToArray())
        $g.FillPath($starBrush, $starPath)
        $starBrush.Dispose()
        $starPath.Dispose()
    }

    $fPath.Dispose()
    $bgPath.Dispose()
    $g.Dispose()

    return $bmp
}

# Generate PNGs and packed ICO
$sizes = @(256, 128, 64, 48, 32, 24, 16)
$pngBytesList = @()

foreach ($sz in $sizes) {
    $bmp = Draw-FontStudioIcon -size $sz
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $pngBytesList += ,$ms.ToArray()
    $ms.Dispose()
    $bmp.Dispose()
}

# Create build directory
if (!(Test-Path "build")) {
    New-Item -ItemType Directory -Path "build" | Out-Null
}
if (!(Test-Path "resources")) {
    New-Item -ItemType Directory -Path "resources" | Out-Null
}

# Save 512x512 Master PNG and 256x256 PNG
$masterBmp = Draw-FontStudioIcon -size 512
$masterBmp.Save("build/icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$masterBmp.Save("resources/icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
$masterBmp.Dispose()

# Pack multi-resolution .ico
$icoMs = New-Object System.IO.MemoryStream
$writer = New-Object System.IO.BinaryWriter($icoMs)

# ICONDIR header (6 bytes)
$writer.Write([uint16]0) # Reserved
$writer.Write([uint16]1) # Type (1 = ICO)
$writer.Write([uint16]$sizes.Count) # Count

# Header is 6 bytes + (16 bytes * count)
$offset = 6 + (16 * $sizes.Count)

for ($i = 0; $i -lt $sizes.Count; $i++) {
    $sz = $sizes[$i]
    $data = $pngBytesList[$i]
    
    $w = if ($sz -ge 256) { 0 } else { [byte]$sz }
    $h = if ($sz -ge 256) { 0 } else { [byte]$sz }
    
    $writer.Write([byte]$w)
    $writer.Write([byte]$h)
    $writer.Write([byte]0)   # Color count (0 = 256+)
    $writer.Write([byte]0)   # Reserved
    $writer.Write([uint16]1) # Color planes
    $writer.Write([uint16]32)# Bit count (32bpp)
    $writer.Write([uint32]$data.Length) # Bytes in resource
    $writer.Write([uint32]$offset)      # Offset of image data
    
    $offset += $data.Length
}

# Write PNG datas
for ($i = 0; $i -lt $sizes.Count; $i++) {
    $writer.Write($pngBytesList[$i])
}

$writer.Flush()
$icoBytes = $icoMs.ToArray()
[System.IO.File]::WriteAllBytes("build/icon.ico", $icoBytes)
[System.IO.File]::WriteAllBytes("resources/icon.ico", $icoBytes)

$writer.Dispose()
$icoMs.Dispose()

Write-Host "Successfully created build/icon.ico ($(Get-Item 'build/icon.ico').Length bytes) and build/icon.png ($(Get-Item 'build/icon.png').Length bytes)!"

