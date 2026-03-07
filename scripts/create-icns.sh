#!/bin/bash
#
# create-icns.sh
# Converts the SVG icon to a macOS .icns file using built-in macOS tools.
#
# Usage: ./scripts/create-icns.sh
#
# Requirements: macOS with sips and iconutil (both are built-in)
#

set -euo pipefail

# Resolve paths relative to the project root
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ASSETS_DIR="$PROJECT_DIR/assets"

SVG_FILE="$ASSETS_DIR/icon.svg"
PNG_1024="$ASSETS_DIR/icon_1024.png"
ICONSET_DIR="$ASSETS_DIR/icon.iconset"
ICNS_FILE="$ASSETS_DIR/icon.icns"

echo "=== English Reader Icon Generator ==="
echo ""

# --- Step 0: Check that the SVG exists ---
if [ ! -f "$SVG_FILE" ]; then
    echo "ERROR: SVG file not found at $SVG_FILE"
    exit 1
fi

echo "[1/4] Converting SVG to 1024x1024 PNG..."

# Use sips to convert SVG to PNG. sips on macOS can handle SVG input natively.
# First, we try using sips directly. If that fails (some macOS versions have
# limited SVG support in sips), fall back to using qlmanage or Python.

# Method: Use Python with built-in libraries to convert SVG to PNG
# This is more reliable than sips for SVG files
python3 - "$SVG_FILE" "$PNG_1024" << 'PYEOF'
import subprocess
import sys
import os
import tempfile

svg_path = sys.argv[1]
png_path = sys.argv[2]

# Try method 1: Use qlmanage (Quick Look) which handles SVG well
try:
    with tempfile.TemporaryDirectory() as tmpdir:
        result = subprocess.run(
            ["qlmanage", "-t", "-s", "1024", "-o", tmpdir, svg_path],
            capture_output=True, text=True, timeout=30
        )
        # qlmanage creates a file with .png extension
        for f in os.listdir(tmpdir):
            if f.endswith(".png"):
                ql_png = os.path.join(tmpdir, f)
                # Use sips to ensure exact 1024x1024 dimensions
                subprocess.run(
                    ["sips", "-z", "1024", "1024", ql_png, "--out", png_path],
                    capture_output=True, text=True, check=True
                )
                print(f"  Created {png_path} using qlmanage + sips")
                sys.exit(0)
    print("  qlmanage did not produce a PNG, trying alternative method...")
except Exception as e:
    print(f"  qlmanage method failed: {e}, trying alternative...")

# Try method 2: Use sips directly (works on some macOS versions)
try:
    result = subprocess.run(
        ["sips", "-s", "format", "png", "-z", "1024", "1024", svg_path, "--out", png_path],
        capture_output=True, text=True, timeout=30
    )
    if result.returncode == 0 and os.path.exists(png_path):
        print(f"  Created {png_path} using sips directly")
        sys.exit(0)
    print(f"  sips direct conversion failed: {result.stderr.strip()}")
except Exception as e:
    print(f"  sips method failed: {e}")

# Try method 3: Use rsvg-convert if available (from librsvg)
try:
    result = subprocess.run(
        ["rsvg-convert", "-w", "1024", "-h", "1024", svg_path, "-o", png_path],
        capture_output=True, text=True, timeout=30
    )
    if result.returncode == 0 and os.path.exists(png_path):
        print(f"  Created {png_path} using rsvg-convert")
        sys.exit(0)
except FileNotFoundError:
    pass
except Exception as e:
    print(f"  rsvg-convert method failed: {e}")

