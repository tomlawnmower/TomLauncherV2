"""Generate minimal valid RGBA PNG icons for Tauri build."""
import struct, zlib, os

def make_rgba_png(width, height, r, g, b, a=255):
    """Create a solid-color RGBA PNG."""
    sig = b'\x89PNG\r\n\x1a\n'

    # IHDR: width, height, bit_depth=8, color_type=6 (RGBA), compress=0, filter=0, interlace=0
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    ihdr_crc  = zlib.crc32(b'IHDR' + ihdr_data) & 0xFFFFFFFF
    ihdr      = struct.pack('>I', 13) + b'IHDR' + ihdr_data + struct.pack('>I', ihdr_crc)

    # IDAT: one filter byte (0) per row, then RGBA pixels
    raw  = b''.join(b'\x00' + bytes([r, g, b, a]) * width for _ in range(height))
    comp = zlib.compress(raw, 9)
    idat_crc = zlib.crc32(b'IDAT' + comp) & 0xFFFFFFFF
    idat     = struct.pack('>I', len(comp)) + b'IDAT' + comp + struct.pack('>I', idat_crc)

    # IEND
    iend_crc = zlib.crc32(b'IEND') & 0xFFFFFFFF
    iend     = b'\x00\x00\x00\x00IEND' + struct.pack('>I', iend_crc)

    return sig + ihdr + idat + iend

out = os.path.dirname(os.path.abspath(__file__))
for size in [32, 128, 256, 512]:
    data = make_rgba_png(size, size, 100, 149, 237)
    path = os.path.join(out, f'{size}x{size}.png')
    with open(path, 'wb') as f:
        f.write(data)
    print(f'  wrote {path}')

# icon.png is the one Tauri's generate_context! looks for
with open(os.path.join(out, 'icon.png'), 'wb') as f:
    f.write(make_rgba_png(512, 512, 100, 149, 237))
print('  wrote icon.png')
print('Done.')
