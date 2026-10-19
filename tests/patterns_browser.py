"""Chromium checks for the 360-point release wheel and physical pattern presets.
Requires Python Playwright and a local /usr/bin/chromium executable.
Runs the same offline HTML, CSS and JavaScript as GitHub Pages, but not on the deployed origin.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json

ROOT=Path(__file__).resolve().parent.parent
HTML=(ROOT/'index.html').read_text()
CSS=(ROOT/'style.css').read_text()
PHYSICS=(ROOT/'physics.js').read_text()
APP=(ROOT/'app.js').read_text()
checks=[]
def check(name, value):
    if not value: raise AssertionError(name)
    checks.append(name)

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    for width in (390,1280):
        page=browser.new_page(viewport={'width':width,'height':840},accept_downloads=True)
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.set_content(HTML,wait_until='load')
        page.add_style_tag(content=CSS)
        page.add_script_tag(content=PHYSICS)
        page.add_script_tag(content=APP)
        page.wait_for_timeout(100)
        check(f'{width}: release compass visible',page.locator('#releaseDial').is_visible())
        check(f'{width}: 360 discrete slider positions',page.locator('#releaseHeading').get_attribute('max')=='359' and page.locator('#releaseHeading').get_attribute('step')=='1')
        check(f'{width}: zero bearing initially',page.evaluate('Pendulums.status.releaseHeading')==0)
        check(f'{width}: ten motion presets available',page.locator('#preset option').count()==10)
        page.locator('#releaseHeading').fill('359')
        check(f'{width}: slider updates exact bearing',page.locator('#releaseExact').input_value()=='359')
        page.locator('#count').fill('30')
        page.locator('#preset').select_option('starburst')
        page.locator('#apply').click()
        snap=page.evaluate('Pendulums.getSnapshot()')
        check(f'{width}: bearing recorded in snapshot',snap['releaseHeading']==359 and page.evaluate('Pendulums.status.releaseHeading')==359)
        check(f'{width}: 30 pendulums maximum',len(snap['tracks'])==30)
        check(f'{width}: even 12 degree spread',abs(snap['tracks'][1]['config']['phi']-11)<1e-8)
        check(f'{width}: 30 individual colors',len(set(t['config']['color'] for t in snap['tracks']))==30)
        check(f'{width}: all paths have recorded first positions',all(t['samples'] for t in snap['tracks']))
        check(f'{width}: pattern status visible','359° RELEASE' in page.locator('#patternNote').inner_text())
        page.locator('#releaseExact').fill('237')
        page.locator('#preset').select_option('spiral')
        page.locator('#apply').click()
        snap=page.evaluate('Pendulums.getSnapshot()')
        check(f'{width}: spiral uses selected bearing',snap['preset']=='spiral' and snap['releaseHeading']==237)
        check(f'{width}: spiral auto damping',abs(snap['settings']['damping']-.055)<1e-9)
        page.wait_for_timeout(650)
        snap=page.evaluate('Pendulums.getSnapshot()')
        check(f'{width}: spiral samples progress',len(snap['tracks'][0]['samples'])>5)
        check(f'{width}: energy and angular momentum samples',len(snap['tracks'][0]['samples'][0])==9)
        page.locator('#preset').select_option('rosette')
        page.locator('#apply').click()
        check(f'{width}: auto damping removed on rosette',page.evaluate('Pendulums.status.damping')==0)
        check(f'{width}: preset change retains bearing',page.evaluate('Pendulums.status.releaseHeading')==237)
        dial=page.locator('#releaseDial')
        dial.scroll_into_view_if_needed()
        rect=dial.bounding_box()
        page.mouse.click(rect['x']+rect['width']/2,rect['y']+rect['height']*.12)
        check(f'{width}: wheel pointer chooses 0 degrees',page.locator('#releaseExact').input_value()=='0')
        page.locator('#apply').click()
        check(f'{width}: applied compass position',page.evaluate('Pendulums.status.releaseHeading')==0)
        old=page.evaluate('Pendulums.getSnapshot()')
        old.pop('releaseHeading')
        page.locator('#file').set_input_files({'name':'old.json','mimeType':'application/json','buffer':json.dumps(old).encode()})
        page.wait_for_timeout(100)
        check(f'{width}: old JSON import still works',page.evaluate('Pendulums.getSnapshot().tracks.length')==30 and page.evaluate('Pendulums.status.releaseHeading')==0)
        check(f'{width}: no horizontal overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+2'))
        check(f'{width}: no JS errors',not errors)
        page.close()
    browser.close()
print(f'{len(checks)} / {len(checks)} browser checks passed')
