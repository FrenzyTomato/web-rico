import { CanvasTexture, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from 'three';

// One tiny, original badge texture shared by all owned worker spaces.
let badge: { geometry: PlaneGeometry; material: MeshBasicMaterial } | undefined;
function medallion() {
  if (badge) return badge;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const g = canvas.getContext('2d')!;
  const disc = (radius: number, fill: string | CanvasGradient) => {
    g.fillStyle = fill; g.beginPath(); g.arc(64, 64, radius, 0, Math.PI * 2); g.fill();
  };
  // Bevelled brass rim, dark inset and an engraved crew silhouette.
  g.shadowColor = '#162c3080'; g.shadowBlur = 5; g.shadowOffsetY = 3;
  disc(57, '#675333'); g.shadowBlur = 0; g.shadowOffsetY = 0;
  const brass = g.createLinearGradient(16, 12, 110, 119);
  brass.addColorStop(0, '#fff0bb'); brass.addColorStop(.45, '#d0af6d'); brass.addColorStop(1, '#887045');
  disc(54, brass); disc(45, '#725f3e');
  const inset = g.createRadialGradient(49, 41, 3, 64, 68, 46);
  inset.addColorStop(0, '#345953'); inset.addColorStop(1, '#182e30'); disc(42, inset);
  g.strokeStyle = '#c6a970'; g.lineWidth = 1.5;
  g.beginPath(); g.arc(64, 64, 37, 0, Math.PI * 2); g.stroke();
  // Four small rivets keep the decoration legible at miniature size.
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    g.fillStyle = '#fff0bb'; g.beginPath(); g.arc(64 + Math.cos(a) * 49, 64 + Math.sin(a) * 49, 2.5, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = '#cfb77f';
  g.beginPath(); g.arc(64, 51, 10, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(44, 84); g.quadraticCurveTo(43, 66, 56, 65); g.lineTo(72, 65); g.quadraticCurveTo(85, 66, 84, 84); g.closePath(); g.fill();
  const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace;
  badge = { geometry: new PlaneGeometry(0.34, 0.34), material: new MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false }) };
  return badge;
}

export function WorkerMedallion() {
  const { geometry, material } = medallion();
  // Draw after the transparent island surface; depth testing still lets workers cover the slot.
  return <mesh renderOrder={5} position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]} geometry={geometry} material={material} dispose={null} />;
}
