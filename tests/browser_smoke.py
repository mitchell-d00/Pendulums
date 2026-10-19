"""Real Chromium smoke tests with local HTML/CSS/JS injection; no network required."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'index.html').read_text()
CSS=(ROOT/'style.css').read_text()
PHYSICS=(ROOT/'physics.js').read_text()
APP=(ROOT/'app.js').read_text()


def run():
    results=[]
    def check(name, passed):
        if not passed:
            raise AssertionError(name)
        results.append(name)
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        for width in (390, 1280):
            page=browser.new_page(viewport={'width':width,'height':820}, accept_downloads=True)
            errors=[]
            page.on('pageerror',lambda exc: errors.append(str(exc)))
            page.set_content(HTML,wait_until='load')
            page.add_style_tag(content=CSS)
            page.add_script_tag(content=PHYSICS)
            page.add_script_tag(content=APP)
            page.wait_for_timeout(1500)
            check(f'{width} loads no errors',not errors)
            check(f'{width} has 12 pendulums',page.evaluate('Pendulums.status.count')==12)
            check(f'{width} has 12 recorded trajectories',page.evaluate('Pendulums.getSnapshot().tracks.every(p=>p.samples.length>2)'))
            check(f'{width} has distinct color per path',page.evaluate('new Set(Pendulums.getSnapshot().tracks.map(p=>p.config.color)).size===12'))
            check(f'{width} actual xyz change',page.evaluate('Pendulums.getSnapshot().tracks.some(p=>{const s=p.samples;return Math.hypot(s[0][1]-s.at(-1)[1],s[0][2]-s.at(-1)[2])>.00001})'))
            check(f'{width} table all 12',page.locator('#rows tr').count()==12)
            check(f'{width} mobile no horizontal overflow',page.evaluate('document.documentElement.scrollWidth <= window.innerWidth+2'))
            check(f'{width} visible canvas',page.locator('#sand').is_visible())
            page.locator('#play').click()
            check(f'{width} pause works',not page.evaluate('Pendulums.status.running'))
            t=page.evaluate('Pendulums.status.time')
            page.wait_for_timeout(150)
            check(f'{width} pause freezes time',abs(page.evaluate('Pendulums.status.time')-t)<1e-9)
            page.locator('#focus').select_option('7')
            check(f'{width} select eighth path',page.locator('#focusNumber').inner_text()=='08')
            page.locator('#editTheta').fill('47')
            page.locator('#updateOne').click()
            check(f'{width} edit changes only eighth',page.evaluate('Pendulums.getSnapshot().tracks[7].config.theta')==47)
            page.locator('#count').fill('30')
            page.locator('#preset').select_option('orbit')
            page.locator('#apply').click()
            check(f'{width} supports 30 pendulums',page.evaluate('Pendulums.status.count')==30)
            check(f'{width} supports 30 unique path colors',page.evaluate('new Set(Pendulums.getSnapshot().tracks.map(p=>p.config.color)).size===30'))
            check(f'{width} has 30 rows',page.locator('#rows tr').count()==30)
            page.locator('#play').click()
            page.wait_for_timeout(450)
            page.locator('#play').click()
            check(f'{width} 30 traces advance',page.evaluate('Pendulums.getSnapshot().tracks.every(p=>p.samples.length>5)'))
            with page.expect_download() as info:
                page.locator('#csv').click()
            csv=info.value
            csvpath=ROOT/'tests'/'_temp.csv'
            csv.save_as(str(csvpath))
            rows=csvpath.read_text().splitlines()
            check(f'{width} csv 30 IDs',len({r.split(',')[0] for r in rows[1:]})==30)
            csvpath.unlink()
            with page.expect_download() as info:
                page.locator('#json').click()
            path=ROOT/'tests'/'_temp.json'
            info.value.save_as(str(path))
            session=json.loads(path.read_text())
            check(f'{width} json 30 tracks',len(session['tracks'])==30)
            check(f'{width} json has kinetic data',len(session['tracks'][0]['samples'][0])==9)
            page.locator('#clear').click()
            check(f'{width} clear sand starts new paths',page.evaluate('Pendulums.getSnapshot().tracks.every(t=>t.samples.length===1)'))
            check(f'{width} clear sand retains pendulum positions',page.evaluate('Pendulums.getSnapshot().tracks.some(t=>Math.abs(t.current.r[0])>.1)'))
            # restored data must be allowed on a subsequent JSON import
            page.locator('#file').set_input_files(str(path))
            page.wait_for_timeout(250)
            check(f'{width} import retains 30 tracks',page.evaluate('Pendulums.getSnapshot().tracks.length===30'))
            check(f'{width} import restores time',abs(page.evaluate('Pendulums.status.time')-session['elapsed'])<1e-8)
            check(f'{width} import restores recorded samples',page.evaluate('Pendulums.getSnapshot().tracks[0].samples.length')==len(session['tracks'][0]['samples']))
            check(f'{width} imported session paused',page.evaluate('Pendulums.status.running')==False)
            path.unlink()
            # Export SVG should contain per-path geometry
            with page.expect_download() as info:
                page.locator('#svg').click()
            svgpath=ROOT/'tests'/'_temp.svg'
            info.value.save_as(str(svgpath))
            svg=svgpath.read_text()
            check(f'{width} svg contains 30 drawn paths',svg.count('<path ')>=30)
            svgpath.unlink()
            with page.expect_download() as info:
                page.locator('#png').click()
            check(f'{width} png has extension',info.value.suggested_filename.endswith('.png'))
            check(f'{width} no page errors after interactions',not errors)
            page.close()
        browser.close()
    print(f'{len(results)} / {len(results)} browser checks passed')


if __name__=='__main__':
    run()
