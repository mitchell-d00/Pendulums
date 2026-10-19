"""Mirror-action regression for the live Pendulums page source.
Run with Python Playwright and Chromium installed locally.
This injects local files, not the deployed GitHub Pages origin.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
FILES={name:(ROOT/name).read_text() for name in
       ('index.html','style.css','studio3d.css','physics.js','app.js','studio3d.js')}
checks=[]
def check(label, condition):
    if not condition: raise AssertionError(label)
    checks.append(label)

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',
                               args=['--no-sandbox'])
    for width in (390,1280):
        page=browser.new_page(viewport={'width':width,'height':860},
                              is_mobile=width==390,has_touch=width==390)
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.set_content(FILES['index.html'])
        for item in ('style.css','studio3d.css'):
            page.add_style_tag(content=FILES[item])
        for item in ('physics.js','app.js','studio3d.js'):
            page.add_script_tag(content=FILES[item])
        page.wait_for_timeout(200)
        for item in ('applyTop','apply','soloApplyTop','soloApply','soloNextTop',
                     'soloNext','updateOneTop','updateOne'):
            el=page.locator('#'+item)
            check(f'{width}: {item} unique and touch sized',
                  el.count()==1 and el.is_visible() and el.bounding_box()['height']>=43)
        ids=['applyTop','count','gravity','damping','speed','releaseHeading',
             'releaseDial','apply']
        positions=page.evaluate("""ids=>ids.map(id=>
            document.getElementById(id).getBoundingClientRect().y)""",ids)
        check(f'{width}: sliders before dial, Apply at both ends',
              all(a<b for a,b in zip(positions,positions[1:])))
        check(f'{width}: no horizontal overflow',
              page.evaluate('document.documentElement.scrollWidth<=innerWidth+2'))
        page.locator('#play').click()
        page.locator('#releaseExact').fill('47')
        page.locator('#preset').select_option('orbit')
        page.locator('#applyTop').click()
        check(f'{width}: top ensemble Apply',
              page.evaluate('Pendulums.status.releaseHeading===47 && Pendulums.status.preset==="orbit"'))
        page.locator('#releaseExact').fill('137')
        page.locator('#preset').select_option('fan')
        page.locator('#apply').click()
        check(f'{width}: bottom ensemble Apply',
              page.evaluate('Pendulums.status.releaseHeading===137 && Pendulums.status.preset==="fan"'))
        page.locator('#studioPath').select_option('0')
        page.locator('#soloNextTop').click()
        check(f'{width}: top Next',page.locator('#studioPath').input_value()=='1')
        page.locator('#soloNext').click()
        check(f'{width}: bottom Next',page.locator('#studioPath').input_value()=='2')
        page.locator('#soloPreset').select_option('rosette')
        page.locator('#soloHeading').fill('218')
        other=page.evaluate('Pendulums.getSnapshot().tracks[0].current')
        page.locator('#soloApplyTop').click()
        check(f'{width}: top solo Apply preserves other bobs',
              page.evaluate('Pendulums.getSnapshot().tracks[2].config.phi===218') and
              page.evaluate('Pendulums.getSnapshot().tracks[0].current')==other)
        page.locator('#soloNext').click()
        page.locator('#soloPreset').select_option('fan')
        page.locator('#soloHeading').fill('64')
        page.locator('#soloApply').click()
        check(f'{width}: bottom solo Apply',
              page.evaluate('Pendulums.getSnapshot().tracks[3].config.phi===64'))
        page.locator('#focus').select_option('4')
        check(f'{width}: inspector labels both update',
              page.locator('#updateNumber').inner_text()=='05' and
              page.locator('#updateNumberTop').inner_text()=='05')
        page.locator('#editPhi').fill('111')
        page.locator('#updateOneTop').click()
        check(f'{width}: top inspector Apply',
              page.evaluate('Pendulums.getSnapshot().tracks[4].config.phi===111'))
        page.locator('#editPhi').fill('222')
        page.locator('#updateOne').click()
        check(f'{width}: bottom inspector Apply',
              page.evaluate('Pendulums.getSnapshot().tracks[4].config.phi===222'))
        check(f'{width}: zero script errors',not errors)
        page.close()
    browser.close()
print(f'{len(checks)}/{len(checks)} mirrored action checks passed')
