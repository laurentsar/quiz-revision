#!/usr/bin/env python3
"""Génère toutes les icônes de Quizz Révision (PWA + Android) sans dépendance.

Design : bouclier (cybersécurité) contenant une mind map — un noeud central relié
à trois noeuds satellites — en blanc sur dégradé diagonal bleu nuit -> cyan.
Rendu en anti-aliasing analytique (signed distance fields).
"""
import math, os, struct, zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Couleurs du dégradé (raccord thème app #061525)
C0 = (14, 42, 82)     # navy  #0E2A52  (coin haut-gauche)
C1 = (24, 182, 201)   # cyan  #18B6C9  (coin bas-droite)
WHITE = (255, 255, 255)


def clamp(v, lo=0.0, hi=1.0):
    return lo if v < lo else hi if v > hi else v


def cover(d, aa):
    """Couverture 0..1 d'une SDF (d<0 = intérieur)."""
    return clamp(0.5 - d / aa)


def seg_dist(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    l2 = dx * dx + dy * dy
    t = 0.0 if l2 == 0 else clamp(((px - ax) * dx + (py - ay) * dy) / l2)
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def bezier(p0, p1, p2, n):
    """Points d'une quadratique (bornes incluses)."""
    out = []
    for i in range(n + 1):
        t = i / n
        u = 1.0 - t
        out.append((u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
                    u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]))
    return out


def shield_polygon(cx, cy, s, scale):
    """Contour du bouclier : bord haut droit, flancs galbés, pointe basse."""
    w = 0.36 * s * scale          # demi-largeur
    top = cy - 0.40 * s * scale
    bot = cy + 0.46 * s * scale
    r = 0.10 * s * scale          # arrondi des coins hauts
    right = ([(cx + w - r, top)]
             + bezier((cx + w - r, top), (cx + w, top), (cx + w, top + r), 6)
             + bezier((cx + w, top + r), (cx + w, cy + 0.20 * s * scale), (cx, bot), 22))
    left = [(2 * cx - x, y) for (x, y) in reversed(right)]
    return right + left


def poly_sdf(px, py, poly):
    """Distance signée à un polygone (négatif à l'intérieur)."""
    d = 1e18
    inside = False
    n = len(poly)
    for i in range(n):
        ax, ay = poly[i]
        bx, by = poly[(i + 1) % n]
        d = min(d, seg_dist(px, py, ax, ay, bx, by))
        if (ay > py) != (by > py) and px < (bx - ax) * (py - ay) / (by - ay + 1e-12) + ax:
            inside = not inside
    return -d if inside else d


def render(size, shape, scale):
    """shape: 'square' (coins arrondis), 'circle', 'fullbleed'."""
    s = float(size)
    aa = max(1.0, s / 256.0)
    cx = cy = s / 2.0
    half = s / 2.0
    cr = 0.22 * s                          # rayon des coins (square)

    poly = shield_polygon(cx, cy, s, scale)
    shield_stroke = 0.030 * s * scale      # épaisseur du contour du bouclier

    # Mind map : noeud central + 3 satellites (haut-gauche, haut-droite, bas)
    node_r = 0.052 * s * scale
    sat_r = 0.036 * s * scale
    link = 0.020 * s * scale               # demi-épaisseur des liens
    sats = [
        (cx - 0.17 * s * scale, cy - 0.15 * s * scale),
        (cx + 0.17 * s * scale, cy - 0.15 * s * scale),
        (cx, cy + 0.20 * s * scale),
    ]

    px = bytearray(size * size * 4)
    i = 0
    for y in range(size):
        fy = y + 0.5
        for x in range(size):
            fx = x + 0.5
            # ---- masque de forme (alpha) ----
            if shape == 'fullbleed':
                a = 1.0
            elif shape == 'circle':
                a = cover(math.hypot(fx - cx, fy - cy) - half, aa)
            else:  # square arrondi
                qx = abs(fx - cx) - (half - cr)
                qy = abs(fy - cy) - (half - cr)
                d = math.hypot(max(qx, 0.0), max(qy, 0.0)) + min(max(qx, qy), 0.0) - cr
                a = cover(d, aa)

            # ---- fond dégradé diagonal ----
            t = clamp((fx + fy) / (2.0 * s))
            br = C0[0] + (C1[0] - C0[0]) * t
            bg = C0[1] + (C1[1] - C0[1]) * t
            bb = C0[2] + (C1[2] - C0[2]) * t

            # ---- contour du bouclier ----
            ds = poly_sdf(fx, fy, poly)
            g = cover(abs(ds) - shield_stroke * 0.5, aa)

            # ---- mind map (uniquement à l'intérieur du bouclier) ----
            m = cover(math.hypot(fx - cx, fy - cy) - node_r, aa)
            for (sx, sy) in sats:
                m = max(m, cover(math.hypot(fx - sx, fy - sy) - sat_r, aa))
                m = max(m, cover(seg_dist(fx, fy, cx, cy, sx, sy) - link, aa))
            g = max(g, m)

            r = br + (WHITE[0] - br) * g
            gg = bg + (WHITE[1] - bg) * g
            b = bb + (WHITE[2] - bb) * g

            px[i] = int(r + 0.5)
            px[i + 1] = int(gg + 0.5)
            px[i + 2] = int(b + 0.5)
            px[i + 3] = int(clamp(a) * 255 + 0.5)
            i += 4
    return px


def write_png(path, size, px):
    def chunk(tag, data):
        return (struct.pack('>I', len(data)) + tag + data
                + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff))
    raw = bytearray()
    row = size * 4
    for y in range(size):
        raw.append(0)
        raw += px[y * row:(y + 1) * row]
    ihdr = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)
    out = (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr)
           + chunk(b'IDAT', zlib.compress(bytes(raw), 9)) + chunk(b'IEND', b''))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as f:
        f.write(out)
    print(f"  {os.path.relpath(path, ROOT):60s} {size:>4}px  {len(out):>7,}o")


# (dossier densité): (taille launcher, taille foreground 108dp)
DENS = {'mdpi': (48, 108), 'hdpi': (72, 162), 'xhdpi': (96, 216),
        'xxhdpi': (144, 324), 'xxxhdpi': (192, 432)}
RES = os.path.join(ROOT, 'android/app/src/main/res')


def main():
    print("== PWA (www/img) ==")
    for n in (192, 512):
        write_png(os.path.join(ROOT, f'www/img/icon-{n}.png'), n, render(n, 'fullbleed', 1.0))

    print("== Android launcher / round / foreground ==")
    for d, (sl, sf) in DENS.items():
        write_png(os.path.join(RES, f'mipmap-{d}/ic_launcher.png'), sl,
                  render(sl, 'square', 1.0))
        write_png(os.path.join(RES, f'mipmap-{d}/ic_launcher_round.png'), sl,
                  render(sl, 'circle', 1.0))
        # foreground : la zone sûre d'une icône adaptative est ~66% -> on réduit
        write_png(os.path.join(RES, f'mipmap-{d}/ic_launcher_foreground.png'), sf,
                  render(sf, 'fullbleed', 0.72))


if __name__ == '__main__':
    main()
