import './vendor/polygon-clipping.js';

// A shared junction has one perimeter, including the island between its lanes.
// Union the actual floor footprints before constructing any upright walls.
export function junctionFootprint(lanes,half) {
 const polygons=lanes.map(({points,sides})=>{
  const edge=sign=>points.map((p,i)=>[p.x+sign*sides[i].x*half,p.z+sign*sides[i].z*half]);
  const ring=[...edge(-1),...edge(1).reverse()];ring.push(ring[0]);return [ring];
 });
 return globalThis.polygonClipping.union(...polygons);
}
