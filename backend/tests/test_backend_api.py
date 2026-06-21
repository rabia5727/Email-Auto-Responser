import os
import requests
import pytest

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://reply-automation-hub-1.preview.emergentagent.com').rstrip('/')

@pytest.fixture
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s

def test_root(api):
    r = api.get(f"{BASE_URL}/api/")
    assert r.status_code == 200
    assert "message" in r.json()

def test_workflow_status(api):
    r = api.get(f"{BASE_URL}/api/workflow/status")
    assert r.status_code == 200
    d = r.json()
    for k in ["enabled", "last_run", "total_processed", "total_errors", "is_authenticated"]:
        assert k in d
    assert isinstance(d["total_processed"], int)
    assert isinstance(d["total_errors"], int)
    assert isinstance(d["is_authenticated"], bool)

def test_emails_processed(api):
    r = api.get(f"{BASE_URL}/api/emails/processed")
    assert r.status_code == 200
    assert isinstance(r.json(), list)

def test_errors(api):
    r = api.get(f"{BASE_URL}/api/errors")
    assert r.status_code == 200
    assert isinstance(r.json(), list)

def test_oauth_login_redirect(api):
    r = api.get(f"{BASE_URL}/api/oauth/gmail/login", allow_redirects=False)
    assert r.status_code in (302, 307)
    loc = r.headers.get("location", "")
    assert "accounts.google.com" in loc
