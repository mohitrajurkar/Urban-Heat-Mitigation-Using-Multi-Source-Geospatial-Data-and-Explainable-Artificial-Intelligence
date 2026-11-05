"""End-to-end smoke test of the running stack (backend + AI service + PostGIS).

Usage:  python scripts/smoke_test.py [--base http://localhost:8080] [--skip-run]
Only uses the Python standard library so it runs without any virtual environment.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request

PASS, FAIL = [], []


def call(base, method, path, token=None, body=None, raw=False, expect=200):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(base + path, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            payload = r.read()
            status = r.status
    except urllib.error.HTTPError as e:
        payload, status = e.read(), e.code
    if status != expect:
        raise AssertionError(f"{method} {path} -> HTTP {status} (expected {expect}): {payload[:300]!r}")
    if raw:
        return payload
    return json.loads(payload) if payload else None


def check(name, fn):
    t = time.time()
    try:
        detail = fn()
        PASS.append(name)
        print(f"  PASS  {name} ({time.time() - t:.1f}s){' - ' + detail if detail else ''}")
    except Exception as exc:  # noqa: BLE001
        FAIL.append(name)
        print(f"  FAIL  {name}: {exc}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:8080")
    ap.add_argument("--skip-run", action="store_true", help="do not start a new analysis run")
    a = ap.parse_args()
    b = a.base
    print(f"Smoke testing {b}")
    ctx = {}

    check("system health (DB + PostGIS + AI service)", lambda: (lambda h: (h["database"]["status"] == "UP" and h["aiService"]["status"] == "UP"
                                                               or (_ for _ in ()).throw(AssertionError(h))) and h["database"]["postgis"])(call(b, "GET", "/api/system/health")))
    check("auth rejects anonymous", lambda: call(b, "GET", "/api/dashboard/stats", expect=401) and "401")
    check("auth rejects bad password", lambda: call(b, "POST", "/api/auth/login", body={"username": "admin", "password": "nope"}, expect=401) and "401")

    def login():
        ctx["admin"] = call(b, "POST", "/api/auth/login", body={"username": "admin", "password": "Admin@123"})["token"]
        ctx["viewer"] = call(b, "POST", "/api/auth/login", body={"username": "viewer", "password": "Viewer@123"})["token"]
        return "admin + viewer tokens"
    check("login (JWT)", login)
    T = lambda: ctx["admin"]  # noqa: E731

    def wait_for_run():
        for _ in range(240):
            runs = call(b, "GET", "/api/analysis/runs", T())
            if any(r["status"] == "COMPLETED" for r in runs) and not any(r["status"] in ("PENDING", "RUNNING") for r in runs):
                ctx["run"] = next(r for r in runs if r["status"] == "COMPLETED")
                return f"run #{ctx['run']['id']} completed in {ctx['run']['durationSeconds']} s"
            failed = [r for r in runs if r["status"] == "FAILED"]
            if failed and not any(r["status"] in ("PENDING", "RUNNING", "COMPLETED") for r in runs):
                raise AssertionError(failed[0]["message"])
            time.sleep(2)
        raise AssertionError("timeout waiting for analysis")
    check("completed analysis run available", wait_for_run)

    check("RBAC: viewer cannot start analysis", lambda: call(b, "POST", "/api/analysis/runs", ctx["viewer"], body={}, expect=403) and "403")
    check("datasets listed with demo labels", lambda: (lambda d: f"{len(d)} datasets, demo={sum(x['demo'] for x in d)}")(call(b, "GET", "/api/datasets", T())))

    def dash():
        d = call(b, "GET", "/api/dashboard/stats", T())
        k = d["kpis"]
        assert k["totalRegions"] > 0 and k["totalHotspots"] > 0 and k["estimatedMitigationCost"] > 0
        return f"{k['totalRegions']} regions, {k['totalHotspots']} hotspots, avg LST {k['averageLst']:.1f} °C"
    check("dashboard statistics", dash)

    def geo():
        g = call(b, "GET", "/api/map/regions", T())
        assert g["type"] == "FeatureCollection" and g["features"][0]["geometry"]["type"] == "Polygon"
        return f"{len(g['features'])} GeoJSON features"
    check("GIS regions GeoJSON (PostGIS geometries)", geo)
    check("map layer PNG (LST)", lambda: (lambda p: p[:4] == b"\x89PNG" and f"{len(p)} bytes")(call(b, "GET", "/api/map/layers/lst.png", T(), raw=True)))
    check("intervention markers", lambda: f"{len(call(b, 'GET', '/api/map/interventions', T()))} markers")
    check("indicator summary + rows", lambda: (call(b, "GET", "/api/indicators/summary", T())["correlationWithLst"] and
                                               f"{call(b, 'GET', '/api/indicators?size=5', T())['totalElements']} rows"))

    def hot():
        h = call(b, "GET", "/api/hotspots?size=5&sort=priority,desc", T())
        top = h["content"][0]
        ctx["hotspot"] = top
        d = call(b, "GET", f"/api/hotspots/{top['hotspotId']}", T())
        assert d["explanation"]["explanation"] and d["priority"]["components"]
        return f"{h['totalElements']} hotspots; #1 {top['name']} score {top['priority']['score']}"
    check("hotspot list + detail with SHAP and priority breakdown", hot)
    check("hotspot filters", lambda: f"{call(b, 'GET', '/api/hotspots?severity=Very%20High&significantOnly=true&size=1', T())['totalElements']} very-high significant")

    def evalm():
        e = call(b, "GET", "/api/predictions/evaluation", T())
        return ", ".join(f"{m['modelName']}/{m['task']}: " + (f"F1 {m['f1']:.3f}" if m["task"] == "classification" else f"R2 {m['r2']:.3f}") for m in e["models"])
    check("model evaluation (RF vs XGBoost)", evalm)
    check("predictions list", lambda: f"{call(b, 'GET', '/api/predictions?size=3', T())['totalElements']} regions")

    def custom():
        r = call(b, "POST", "/api/predictions/custom", T(), body={"features": [{"ndvi_mean": 0.05, "ndbi_mean": 0.15, "built_fraction": 0.9, "albedo_mean": 0.15}]})
        res = r["results"][0]
        return f"{res['predicted_class']} / {res['predicted_value']:.1f} °C"
    check("custom prediction with SHAP", custom)
    check("SHAP global", lambda: call(b, "GET", "/api/explanations/global", T())["shap"]["global"]["xgboost"]["regression"]["importance"][0]["label"])
    check("SHAP region explanation", lambda: call(b, "GET", f"/api/explanations/regions/{ctx['hotspot']['regionId']}", T())["explanation"][:90] + "...")
    check("SHAP summary plot PNG", lambda: (lambda p: p[:4] == b"\x89PNG" and f"{len(p)} bytes")(call(b, "GET", "/api/explanations/plots/xgboost/regression.png", T(), raw=True)))
    check("recommendations", lambda: (lambda r: f"{r['totalElements']} recommendations; best: {r['content'][0]['name']} @ {r['content'][0]['regionName']}")(call(b, "GET", "/api/recommendations?size=3", T())))
    check("recommendation assumptions", lambda: f"{len(call(b, 'GET', '/api/recommendations/assumptions', T())['strategies'])} strategies")
    check("cost summary", lambda: (lambda c: f"total Rs {c['totalCost'] / 1e7:.1f} crore")(call(b, "GET", "/api/costs/summary", T())))
    check("budget planner", lambda: (lambda p: f"{p['interventions']} interventions within Rs 5 crore")(call(b, "POST", "/api/costs/budget-plan", T(), body={"budgetInr": 5e7})))

    def prio():
        r = call(b, "POST", "/api/priorities/recalculate", T(), body={"heatSeverity": 0.5, "populationVulnerability": 0.2, "vegetationDeficit": 0.1,
                                                                     "implementationFeasibility": 0.1, "coolingBenefit": 0.1})
        call(b, "POST", "/api/priorities/recalculate", T(), body={"heatSeverity": 0.35, "populationVulnerability": 0.25, "vegetationDeficit": 0.15,
                                                                 "implementationFeasibility": 0.10, "coolingBenefit": 0.15})
        return f"{r['rankedHotspots']} re-ranked, levels {r['levels']}"
    check("priority recalculation", prio)

    def report():
        r = call(b, "POST", "/api/reports", T(), body={"title": "Smoke Test Report"})
        pdf = call(b, "GET", f"/api/reports/{r['id']}/download", T(), raw=True)
        assert pdf[:5] == b"%PDF-"
        return f"{len(pdf) // 1024} KB PDF"
    check("PDF report generation + download", report)
    check("validation errors are 400", lambda: call(b, "POST", "/api/costs/budget-plan", T(), body={"budgetInr": -1}, expect=400) and "400")

    if not a.skip_run:
        def new_run():
            r = call(b, "POST", "/api/analysis/runs", T(), body={"nEstimators": 80})
            for _ in range(240):
                s = call(b, "GET", f"/api/analysis/runs/{r['id']}", T())
                if s["status"] in ("COMPLETED", "FAILED"):
                    assert s["status"] == "COMPLETED", s["message"]
                    return f"run #{s['id']} completed in {s['durationSeconds']} s"
                time.sleep(2)
            raise AssertionError("timeout")
        check("start a new analysis run via API", new_run)

    print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
