#!/usr/bin/env python3
"""N02-24（鉄道・駅）から都内の駅と乗り入れ路線を抜き出す。

入力:
  N02-24_Station.geojson  国土数値情報 鉄道データ（令和6年）駅
  N03-20240101_13.geojson 国土数値情報 行政区域（東京都）
出力:
  src/data/stations.json  { stations: [...], lines: [...] }

使い方:
  python3 -I scripts/extract-stations.py <N02 station geojson> <N03 tokyo geojson> src/data/stations.json

出典: 国土数値情報（鉄道データ N02-24・行政区域データ N03）国土交通省 / CC BY 4.0
"""
import json
import re
import sys

EXCLUDE_KIND = {"13"}  # 鋼索鉄道（ケーブルカー）
EXCLUDE_NAME = re.compile(r"新幹線")
STRIP_PREFIX = re.compile(r"^\d+号線")
JR = "東日本旅客鉄道"

# N02 の JR 路線名は正式名（山手線＝品川〜田端のみ、東京〜品川は東海道線、田端〜東京は東北線）。
# 遊ぶ人が知っている運転系統の名前で選べるように、都内区間の駅名を列挙して系統線を作り、正式線は選択肢から隠す。
JR_SERVICE_LINES = {
    "山手線": "品川 大崎 五反田 目黒 恵比寿 渋谷 原宿 代々木 新宿 新大久保 高田馬場 目白 池袋 大塚 巣鴨 駒込 田端 "
              "西日暮里 日暮里 鶯谷 上野 御徒町 秋葉原 神田 東京 有楽町 新橋 浜松町 田町 高輪ゲートウェイ",
    "京浜東北線": "赤羽 東十条 王子 上中里 田端 西日暮里 日暮里 鶯谷 上野 御徒町 秋葉原 神田 東京 有楽町 新橋 浜松町 田町 "
                "高輪ゲートウェイ 品川 大井町 大森 蒲田",
    "埼京線": "大崎 恵比寿 渋谷 新宿 池袋 板橋 十条 赤羽 北赤羽 浮間舟渡",
    "宇都宮線・高崎線": "東京 上野 尾久 赤羽",
    "横須賀線": "東京 新橋 品川 西大井",
}
JR_FORMAL_HIDDEN = {"東北線", "東海道線", "赤羽線"}


def point_in_ring(x, y, ring):
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > y) != (yj > y):
            xcross = (xj - xi) * (y - yi) / (yj - yi) + xi
            if x < xcross:
                inside = not inside
        j = i
    return inside


def point_in_polygon(x, y, polygon):
    if not point_in_ring(x, y, polygon[0]):
        return False
    return not any(point_in_ring(x, y, hole) for hole in polygon[1:])


def bbox(ring):
    xs = [c[0] for c in ring]
    ys = [c[1] for c in ring]
    return (min(xs), min(ys), max(xs), max(ys))


def load_tokyo_polygons(path):
    """(bbox, polygon) の組。外周の bbox で先に弾いて点内判定を減らす。"""
    polys = []
    for f in json.load(open(path))["features"]:
        g = f["geometry"]
        coords = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
        for poly in coords:
            polys.append((bbox(poly[0]), poly))
    return polys


def in_tokyo(lon, lat, polys):
    for (x0, y0, x1, y1), poly in polys:
        if x0 <= lon <= x1 and y0 <= lat <= y1 and point_in_polygon(lon, lat, poly):
            return True
    return False


def main(station_path, tokyo_path, out_path):
    polys = load_tokyo_polygons(tokyo_path)
    groups = {}
    for f in json.load(open(station_path))["features"]:
        p = f["properties"]
        if p["N02_001"] in EXCLUDE_KIND or EXCLUDE_NAME.search(p["N02_003"]):
            continue
        coords = f["geometry"]["coordinates"]
        lon = sum(c[0] for c in coords) / len(coords)
        lat = sum(c[1] for c in coords) / len(coords)
        if not in_tokyo(lon, lat, polys):
            continue
        line_id = f"{p['N02_004']}|{p['N02_003']}"
        g = groups.setdefault(p["N02_005"], {"name": p["N02_005"], "lines": [], "pts": []})
        if line_id not in g["lines"]:
            g["lines"].append(line_id)
        g["pts"].append((lon, lat))

    # JR 運転系統線を足す。駅名が一致し、かつその駅に JR の正式線が乗り入れていること
    for svc, names in JR_SERVICE_LINES.items():
        lid = f"{JR}|{svc}"
        for nm in names.split():
            g = groups.get(nm)
            if g is None or not any(l.startswith(JR + "|") for l in g["lines"]):
                raise SystemExit(f"JR 系統線 {svc}: 駅 {nm} が見つからない")
            if lid not in g["lines"]:
                g["lines"].append(lid)

    lines = {}
    stations = []
    for gid, g in sorted(groups.items(), key=lambda kv: kv[0]):
        lon = sum(x for x, _ in g["pts"]) / len(g["pts"])
        lat = sum(y for _, y in g["pts"]) / len(g["pts"])
        stations.append({"id": gid, "name": g["name"], "lines": g["lines"],
                         "lat": round(lat, 5), "lon": round(lon, 5)})
        for lid in g["lines"]:
            op, nm = lid.split("|", 1)
            e = lines.setdefault(lid, {"id": lid, "operator": op, "name": STRIP_PREFIX.sub("", nm), "stations": []})
            e["stations"].append(gid)
            if op == JR and nm in JR_FORMAL_HIDDEN:
                e["hidden"] = True

    visible_ids = {l["id"] for l in lines.values() if not l.get("hidden")}
    orphans = [s["name"] for s in stations if not any(l in visible_ids for l in s["lines"])]
    if orphans:
        print("選べる路線に属さない駅:", orphans)

    out = {"source": "国土数値情報（鉄道データ N02-24）国土交通省 CC BY 4.0",
           "stations": stations,
           "lines": sorted(lines.values(), key=lambda l: (l["operator"], l["name"]))}
    json.dump(out, open(out_path, "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"stations {len(stations)}  lines {len(lines)}")
    for l in out["lines"]:
        print(f"  {len(l['stations']):3d}  {l['operator']}  {l['name']}")


if __name__ == "__main__":
    main(*sys.argv[1:4])
