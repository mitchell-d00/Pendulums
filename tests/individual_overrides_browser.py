"""Regression for explicit per-bob precedence over ensemble presets.

Requires: Python Playwright and Chromium at /usr/bin/chromium.
Test source loaded locally: does not verify deployed GitHub Pages.
"""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
read=lambda name:(ROOT/name).read_text()
checks=[]
def check(label, condition):
    if not condition:
        raise AssertionError(label)
    checks.append(label)
def snapshot(page):
    return page.evaluate('Pendulums.getSnapshot()')

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',
                              args=['--no-sandbox'])
    for width in (390,1280):
        page=browser.new_page(viewport={'width':width,'height':900},
                              accept_downloads=True)
        errors=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.set_content(read('index.html'))
        for name in ('style.css','studio3d.css'):
            page.add_style_tag(content=read(name))
        for name in ('physics.js','app.js','studio3d.js'):
            page.add_script_tag(content=read(name))
        page.locator('#play').click()  # paused for exact unrelated-state comparisons
        page.locator('#count').fill('3')
        page.locator('#preset').select_option('ribbons')
        page.locator('#applyTop').click()
        before=snapshot(page)
        check(f'{width}: new ensemble has 3 bobs',len(before['tracks'])==3)
        page.locator('#studioPath').select_option('1')
        check(f'{width}: fractional preset heading displayed as a whole degree',
              float(page.locator('#soloHeading').input_value()).is_integer())
        untouched=snapshot(page)['tracks'][0]['current']
        page.locator('#soloPreset').select_option('rosette')
        page.locator('#soloHeading').fill('29')
        page.locator('#soloLength').fill('3.75')
        page.locator('#soloMass').fill('2.25')
        page.locator('#soloDamping').fill('0.08')
        check(f'{width}: manual fields switch recipe label to custom',
              page.locator('#soloPreset').input_value()=='custom')
        page.locator('#soloApplyTop').click()
        applied=snapshot(page)
        config=applied['tracks'][1]['config']
        check(f'{width}: solo Apply marks override',config.get('individualOverride') is True)
        check(f'{width}: solo numerical values accepted',
              config['length']==3.75 and config['mass']==2.25 and config['phi']==29)
        check(f'{width}: individual damping persisted',
              config.get('damping')==.08 and config.get('soloRecipe')=='custom')
        check(f'{width}: other pendulums untouched by solo Apply',
              applied['tracks'][0]['current']==untouched)
        check(f'{width}: visible active-override status',
              'ACTIVE' in page.locator('#soloPreview').inner_text())
        page.locator('#preset').select_option('fan')
        page.locator('#releaseExact').fill('211')
        page.locator('#apply').click()
        page.wait_for_timeout(60)
        preserved=snapshot(page)
        check(f'{width}: solo override wins after bottom ensemble Apply',
              preserved['preset']=='fan' and
              all(preserved['tracks'][1]['config'].get(k)==config[k]
                  for k in ('length','mass','phi','damping','soloRecipe','individualOverride')))
        check(f'{width}: unassigned bob follows ensemble fan',
              preserved['tracks'][0]['config'].get('individualOverride') is not True)
        page.locator('#studioPath').select_option('0')
        page.locator('#studioPath').select_option('1')
        check(f'{width}: switching selected bob retains override label',
              page.locator('#soloPreset').input_value()=='custom' and
              'ACTIVE' in page.locator('#soloPreview').inner_text())
        check(f'{width}: no long decimal tails in solo controls',
              len(page.locator('#soloLength').input_value())<9 and
              len(page.locator('#soloHeading').input_value())<=3)
        page.locator('#editLength').fill('4.25')
        page.locator('#updateOneTop').click()
        inspected=snapshot(page)['tracks'][1]['config']
        check(f'{width}: inspector also preserves override drag',
              inspected['individualOverride'] is True and
              inspected['damping']==.08 and inspected['length']==4.25 and
              inspected['soloRecipe']=='custom')
        page.locator('#preset').select_option('orbit')
        page.locator('#applyTop').click()
        page.wait_for_timeout(60)
        check(f'{width}: top ensemble Apply also preserves override',
              snapshot(page)['tracks'][1]['config']['length']==4.25 and
              snapshot(page)['tracks'][1]['config']['damping']==.08)
        page.locator('#studioPath').select_option('1')
        page.locator('#soloResetOverride').click()
        after=snapshot(page)
        check(f'{width}: explicit reset clears only selected override',
              not after['tracks'][1]['config'].get('individualOverride') and
              after['tracks'][1]['config']['length']!=4.25)
        check(f'{width}: reset leaves other bobs unchanged',
              after['tracks'][0]['current']==snapshot(page)['tracks'][0]['current'])
        check(f'{width}: reset returns ensemble status',
              'following ensemble' in page.locator('#soloPreview').inner_text())
        check(f'{width}: no uncaught JS errors',not errors)
        page.close()
    browser.close()
print(f'{len(checks)}/{len(checks)} individual-override regression checks passed')
