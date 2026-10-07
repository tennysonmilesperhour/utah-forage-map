"""Isolated end-to-end account and digest flow through the real mail renderer.

Only Resend's HTTP boundary is mocked. No production users or inboxes are touched.
"""
import html
import os
from pathlib import Path
import re
import tempfile
from unittest.mock import patch
from urllib.parse import urlparse, parse_qs
from datetime import date, timedelta
import httpx

runtime = tempfile.TemporaryDirectory()
os.environ.update(DATABASE_URL=f"sqlite:///{Path(runtime.name) / 'delivery.db'}", SECRET_KEY="delivery-test-secret", CRON_SECRET="delivery-test-cron", RESEND_API_KEY="test-provider-key", APP_URL="https://staging.example.test", ENVIRONMENT="development")
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models import Species, Sighting, User

messages = []
def provider(url, **kwargs):
    assert url == 'https://api.resend.com/emails'
    messages.append(kwargs['json'])
    return httpx.Response(200, json={'id': 'test-message'}, request=httpx.Request('POST', url))

def link_token(name):
    links = re.findall(r'href="([^"]+)"', messages[-1]['html'])
    link = urlparse(html.unescape(links[0]))
    assert link.scheme == 'https' and link.netloc == 'staging.example.test'
    assert link.path == '/map'
    return parse_qs(link.query)[name][0]

def main():
    with patch('app.email_service.httpx.post', side_effect=provider), TestClient(app) as first:
        account = {'username': 'Delivery Check', 'email': 'delivery@example.com', 'password': 'delivery-test-password'}
        assert first.post('/api/auth/register', json=account).status_code == 201
        assert messages[-1]['to'] == ['delivery@example.com']
        token = link_token('verify')
        assert first.post('/api/auth/verify-email', json={'token': token}).status_code == 200
        assert first.post('/api/auth/verify-email', json={'token': token}).status_code == 400
        with SessionLocal() as db:
            species = Species(common_name='Oyster', latin_name='Pleurotus ostreatus', inaturalist_taxon_id=48494)
            db.add(species); db.flush()
            db.add(Sighting(user_id=db.query(User).filter(User.email==account['email']).one().id, species_id=species.id, latitude=40, longitude=-111, found_on=date.today(), month=date.today().month, source='iNaturalist', review_status='approved', location_privacy='exact'))
            db.commit()
        saved = first.post('/api/account/saved', json={'title': 'Visit plan', 'latitude': 40, 'longitude': -111, 'revisit_on': str(date.today())}).json()
        assert 'id' in saved
        assert first.patch('/api/account/saved/'+saved['id'], json={'visited_on': str(date.today()), 'revisit_on': None}).status_code == 200
        with TestClient(app) as second:
            assert second.post('/api/auth/login', json={'email':account['email'], 'password':account['password']}).status_code == 200
            assert second.get('/api/account/saved').json()[0]['visited_on'] == str(date.today())
            later = str(date.today()+timedelta(days=7))
            assert second.patch('/api/account/saved/'+saved['id'], json={'revisit_on':later}).json()['visited_on'] == str(date.today())
            assert first.get('/api/account/saved').json()[0]['revisit_on'] == later
            assert second.post('/api/account/alerts', json={'kind':'species','species_taxon_id':48494}).status_code == 201
            delivered = first.get('/api/cron/alerts', headers={'X-Cron-Secret':'delivery-test-cron'}).json()
            assert delivered['users_emailed'] == 1, delivered
            assert 'Oyster' in messages[-1]['html'] and 'Manage alerts' in messages[-1]['html']
            assert first.get('/api/cron/alerts', headers={'X-Cron-Secret':'delivery-test-cron'}).json()['users_emailed'] == 0
            assert first.post('/api/auth/password/forgot', json={'email':account['email']}).status_code == 202
            reset = link_token('reset')
            assert first.post('/api/auth/password/reset', json={'token':reset, 'password':'replacement-test-password'}).status_code == 204
            assert second.get('/api/auth/me').status_code == 401
            assert second.post('/api/auth/login', json={'email':account['email'], 'password':account['password']}).status_code == 401
            assert second.post('/api/auth/login', json={'email':account['email'], 'password':'replacement-test-password'}).status_code == 200
            assert second.get('/api/account/saved').json()[0]['revisit_on'] == later
    print('Email rendering/provider handoff, verification, cross-session plans, digest delivery, deduplication, and password recovery passed. Inbox delivery is not simulated as verified.')

if __name__ == '__main__':
    main()
