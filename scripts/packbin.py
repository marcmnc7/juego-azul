# Mete un binario en un PNG RGB (3 bytes por píxel; los 4 primeros, la longitud)
import sys, math, struct
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
data = open(src, 'rb').read()
buf = struct.pack('<I', len(data)) + data
W = 2048
H = math.ceil(len(buf) / 3 / W)
buf += b'\0' * (W * H * 3 - len(buf))
Image.frombytes('RGB', (W, H), buf).save(dst, optimize=True)
