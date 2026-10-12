"""Site Verification + Search Console для loftmap.ru через сервисный аккаунт.
Использование:
  verify.py token          -> печатает TXT-запись для DNS
  verify.py verify         -> подтверждает владение, добавляет владельца-человека
  verify.py gsc            -> добавляет sc-domain в Search Console и отправляет sitemap
  verify.py status         -> статус sitemap и список сайтов
"""
import sys, os, json
from urllib.parse import quote
from google.oauth2 import service_account
from googleapiclient.discovery import build

SA = os.path.expanduser('~/.config/fedrbodr/gsc-sa.json')
DOMAIN = 'loftmap.ru'
SITE = f'sc-domain:{DOMAIN}'
SITEMAP = f'https://{DOMAIN}/sitemap-index.xml'
HUMAN = 'fedrbodr@gmail.com'
SCOPES = ['https://www.googleapis.com/auth/siteverification', 'https://www.googleapis.com/auth/webmasters']

creds = service_account.Credentials.from_service_account_file(SA, scopes=SCOPES)
sv = build('siteVerification', 'v1', credentials=creds, cache_discovery=False)
sc = build('searchconsole', 'v1', credentials=creds, cache_discovery=False)
site = {'identifier': DOMAIN, 'type': 'INET_DOMAIN'}
cmd = sys.argv[1] if len(sys.argv) > 1 else 'token'

if cmd == 'token':
    r = sv.webResource().getToken(body={'site': site, 'verificationMethod': 'DNS_TXT'}).execute()
    print('TXT для @:', r['token'])
elif cmd == 'verify':
    r = sv.webResource().insert(verificationMethod='DNS_TXT', body={'site': site}).execute()
    print('verified:', r.get('id'), 'owners:', r.get('owners'))
    rid = r['id']
    owners = sorted(set(r.get('owners', []) + [HUMAN]))
    r2 = sv.webResource().update(id=rid, body={'id': rid, 'site': site, 'owners': owners}).execute()
    print('owners now:', r2.get('owners'))
elif cmd == 'gsc':
    sc.sites().add(siteUrl=SITE).execute()
    print('site added:', SITE)
    sc.sitemaps().submit(siteUrl=SITE, feedpath=SITEMAP).execute()
    print('sitemap submitted:', SITEMAP)
elif cmd == 'status':
    print(json.dumps(sc.sites().list().execute(), ensure_ascii=False, indent=1))
    try:
        print(json.dumps(sc.sitemaps().list(siteUrl=SITE).execute(), ensure_ascii=False, indent=1))
    except Exception as e:
        print('sitemaps:', e)
