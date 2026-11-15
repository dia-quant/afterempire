"""Local preview server that behaves like GitHub Pages: /flows serves flows.html.
Run: python pipeline/serve.py   then open http://localhost:8000/"""
import functools
import http.server
from pathlib import Path

SITE = Path(__file__).resolve().parents[1] / "site"


class Handler(http.server.SimpleHTTPRequestHandler):
    def send_head(self):
        path = self.path.split("?", 1)[0].split("#", 1)[0]
        if path != "/" and not Path(path).suffix and (SITE / (path.lstrip("/") + ".html")).exists():
            self.path = path + ".html"
        return super().send_head()


if __name__ == "__main__":
    http.server.ThreadingHTTPServer(("", 8000), functools.partial(Handler, directory=str(SITE))).serve_forever()
