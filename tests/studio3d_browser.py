"""3D mobile/desktop interaction smoke tests on locally injected source, never the hosted site."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
checks=[]
def good(name,value):
    if not value:raise AssertionError(name)
    checks.append(name)
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    for width in (390,1280):
        page=browser.new_page(viewport={'width':width,'height':800},accept_downloads=True,has_touch=(width==390))
        errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
        markup=(ROOT/'index.html').read_text()
        for file in ['physics.js','app.js','studio3d.js']:
            markup=markup.replace(f'<script src="{file}"></script>','')
        page.set_content(markup,wait_until='load')
        for file in ['style.css','studio3d.css']:page.add_style_tag(content=(ROOT/file).read_text())
        for file in ['physics.js','app.js','studio3d.js']:page.add_script_tag(content=(ROOT/file).read_text())
        page.wait_for_timeout(900)
        good(f'{width} no JS errors',not errors)
        good(f'{width} no sideways overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth+2'))
        good(f'{width} XYZ canvas visible',page.locator('#space3d').is_visible())
        good(f'{width} actual XYZ trail positions',page.evaluate('PendulumsStudio.getRecordedFrame().tracks.every(t=>t.samples.length>3&&t.samples[0].length===3)'))
        good(f'{width} physics measurements retained',page.evaluate('Pendulums.getSnapshot().tracks[0].samples[0].length===9'))
        page.locator('#play').click()
        snap=page.evaluate('Pendulums.getSnapshot()')
        before=snap['tracks'][0]['current']['r']
        good(f'{width} fixed pendulum geometry',abs(sum(v*v for v in before)**.5-snap['tracks'][0]['config']['length'])<1e-9)
        xyz=page.evaluate('PendulumsStudio.projectPoint(2,3,4)')
        page.locator('#studioTop').click()
        xyz2=page.evaluate('PendulumsStudio.projectPoint(2,3,4)')
        good(f'{width} camera top changes projection',xyz[:2]!=xyz2[:2])
        page.locator('#studioSide').click()
        good(f'{width} side camera elevation',page.evaluate('PendulumsStudio.state.pitch')==0)
        page.locator('#studioUnder').click()
        good(f'{width} underside view available',page.evaluate('PendulumsStudio.state.pitch')<0)
        page.locator('#studioIso').click()
        camera=page.evaluate('PendulumsStudio.state')
        page.locator('#studioZoomIn').click()
        good(f'{width} zoom in',page.evaluate('PendulumsStudio.state.zoom')>camera['zoom'])
        page.locator('#studioPan').click()
        good(f'{width} pan mode toggle',page.evaluate('PendulumsStudio.state.mode')=='pan')
        page.locator('#studioLeft').click()
        good(f'{width} camera pan',page.evaluate('PendulumsStudio.state')!=camera)
        page.locator('#studioPan').click()
        # Synthetic touch pointers exercise the same PointerEvent path as native touch.
        page.evaluate('''()=>{
          const c=document.querySelector('#space3d'); c.setPointerCapture=()=>{};
          const fire=(name,id,x,y,buttons=1)=>c.dispatchEvent(new PointerEvent(name,{pointerId:id,pointerType:'touch',clientX:x,clientY:y,buttons,bubbles:true,cancelable:true}));
          fire('pointerdown',11,100,200);fire('pointermove',11,180,230);fire('pointerup',11,180,230,0);
        }''')
        good(f'{width} touch orbit',page.evaluate('PendulumsStudio.state.yaw')!=camera['yaw'])
        z=page.evaluate('PendulumsStudio.state.zoom')
        page.evaluate('''()=>{
          const c=document.querySelector('#space3d');c.setPointerCapture=()=>{};
          const fire=(name,id,x,y,buttons=1)=>c.dispatchEvent(new PointerEvent(name,{pointerId:id,pointerType:'touch',clientX:x,clientY:y,buttons,bubbles:true,cancelable:true}));
          fire('pointerdown',21,100,200);fire('pointerdown',22,200,200);
          fire('pointermove',21,80,200);fire('pointermove',22,230,200);
          fire('pointermove',21,70,200);fire('pointermove',22,250,200);
          fire('pointerup',21,70,200,0);fire('pointerup',22,250,200,0);
        }''')
        good(f'{width} two finger pinch',page.evaluate('PendulumsStudio.state.zoom')>z)
        before_phys=page.evaluate('Pendulums.getSnapshot().tracks[0].current.r')
        page.locator('#studioPalette').select_option('neon')
        good(f'{width} custom palette set',page.evaluate('Pendulums.getSnapshot().tracks[0].config.color')=='#ff64b1')
        good(f'{width} color does not alter dynamics',page.evaluate('Pendulums.getSnapshot().tracks[0].current.r')==before_phys)
        page.locator('#studioCustom').fill('#19e8be')
        good(f'{width} single trail recolor',page.evaluate('Pendulums.getSnapshot().tracks[0].config.color')=='#19e8be')
        page.locator('#studioFreeze').click()
        good(f'{width} art layer frozen',page.evaluate('PendulumsStudio.state.layerCount')==1)
        saved=page.evaluate('PendulumsStudio.getArtwork()')
        good(f'{width} archived records in physical XYZ',saved[0]['tracks'][0]['samples'][0][2]>0)
        page.locator('#preset').select_option('fan')
        page.locator('#apply').click()
        good(f'{width} old art preserved after new pattern',page.evaluate('PendulumsStudio.state.layerCount')==2)
        page.wait_for_timeout(60)
        good(f'{width} custom colors preserved after preset switch',page.evaluate('Pendulums.getSnapshot().tracks[0].config.color')=='#19e8be')
        page.locator('#studioKeep').uncheck()
        page.locator('#preset').select_option('orbit')
        page.locator('#apply').click()
        good(f'{width} optional no-layer mode',page.evaluate('PendulumsStudio.state.layerCount')==2)
        with page.expect_download() as info:page.locator('#studioSaveArt').click()
        tempfile=ROOT/'tests'/f'_art_{width}.json';info.value.save_as(str(tempfile))
        art=json.loads(tempfile.read_text());tempfile.unlink()
        good(f'{width} serialized valid art',art['format']=='pendulums-art-studio' and len(art['layers'])==2)
        page.locator('#studioClearArt').click()
        good(f'{width} clear layers only',page.evaluate('PendulumsStudio.state.layerCount')==0 and page.evaluate('Pendulums.getSnapshot().tracks.length')==12)
        page.locator('#studioImportArt').set_input_files({'name':'art.json','mimeType':'application/json','buffer':json.dumps(art).encode()})
        page.wait_for_function('PendulumsStudio.state.layerCount===2')
        good(f'{width} art JSON import restores layers',page.evaluate('PendulumsStudio.state.layerCount')==2)
        bad={'format':'pendulums-art-studio','version':1,'layers':[{'label':'bad','visible':True,'tracks':[{'color':'#eeeeee','visible':True,'samples':[[float('inf'),0,0]]}]}]}
        page.locator('#studioImportArt').set_input_files({'name':'bad.json','mimeType':'application/json','buffer':json.dumps(bad).encode()})
        page.wait_for_timeout(100)
        good(f'{width} invalid art refused',page.evaluate('PendulumsStudio.state.layerCount')==2)
        good(f'{width} no page errors after all controls',not errors)
        page.close()
    browser.close()
print(f'{len(checks)}/{len(checks)} browser checks passed')
