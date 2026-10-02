from pathlib import Path
from PIL import Image,ImageDraw
import json
root=Path(__file__).resolve().parents[3];dest=Path(__file__).parent
sheets=[('12_58_22',['Small Market',"Builder's Yard",'Hacienda']),('12_59_06',['Small Warehouse','Hospital','Large Market']),('12_59_15',['Large Warehouse','Factory','Harbor']),('12_59_22',['Office','School','Wharf']),('12_59_28',['Small Fruit Depot','Large Fruit Depot','Large Tobacco Storage']),('12_59_38',['Small Sugar Mill','Large Sugar Mill','Large Coffee Roaster'])]
manifest=[];contact=Image.new('RGB',(1500,1800),'white');draw=ImageDraw.Draw(contact)
for row,(time,names) in enumerate(sheets):
 source=root/'import'/f'ChatGPT Image 2 Oct 2026, {time}.png';im=Image.open(source).convert('RGB');assert im.size==(2172,724)
 for col,name in enumerate(names):
  # Remove the caption strip while retaining each complete miniature.
  cuts=[[(0,0,680,598),(690,0,1370,598),(1370,0,2048,598)],[(0,0,690,565),(695,0,1338,565),(1345,0,2048,565)],[(0,0,690,558),(695,0,1340,563),(1345,0,2048,572)],[(0,0,680,555),(688,0,1320,559),(1330,0,2048,577)],[(0,0,603,545),(610,0,1334,557),(1337,0,2048,557)],[(0,0,603,552),(610,0,1344,563),(1360,0,2048,559)]];box=tuple(round(v*2172/2048) for v in cuts[row][col]);tile=im.crop(box);
  if name=='Wharf':
   # Erase the few caption pixels extending into the margin, outside the tile.
   for py in range(tile.height-12,tile.height):
    for px in range(tile.width):
     rgb=tile.getpixel((px,py))
     if min(rgb)>175 and max(rgb)-min(rgb)<45:tile.putpixel((px,py),tile.getpixel((px,tile.height-20)))
  tile.save(dest/'references'/f'{name}.png');manifest.append({'name':name,'source':str(source.relative_to(root)),'crop':box,'reference':f'references/{name}.png','file':f'{name}.glb'})
  tile.thumbnail((480,260));x=col*500;y=row*300;contact.paste(tile,(x+(500-tile.width)//2,y));draw.text((x+15,y+273),name,fill='black')
(dest/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');contact.save(dest/'references-preview.jpg')
