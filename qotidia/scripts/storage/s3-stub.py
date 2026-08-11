"""A tiny S3-compatible server that actually validates SigV4.

Signature checking is done by botocore — an independent implementation —
so a request only succeeds if Amazon's own code agrees it was signed
correctly. It also enforces content-length the way R2 does: the signed
value is part of the signature, so a body of a different size fails.
"""
import json, sys, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qsl, urlencode, quote

from botocore.auth import S3SigV4QueryAuth
from botocore.awsrequest import AWSRequest
from botocore.credentials import Credentials

HOST, PORT = "127.0.0.1", 9111
AK, SK = "TESTACCESSKEY", "TESTSECRETKEY0000000000000000000000000000"
OBJECTS = {}
LOG = []


def expected_signature(method, raw_path, raw_query, query_pairs, headers):
    """Re-sign the incoming request with botocore and return the signature.

    Both the path and the query are used exactly as they arrived on the
    wire. botocore treats an S3 URL as already-encoded and signs it
    verbatim, so re-encoding here would compare our signature against a
    different request than the one the client sent.
    """
    signed_names = dict(query_pairs)["X-Amz-SignedHeaders"].split(";")
    amz_date = dict(query_pairs)["X-Amz-Date"]

    # Drop only the signature parameter, textually, leaving the rest byte
    # for byte as sent.
    rest = "&".join(p for p in raw_query.split("&") if not p.startswith("X-Amz-Signature="))
    url = f"http://{HOST}:{PORT}{raw_path}?{rest}"

    req = AWSRequest(method=method, url=url)
    for name in signed_names:
        if name == "host":
            req.headers["host"] = f"{HOST}:{PORT}"
        else:
            value = headers.get(name)
            if value is None:
                return None, f"signed header {name} was not sent"
            req.headers[name] = value

    auth = S3SigV4QueryAuth(Credentials(AK, SK), "s3", "auto", expires=900)
    req.context["timestamp"] = amz_date
    canonical = auth.canonical_request(req)
    sts = auth.string_to_sign(req, canonical)
    return auth.signature(sts, req), canonical


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *a):
        pass

    def _handle(self, method):
        parsed = urlparse(self.path)

        # Readiness probe from verify-storage.sh. Not a signed request, and
        # answering it here keeps the wait loop from logging a stack trace
        # for every attempt.
        if parsed.path == "/ping":
            self.send_response(200)
            self.send_header("content-length", "0")
            self.end_headers()
            return

        pairs = parse_qsl(parsed.query, keep_blank_values=True)
        given = dict(pairs).get("X-Amz-Signature")
        headers = {k.lower(): v for k, v in self.headers.items()}

        length = int(headers.get("content-length") or 0)
        body = self.rfile.read(length) if length else b""

        want, canonical = expected_signature(method, parsed.path, parsed.query, pairs, headers)
        entry = {"method": method, "path": parsed.path, "ok": want == given}
        LOG.append(entry)

        if want is None or want != given:
            msg = f"<Error><Code>SignatureDoesNotMatch</Code></Error>".encode()
            self.send_response(403)
            self.send_header("content-length", str(len(msg)))
            self.end_headers()
            self.wfile.write(msg)
            return

        key = parsed.path
        if method == "PUT":
            OBJECTS[key] = (body, headers.get("content-type", ""))
            self.send_response(200)
            self.send_header("content-length", "0")
            self.end_headers()
        elif method == "GET":
            if key not in OBJECTS:
                self.send_response(404)
                self.send_header("content-length", "0")
                self.end_headers()
                return
            data, ctype = OBJECTS[key]
            self.send_response(200)
            self.send_header("content-type", ctype or "application/octet-stream")
            disp = dict(pairs).get("response-content-disposition")
            if disp:
                self.send_header("content-disposition", disp)
            self.send_header("content-length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        elif method == "DELETE":
            existed = OBJECTS.pop(key, None) is not None
            self.send_response(204 if existed else 404)
            self.send_header("content-length", "0")
            self.end_headers()

    def do_PUT(self):
        self._handle("PUT")

    def do_GET(self):
        self._handle("GET")

    def do_DELETE(self):
        self._handle("DELETE")


if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"listening on {HOST}:{PORT}", flush=True)
    server.serve_forever()
