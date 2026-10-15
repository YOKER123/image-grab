#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
gen_icons.py —— 纯标准库生成扩展图标
无需第三方依赖（不依赖 Pillow），直接写出 PNG 文件。
图标：蓝紫渐变圆角方块 + 白色「向下箭头进入托盘」图形。
用法：python gen_icons.py
"""

import struct
import zlib
import os

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "icons")

# 配色：与插件主题一致
C_FROM = (79, 124, 255)    # #4f7cff
C_TO = (139, 92, 246)      # #8b5cf6
WHITE = (255, 255, 255)


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def rounded_rect_alpha(x, y, size, radius):
    """返回圆角矩形在 (x, y) 处的覆盖强度（0~1），用于抗锯齿"""
    # 距离最近的圆角圆心
    cx = min(max(x, radius), size - 1 - radius)
    cy = min(max(y, radius), size - 1 - radius)
    dx = x - cx
    dy = y - cy
    dist = (dx * dx + dy * dy) ** 0.5
    if dist <= radius - 0.5:
        return 1.0
    if dist >= radius + 0.5:
        # 可能落在直边内部
        inside = (radius <= x <= size - 1 - radius) or (radius <= y <= size - 1 - radius)
        if x < radius or x > size - 1 - radius or y < radius or y > size - 1 - radius:
            return 0.0
        return 1.0 if inside else 0.0
    return radius + 0.5 - dist


def glyph_alpha(x, y, size):
    """白色图形：向下箭头 + 底部托盘横线（返回 0~1）"""
    s = size / 128.0  # 以 128px 为设计基准缩放
    # 矩形范围定义（设计基准坐标）
    stem = (57, 34, 71, 70)      # 箭杆：x1, y1, x2, y2
    head_top = 70                # 箭头三角形顶点所在 y
    head_bottom = 92
    head_half = 26               # 半宽（在 y = head_top 处）
    tray = (40, 100, 88, 108)    # 托盘横线

    def in_box(v, box):
        x1, y1, x2, y2 = box
        return x1 * s <= v[0] <= x2 * s and y1 * s <= v[1] <= y2 * s

    if in_box((x, y), stem):
        return 1.0

    # 三角形箭头
    ty = y / s
    if head_top <= ty <= head_bottom:
        tx = x / s
        half = head_half * (1 - (ty - head_top) / (head_bottom - head_top))
        if 64 - half <= tx <= 64 + half:
            return 1.0

    if in_box((x, y), tray):
        return 1.0

    return 0.0


def make_icon(size):
    radius = size * 0.24
    rows = []
    for y in range(size):
        row = bytearray()
        row.append(0)  # filter type 0
        for x in range(size):
            bg_a = rounded_rect_alpha(x, y, size, radius)
            if bg_a <= 0:
                row.extend((0, 0, 0, 0))
                continue

            # 对角渐变背景
            t = (x + y) / (2.0 * (size - 1)) if size > 1 else 0
            base = lerp(C_FROM, C_TO, t)

            g = glyph_alpha(x, y, size)
            color = lerp(base, WHITE, g) if g else base
            alpha = round(255 * bg_a)
            row.extend((color[0], color[1], color[2], alpha))
        rows.append(bytes(row))

    raw = b"".join(rows)
    return png_bytes(size, size, raw)


def png_bytes(w, h, raw_scanlines):
    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)  # 8bit RGBA
    idat = zlib.compress(raw_scanlines, 9)
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for size in (16, 48, 128):
        path = os.path.join(OUT_DIR, "icon%d.png" % size)
        with open(path, "wb") as f:
            f.write(make_icon(size))
        print("generated:", path)


if __name__ == "__main__":
    main()
