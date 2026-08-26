"""
Generate icon.ico containing 16x16, 32x32, 48x48, and 256x256 RGBA PNG images.
Run from the icons/ directory: python gen_ico.py
"""
import struct, zlib, os

def make_rgba_png(size, r=100, g=149, b=237):
    sig = b'\x89PNG\r\n\x1a\n'
    ihdr_d = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)
    ihdr = struct.pack('>I', 13) + b'IHDR' + ihdr_d + struct.pack('>I', zlib.crc32(b'IHDR' + ihdr_d) & 0xFFFFFFFF)
    raw = b''.join(b'\x00' + bytes([r, g, b, 255]) * size for _ in range(size))
    comp = zlib.compress(raw, 9)
    idat = struct.pack('>I', len(comp)) + b'IDAT' + comp + struct.pack('>I', zlib.crc32(b'IDAT' + comp) & 0xFFFFFFFF)
    iend = b'\x00\x00\x00\x00IEND' + struct.pack('>I', zlib.crc32(b'IEND') & 0xFFFFFFFF)
    return sig + ihdr + idat + iend

def make_ico(sizes):
    images = [make_rgba_png(s) for s in sizes]
    count = len(images)
    # ICO header: reserved(2) + type=1(2) + count(2)
    header = struct.pack('<HHH', 0, 1, count)
    # Each directory entry is 16 bytes; image data starts after header + all entries
    data_offset = 6 + count * 16
    directory = b''
    for size, img in zip(sizes, images):
        w = 0 if size == 256 else size   # 0 means 256 in ICO format
        h = 0 if size == 256 else size
        directory += struct.pack('<BBBBHHII', w, h, 0, 0, 1, 32, len(img), data_offset)
        data_offset += len(img)
    return header + directory + b''.join(images)

out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'icon.ico')
ico_data = make_ico([16, 32, 48, 256])
with open(out_path, 'wb') as f:
    f.write(ico_data)
print(f'Wrote {out_path} ({len(ico_data)} bytes)')
