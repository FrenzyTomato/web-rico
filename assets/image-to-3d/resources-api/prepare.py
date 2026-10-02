from pathlib import Path
from PIL import Image,ImageDraw
import json
P=Path(__file__).parent; ROOT=P.resolve().parents[2]; rows=[]
def add(stamp,category,entries,scaled=False):
 source=ROOT/'import'/f'ChatGPT Image 2 Oct 2026, {stamp}.png';im=Image.open(source).convert('RGB')
 for name,box in entries:
  if scaled:box=tuple(round(v*2172/2048) for v in box)
  tile=im.crop(box)
  if name=='Customs House':ImageDraw.Draw(tile).rectangle((924-box[0],388-box[1],1303-box[0],tile.height),fill=im.getpixel((920,420)))
  tile.save(P/'references'/f'{name}.png');rows.append(dict(name=name,category=category,source=str(source.relative_to(ROOT)),crop=box,reference=f'references/{name}.png',file=f'{name}.glb',method='local-textured-tile' if category=='command' else 'meshy'))
add('13_45_17','building', [('City Hall',(65,10,755,386)),('Customs House',(770,60,1536,414)),('Fire Station',(0,510,555,855)),('Fortress',(555,488,1040,855)),('Residence',(1030,538,1536,855))])
add('13_37_24','worker',[(f'Worker {i+1:02d}',(a,95,b,625)) for i,(a,b) in enumerate([(95,425),(520,810),(885,1195),(1280,1550),(1635,1940)])],True)
add('13_37_17','goods',[(name+' Crate',(a,150,b,535)) for name,a,b in [('Corn',30,430),('Sugar',440,830),('Banana',840,1230),('Coffee',1240,1635),('Tobacco',1645,2048)]],True)
add('13_36_59','boat', [('4-Slot Boat',(300,45,550,380)),('5-Slot Boat',(645,15,920,380)),('6-Slot Boat',(975,0,1260,380)),('7-Slot Boat',(135,460,415,895)),('8-Slot Boat',(465,458,730,895)),('Private Boat',(800,550,1045,884))])
add('13_36_59','depot',[('Trader Depot',(1100,480,1480,895))])
add('13_38_12','command',[(n+' Command Tile',b) for n,b in [('Craftsman',(41,29,390,481)),('Trader',(414,29,759,481)),('Captain',(782,29,1129,481)),('Adventurer',(1154,29,1500,481)),('Planter',(221,514,577,971)),('Recruiter',(599,514,945,971)),('Builder',(968,514,1320,971))]])
(P/'manifest.json').write_text(json.dumps(rows,indent=2)+'\n')
out=Image.new('RGB',(1250,250*((len(rows)+4)//5)),'#eee4d1');draw=ImageDraw.Draw(out)
for i,r in enumerate(rows):
 im=Image.open(P/r['reference']);im.thumbnail((240,212));x=i%5*250;y=i//5*250;out.paste(im,(x+(250-im.width)//2,y));draw.text((x+8,y+225),r['name'],fill='black')
out.save(P/'references-preview.jpg')
