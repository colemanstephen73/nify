#!/usr/bin/env python3
"""
Build the single-file, self-contained HTML dashboard.

    python3 tools/build_dashboard.py --out dist/dashboard.html                    # empty dashboard (drag & drop TSV)
    python3 tools/build_dashboard.py --tsv data/session.tsv --out dist/x.html     # TSV embedded
    python3 tools/build_dashboard.py --tsv a.tsv --tsv b.tsv --out dist/x.html    # multiple sessions
    ... --inline-plotly path/to/plotly.min.js                                     # fully offline file

The analysis engine (src/engine/*.js) runs in the browser, so the embedded raw
TSV is the single source of truth and every number on the page is computed
from it at load time.
"""
import argparse
import html
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENGINE_ORDER = ["stats", "ingest", "laps", "track", "features", "mistakes", "scoring", "insights", "analyze"]
PLOTLY_CDN = "https://cdnjs.cloudflare.com/ajax/libs/plotly.js/2.35.2/plotly.min.js"


def read(p):
    with open(p, encoding="utf-8") as fh:
        return fh.read()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tsv", action="append", default=[], help="TSV file to embed (repeatable)")
    ap.add_argument("--out", required=True)
    ap.add_argument("--inline-plotly", help="path to plotly.min.js to inline (offline build)")
    ap.add_argument("--fragment", action="store_true", help="omit doctype/html/head/body wrappers (for hosts that add their own skeleton)")
    args = ap.parse_args()

    tpl = read(os.path.join(ROOT, "src", "app", "template.html"))
    styles = read(os.path.join(ROOT, "src", "app", "styles.css"))
    engine = "\n".join(read(os.path.join(ROOT, "src", "engine", f"{m}.js")) for m in ENGINE_ORDER)
    app = read(os.path.join(ROOT, "src", "app", "app.js"))
    if args.inline_plotly:
        plotly = "<script>" + read(args.inline_plotly).replace("</script", "<\\/script") + "</script>"
    else:
        plotly = f'<script src="{PLOTLY_CDN}" charset="utf-8"></script>'
    data = []
    for p in args.tsv:
        txt = read(p).replace("</", "<\\/")
        data.append(f'<script type="text/tab-separated-values" data-name="{html.escape(os.path.basename(p))}">\n{txt}</script>')
    out = (tpl.replace("/*__STYLES__*/", styles)
              .replace("<!--__PLOTLY__-->", plotly)
              .replace("<!--__DATA__-->", "\n".join(data))
              .replace("/*__ENGINE__*/", engine.replace("</script", "<\\/script"))
              .replace("/*__APP__*/", app.replace("</script", "<\\/script")))
    if args.fragment:
        import re
        out = re.sub(r"(?i)<!doctype html>\s*|</?html[^>]*>\s*|</?head>\s*|</?body>\s*", "", out, count=8)
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as fh:
        fh.write(out)
    print(f"wrote {args.out} ({len(out) / 1e6:.2f} MB)")


if __name__ == "__main__":
    main()
