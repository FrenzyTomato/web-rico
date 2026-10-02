from pathlib import Path
from PIL import Image,ImageDraw
import json
P=Path(__file__).parent
items=[r for r in json.loads((P/'manifest.json').read_text()) if (P/'previews'/f"{r['name']}.png").exists()]
out=Image.new('RGB',(1200,260*((len(items)+2)//3)),'#19383b');draw=ImageDraw.Draw(out)
for i,r in enumerate(items):
 im=Image.open(P/'previews'/f"{r['name']}.png").resize((400,225));x=i%3*400;y=i//3*260;out.paste(im,(x,y));draw.text((x+12,y+235),r['name'],fill='white')
out.save(P/'collection-preview.jpg')
for start in range(0,len(items),6):out.crop((0,start//3*260,1200,min((start+6)//3*260,out.height))).save(P/f'review-{start//6+1}.jpg')
