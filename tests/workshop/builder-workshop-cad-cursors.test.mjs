import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import zlib from "node:zlib";
import crypto from "node:crypto";

const source=fs.readFileSync(new URL("../../index.html",import.meta.url),"utf8");
const cursorCss=source.match(/<style id="builderWorkshopCadCursorCSS">([\s\S]*?)<\/style>/)?.[1]??"";
const sourceAssetUrl=new URL("../../assets/images/cursors/thinkamigbob-precision-driver.png",import.meta.url);
const cursorAssetUrl=new URL("../../assets/images/cursors/thinkamigbob-precision-driver-cursor-v2.png",import.meta.url);

function readRgbaPng(url){
  const png=fs.readFileSync(url);
  assert.equal(png.subarray(1,4).toString(),"PNG");
  const width=png.readUInt32BE(16);
  const height=png.readUInt32BE(20);
  assert.equal(png[24],8,"cursor PNG must use 8-bit channels");
  assert.equal(png[25],6,"cursor PNG must preserve RGBA transparency");
  const chunks=[];
  for(let offset=8;offset<png.length;){
    const length=png.readUInt32BE(offset);
    const type=png.subarray(offset+4,offset+8).toString();
    if(type==="IDAT") chunks.push(png.subarray(offset+8,offset+8+length));
    offset+=12+length;
  }
  const raw=zlib.inflateSync(Buffer.concat(chunks));
  const stride=width*4;
  const pixels=Buffer.alloc(stride*height);
  let input=0;
  for(let y=0;y<height;y++){
    const filter=raw[input++];
    for(let x=0;x<stride;x++){
      const encoded=raw[input++];
      const left=x>=4?pixels[y*stride+x-4]:0;
      const up=y?pixels[(y-1)*stride+x]:0;
      const upperLeft=(y&&x>=4)?pixels[(y-1)*stride+x-4]:0;
      let value=encoded;
      if(filter===1) value+=left;
      else if(filter===2) value+=up;
      else if(filter===3) value+=Math.floor((left+up)/2);
      else if(filter===4){
        const p=left+up-upperLeft;
        const pa=Math.abs(p-left),pb=Math.abs(p-up),pc=Math.abs(p-upperLeft);
        value+=pa<=pb&&pa<=pc?left:pb<=pc?up:upperLeft;
      }else assert.equal(filter,0,`unsupported PNG filter ${filter}`);
      pixels[y*stride+x]=value&255;
    }
  }
  return {width,height,pixels,pixel(x,y){
    const i=(y*width+x)*4;
    return pixels.subarray(i,i+4);
  }};
}

test("approved Precision Driver replaces the Hammer in the authoritative cursor path",()=>{
  assert.match(cursorCss,/--builder-tools-precision-driver-cursor:url\("\.\/assets\/images\/cursors\/thinkamigbob-precision-driver-cursor-v2\.png"\) 58 20,pointer;/);
  assert.match(cursorCss,/cursor:var\(--builder-tools-precision-driver-cursor\) !important/);
  assert.doesNotMatch(cursorCss,/hammer/i);
  assert.ok(fs.existsSync(sourceAssetUrl));
  assert.ok(fs.existsSync(cursorAssetUrl));
  assert.equal(
    crypto.createHash("sha256").update(fs.readFileSync(sourceAssetUrl)).digest("hex"),
    "4abd67e2ce3c0d3aec9be84228c20523ece3717665175ba91bbc17a805ec9b6a",
    "the authoritative source must remain byte-for-byte identical to the approved attachment"
  );
});

test("source and optimized assets preserve the approved aspect ratio and bounded cursor canvas",()=>{
  const approved=readRgbaPng(sourceAssetUrl);
  const cursor=readRgbaPng(cursorAssetUrl);
  assert.deepEqual([approved.width,approved.height],[1836,1224]);
  assert.equal(approved.width/approved.height,3/2);
  assert.deepEqual([cursor.width,cursor.height],[64,42]);
  assert.ok(cursor.width<=128&&cursor.height<=128,"Chromium cursor canvas must stay bounded");
});