# Try method 4: Use Cocoa/AppKit via Python (works on macOS with PyObjC)
try:
    import AppKit
    import Quartz

    # Read SVG data
    with open(svg_path, 'rb') as f:
        svg_data = f.read()

    # Create NSImage from SVG data
    ns_data = AppKit.NSData.dataWithBytes_length_(svg_data, len(svg_data))
    image = AppKit.NSImage.alloc().initWithData_(ns_data)

    if image is not None:
        # Set the desired size
        size = AppKit.NSMakeSize(1024, 1024)
        image.setSize_(size)

        # Create a bitmap representation
        bitmap = AppKit.NSBitmapImageRep.alloc().initWithBitmapDataPlanes_pixelsWide_pixelsHigh_bitsPerSample_samplesPerPixel_hasAlpha_isPlanar_colorSpaceName_bytesPerRow_bitsPerPixel_(
            None, 1024, 1024, 8, 4, True, False,
            AppKit.NSDeviceRGBColorSpace, 0, 0
        )
        bitmap.setSize_(size)

        # Draw the image into the bitmap
        AppKit.NSGraphicsContext.saveGraphicsState()
        ctx = AppKit.NSGraphicsContext.graphicsContextWithBitmapImageRep_(bitmap)
        AppKit.NSGraphicsContext.setCurrentContext_(ctx)
        image.drawInRect_fromRect_operation_fraction_(
            AppKit.NSMakeRect(0, 0, 1024, 1024),
            AppKit.NSZeroRect,
            AppKit.NSCompositingOperationSourceOver,
            1.0
        )
        AppKit.NSGraphicsContext.restoreGraphicsState()

        # Save as PNG
        png_data = bitmap.representationUsingType_properties_(
            AppKit.NSBitmapImageFileTypePNG, {}
        )
        png_data.writeToFile_atomically_(png_path, True)
        print(f"  Created {png_path} using AppKit")
        sys.exit(0)
except ImportError:
    print("  AppKit not available")
except Exception as e:
    print(f"  AppKit method failed: {e}")

print("ERROR: Could not convert SVG to PNG with any available method.")
print("Please install librsvg (brew install librsvg) or ensure macOS Quick Look works.")
sys.exit(1)
PYEOF

# Verify the PNG was created
if [ ! -f "$PNG_1024" ]; then
    echo "ERROR: Failed to create PNG file"
    exit 1
fi

echo ""
echo "[2/4] Creating iconset directory with all required sizes..."

# Clean up any existing iconset
rm -rf "$ICONSET_DIR"
mkdir -p "$ICONSET_DIR"

# Generate all required icon sizes for macOS .iconset
# Format: icon_<size>x<size>.png      (1x resolution)
#          icon_<size>x<size>@2x.png   (2x / Retina resolution)
#
# Required sizes:
#   16x16, 16x16@2x (32px)
#   32x32, 32x32@2x (64px)
#   128x128, 128x128@2x (256px)
#   256x256, 256x256@2x (512px)
#   512x512, 512x512@2x (1024px)

declare -a SIZES=(
    "16:icon_16x16.png"
    "32:icon_16x16@2x.png"
    "32:icon_32x32.png"
    "64:icon_32x32@2x.png"
    "128:icon_128x128.png"
    "256:icon_128x128@2x.png"
    "256:icon_256x256.png"
    "512:icon_256x256@2x.png"
    "512:icon_512x512.png"
    "1024:icon_512x512@2x.png"
)

for entry in "${SIZES[@]}"; do
    SIZE="${entry%%:*}"
    FILENAME="${entry##*:}"
    echo "  Generating ${FILENAME} (${SIZE}x${SIZE}px)"
    sips -z "$SIZE" "$SIZE" "$PNG_1024" --out "$ICONSET_DIR/$FILENAME" > /dev/null 2>&1
done

echo ""
echo "[3/4] Creating .icns file with iconutil..."

# Remove existing icns if present
rm -f "$ICNS_FILE"

iconutil -c icns "$ICONSET_DIR" -o "$ICNS_FILE"

if [ ! -f "$ICNS_FILE" ]; then
    echo "ERROR: iconutil failed to create .icns file"
    exit 1
fi

echo ""
echo "[4/4] Cleaning up..."

# Keep the iconset and source PNG around for reference; remove if you prefer:
# rm -rf "$ICONSET_DIR"
# rm -f "$PNG_1024"

echo ""
echo "=== Done! ==="
echo ""
echo "Generated files:"
echo "  SVG source:   $SVG_FILE"
echo "  PNG (1024):   $PNG_1024"
echo "  Iconset dir:  $ICONSET_DIR/"
echo "  ICNS file:    $ICNS_FILE"
echo ""
ls -lh "$ICNS_FILE"
