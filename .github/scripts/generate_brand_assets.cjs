// Offline asset exports. Dev tools only; the site has no runtime dependencies.
// npm install --prefix /tmp/philipp-artwork --no-audit --no-fund @resvg/resvg-js sharp
// NODE_PATH=/tmp/philipp-artwork/node_modules node .github/scripts/generate_brand_assets.cjs
const fs = require('node:fs');
const path = require('node:path');
const { Resvg } = require('@resvg/resvg-js');
const sharp = require('sharp');
const root = path.resolve(__dirname, '../..');
const svg = fs.readFileSync(path.join(root, 'favicon.svg'));
const png = (size, opaque=false) => new Resvg(svg, { fitTo: { mode: 'width', value: size }, ...(opaque ? {background:'#faf9f6'} : {}) }).render().asPng();
(async () => {
  fs.writeFileSync(path.join(root, 'favicon-32.png'), png(32));
  fs.writeFileSync(path.join(root, 'apple-touch-icon.png'), png(180,true));
  const sizes = [16, 32, 48];
  const images = await Promise.all(sizes.map(async size => {
    const {data} = await sharp(png(size)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    // Windows DIB entries support older icon readers, unlike PNG-only ICO files.
    const maskStride = Math.ceil(size / 32) * 4;
    const bitmap = Buffer.alloc(40 + size * size * 4 + maskStride * size);
    bitmap.writeUInt32LE(40,0); bitmap.writeInt32LE(size,4); bitmap.writeInt32LE(size*2,8);
    bitmap.writeUInt16LE(1,12); bitmap.writeUInt16LE(32,14); bitmap.writeUInt32LE(size*size*4,20);
    for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
      const from=(y*size+x)*4, to=40+((size-1-y)*size+x)*4;
      if(data[from+3]<128) bitmap[40+size*size*4+(size-1-y)*maskStride+(x>>3)] |= 128>>(x&7);
      bitmap[to]=data[from+2]; bitmap[to+1]=data[from+1]; bitmap[to+2]=data[from]; bitmap[to+3]=data[from+3];
    }
    return bitmap;
  }));
  const directory = Buffer.alloc(6 + sizes.length * 16);
  directory.writeUInt16LE(1,2); directory.writeUInt16LE(sizes.length,4);
  let offset=directory.length;
  images.forEach((data,i)=>{
    const at=6+i*16; directory[at]=sizes[i]; directory[at+1]=sizes[i];
    directory.writeUInt16LE(1,at+4); directory.writeUInt16LE(32,at+6);
    directory.writeUInt32LE(data.length,at+8); directory.writeUInt32LE(offset,at+12); offset+=data.length;
  });
  fs.writeFileSync(path.join(root, 'favicon.ico'), Buffer.concat([directory,...images]));
  // Encoding/size optimization only: retain the full existing lake composition.
  await sharp(path.join(root, 'assets/lake-1440.webp'))
    .resize(1200,600).flatten({background:'#faf9f6'}).jpeg({quality:72,progressive:false,trellisQuantisation:true,overshootDeringing:true,quantisationTable:3})
    .toFile(path.join(root, 'assets/share-lake-v1.jpg'));
})();
