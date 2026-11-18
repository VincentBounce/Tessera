# A copy of the app served for trials, never cached: its files as they are now at each load (a trial's commits keep the
# cache key, ?v=, which only tools/ship.sh changes, so that a browser's copy of a file would be kept otherwise)
# python3 tools/serve.py [port]   (8324 by default), from the folder served
import http.server, sys


class Fresh(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


http.server.ThreadingHTTPServer(('', int(sys.argv[1]) if len(sys.argv) > 1 else 8324), Fresh).serve_forever()
