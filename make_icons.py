from struct import pack
import zlib, os

def png(path, size, rgb=(198, 242, 74), ink=(17, 20, 12)):
    w = h = size
    rows = []
    for y in range(h):
        row = bytearray([0])
        for x in range(w):
            m = size * 0.18
            inside = m <= x < w - m and m <= y < h - m
            c = ink
            if inside:
                c = rgb
                t = size
                if t >= 16:
                    nx, ny = x / t, y / t
                    s = False
                    if 0.28 < ny < 0.42 and 0.32 < nx < 0.82:
                        s = True
                    if 0.58 < ny < 0.72 and 0.18 < nx < 0.68:
                        s = True
                    if 0.22 < ny < 0.78 and 0.18 < nx < 0.32 and ny < 0.58:
                        s = True
                    if 0.22 < ny < 0.78 and 0.68 < nx < 0.82 and ny > 0.42:
                        s = True
                    if s:
                        c = ink
            row += bytes(c) + b"\xff"
        rows.append(bytes(row))
    raw = b"".join(rows)

    def chunk(tag, data):
        return pack(">I", len(data)) + tag + data + pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)
    data = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    open(path, "wb").write(data)

base = "/workspace/shopcopy-extension/extension/icons"
os.makedirs(base, exist_ok=True)
for s in (16, 32, 48, 128):
    png("%s/icon%s.png" % (base, s), s)
print("ok")
