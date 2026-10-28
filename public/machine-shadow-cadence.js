export function createShadowCadence(interval=2){
 let frame=0;
 return {next({playing,dirty}){if(dirty)return true;if(!playing)return false;return frame++%interval===0;}};
}
