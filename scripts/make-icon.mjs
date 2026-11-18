import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {deflateSync} from 'node:zlib';
const root=fileURLToPath(new URL('../',import.meta.url));
const size=256, pixels=Buffer.alloc(size*(size*4+1));
function distance(x,y,ax,ay,bx,by){const dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy)));return Math.hypot(x-ax-t*dx,y-ay-t*dy)}
for(let y=0;y<size;y++){pixels[y*(size*4+1)]=0;for(let x=0;x<size;x++){
 const corner=Math.hypot(Math.max(0,Math.abs(x-127.5)-86),Math.max(0,Math.abs(y-127.5)-86));
 const alpha=Math.min(1,Math.max(0,40-corner));let rgb=[38,30,51];
 if(corner>36)rgb=[118,87,153];
 const d=Math.min(distance(x,y,67,82,111,126),distance(x,y,111,126,67,170),distance(x,y,139,170,188,170));
 if(d<7)rgb=[203,172,247];
 const i=y*(size*4+1)+1+x*4;pixels.set([...rgb,Math.round(alpha*255)],i);
}}
function crc32(bytes){let crc=0xffffffff;for(const b of bytes){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}return (crc^0xffffffff)>>>0}
function chunk(name,data){const tag=Buffer.from(name);const length=Buffer.alloc(4);length.writeUInt32BE(data.length);const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(Buffer.concat([tag,data])));return Buffer.concat([length,tag,data,crc])}
const header=Buffer.alloc(13);header.writeUInt32BE(size,0);header.writeUInt32BE(size,4);header[8]=8;header[9]=6;
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);
const ico=Buffer.alloc(22);ico.writeUInt16LE(1,2);ico.writeUInt16LE(1,4);ico.writeUInt16LE(1,10);ico.writeUInt16LE(32,12);ico.writeUInt32LE(png.length,14);ico.writeUInt32LE(22,18);
fs.mkdirSync(path.join(root,'build'),{recursive:true});fs.writeFileSync(path.join(root,'build','icon.png'),png);fs.writeFileSync(path.join(root,'build','icon.ico'),Buffer.concat([ico,png]));
console.log('Created Academy desktop icons.');
