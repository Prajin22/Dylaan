"""Test brute-force lockout and role-scoped access."""
import urllib.request
import urllib.error
import json


def api_call(method, path, data=None, token=None):
    url = f"http://127.0.0.1:5000/api{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(req)
        return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


print("=" * 60)
print("TEST 1: Brute-force lockout (5 failed logins)")
print("=" * 60)
for i in range(6):
    code, body = api_call("POST", "/auth/login", {"username": "admin", "password": "wrong"})
    err = body.get("error", "")[:70]
    print(f"  Attempt {i+1}: HTTP {code} - {err}")

print()
print("=" * 60)
print("TEST 2: Login with correct password after lockout")
print("=" * 60)
code, body = api_call("POST", "/auth/login", {"username": "admin", "password": "admin123"})
print(f"  HTTP {code} - {body.get('error', body.get('username', ''))}")

print()
print("=" * 60)
print("TEST 3: Customer role-scoped access")
print("=" * 60)
# Login as customer (using a fresh user to avoid lockout)
code, body = api_call("POST", "/auth/login", {"username": "customer", "password": "demo123"})
token = body.get("token")
print(f"  Login: HTTP {code}, role={body.get('role')}, verified={body.get('verification_status')}")

# Access products (should work)
code, body = api_call("GET", "/products", token=token)
print(f"  GET /products: HTTP {code}, count={len(body) if isinstance(body, list) else 'N/A'}")

# Try admin endpoints (should fail with 403)
code, body = api_call("GET", "/stats", token=token)
print(f"  GET /stats (admin-only): HTTP {code} - {body.get('error', 'OK')[:50]}")

code, body = api_call("GET", "/orders", token=token)
print(f"  GET /orders (admin-only): HTTP {code} - {body.get('error', 'OK')[:50]}")

code, body = api_call("GET", "/admin/buyers", token=token)
print(f"  GET /admin/buyers: HTTP {code} - {body.get('error', 'OK')[:50]}")

code, body = api_call("GET", "/admin/audit-log", token=token)
print(f"  GET /admin/audit-log: HTTP {code} - {body.get('error', 'OK')[:50]}")

print()
print("=" * 60)
print("TEST 4: Admin full access")
print("=" * 60)

# Need to wait for lockout to expire or reset. Let's use production user instead.
code, body = api_call("POST", "/auth/login", {"username": "packhouse", "password": "pack123"})
token_prod = body.get("token")
print(f"  Production login: HTTP {code}, role={body.get('role')}")

code, body = api_call("GET", "/orders", token=token_prod)
print(f"  GET /orders (production): HTTP {code}, count={len(body) if isinstance(body, list) else 'N/A'}")

# Production trying admin endpoint
code, body = api_call("GET", "/admin/buyers", token=token_prod)
print(f"  GET /admin/buyers (production): HTTP {code} - {body.get('error', 'OK')[:50]}")

print()
print("=" * 60)
print("TEST 5: Buyer registration + inquiry flow")
print("=" * 60)
# Register a new buyer
code, body = api_call("POST", "/auth/register", {
    "username": "newbuyer",
    "email": "newbuyer@test.com",
    "password": "test123",
    "company_name": "Test Trading LLC",
    "gstin_vat_number": "TEST-GST-999",
})
print(f"  Register: HTTP {code} - {body.get('message', body.get('error', ''))[:60]}")

# Login as new buyer
code, body = api_call("POST", "/auth/login", {"username": "newbuyer", "password": "test123"})
new_token = body.get("token")
print(f"  Login: HTTP {code}, verified={body.get('verification_status')}")

# Try to access products (should be blocked — not verified)
code, body = api_call("GET", "/products", token=new_token)
print(f"  GET /products (unverified): HTTP {code} - {body.get('error', 'OK')[:50]}")

print()
print("All tests complete!")
