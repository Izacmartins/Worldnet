/**
 * Padrão urbano determinístico: avenidas sempre transitáveis, praças abertas,
 * e lotes sólidos sem edifícios. Um catálogo idêntico produz o mesmo mapa.
 */
export function hashPlot(value) {
  let h = 2166136261;
  for (const char of String(value)) h = Math.imul(h ^ char.charCodeAt(0), 16777619);
  return h >>> 0;
}
export function isOpenPlot(x,y) {
  if(x===0 && y===0) return false;
  const ring=Math.max(Math.abs(x),Math.abs(y));
  // Primeira vizinhança: apenas quatro fachadas, com quatro praças vazias.
  if(ring===1) return x!==0 && y!==0;
  // Fendas e pequenas praças no miolo e fora dele, sem impedir circular.
  const probability=ring<=3?42:ring<=10?32:25;
  return (hashPlot(`worldnet:park:${x},${y}`)%100)<probability;
}
export function terrainVariant(x,y) {
  return hashPlot(`worldnet:street:${x},${y}`)%12;
}