test("external aqua plus is separated from the driver bit and owns the exact hotspot",()=>{
  const cursor=readRgbaPng(cursorAssetUrl);
  const aqua=[];
  for(let y=0;y<cursor.height;y++) for(let x=0;x<cursor.width;x++){
    const [r,g,b,a]=cursor.pixel(x,y);
    if(a>200&&r===94&&g===234&&b===255) aqua.push([x,y]);
  }
  assert.ok(aqua.length>0,"aqua precision plus must be painted");
  const xs=aqua.map(([x])=>x),ys=aqua.map(([,y])=>y);
  assert.deepEqual([Math.min(...xs),Math.max(...xs),Math.min(...ys),Math.max(...ys)],[56,60,18,22]);
  assert.ok(aqua.some(([x,y])=>x===58&&y===20),"plus center must be painted at the hotspot");

  let driverRight=-1;
  const bitYs=[];
  for(let x=0;x<56;x++) for(let y=0;y<cursor.height;y++){
    const alpha=cursor.pixel(x,y)[3];
    if(alpha>=16){
      if(x>driverRight){driverRight=x;bitYs.length=0;}
      if(x===driverRight) bitYs.push(y);
    }
  }
  const plusLeft=Math.min(...xs);
  const paintedGap=plusLeft-driverRight-1;
  assert.ok(paintedGap>=2&&paintedGap<=4,`expected a 2-4px painted gap, received ${paintedGap}`);
  assert.ok(Math.min(...bitYs)<=20&&Math.max(...bitYs)>=20,"plus must align with the driver-bit axis");
  assert.match(cursorCss,/\) 58 20,pointer;/,"CSS hotspot must equal the plus center");
});

test("only the live renderer surface keeps the unchanged CAD crosshair",()=>{
  assert.match(cursorCss,/--builder-cad-crosshair-cursor:url\("data:image\/svg\+xml/);
  assert.match(cursorCss,/body:not\(\.starterScreenActive\) > canvas:not\(#viewCubeCanvas\)\{\s*cursor:var\(--builder-cad-crosshair-cursor\) !important;/);
  assert.doesNotMatch(cursorCss,/#viewCubeCanvas\{[^}]*builder-cad-crosshair-cursor/);
});

test("View Cube preserves grab and starter page remains unaffected",()=>{
  assert.match(cursorCss,/#viewCubeCanvas\{\s*cursor:grab !important;/);
  assert.match(cursorCss,/#viewCubeCanvas:active\{\s*cursor:grabbing !important;/);
  assert.doesNotMatch(cursorCss,/body\.starterScreenActive[^\n{]*\{/);
});

test("enabled interface controls consistently use the hand pointer",()=>{
  assert.match(cursorCss,/button:not\(:disabled\)[\s\S]*?\[role="button"\]:not\(\[aria-disabled="true"\]\)[\s\S]*?cursor:pointer !important;/);
  assert.match(cursorCss,/input:is\(\[type="button"\],\[type="submit"\],\[type="reset"\],\[type="checkbox"\],\[type="radio"\],\[type="range"\]\):not\(:disabled\)/);
  assert.match(cursorCss,/button:disabled[\s\S]*?\[aria-disabled="true"\][\s\S]*?cursor:not-allowed !important;/);
  assert.ok(
    cursorCss.indexOf("cursor:pointer !important")>cursorCss.indexOf("cursor:var(--builder-tools-precision-driver-cursor) !important"),
    "the actionable-control exception must follow the broad interface cursor rule"
  );
});

test("Gear progress remains a reward icon rather than cursor artwork",()=>{
  assert.match(source,/builderGearProgressIcon[^>]*aria-hidden="true">⚙<\/span>/);
  assert.doesNotMatch(cursorCss,/goldGear|gear-cursor/i);
});
