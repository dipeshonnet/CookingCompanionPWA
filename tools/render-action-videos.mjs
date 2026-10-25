// Rebuild original, silent illustrated cooking loops using Chromium's WebM encoder.
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { ACTION_TYPES, actionVideoSource } from '../modules/action-types.js';
const require = createRequire(process.env.PLAYWRIGHT_MODULE_PATH || import.meta.url);
const { chromium } = process.env.PLAYWRIGHT_MODULE_PATH ? require(process.env.PLAYWRIGHT_MODULE_PATH) : require('playwright');
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' });
await mkdir('assets/actions', { recursive: true });
try {
  for (const type of ACTION_TYPES) {
    const page = await browser.newPage();
    const bytes = await page.evaluate(async type => {
      const canvas = document.createElement('canvas'); canvas.width = 400; canvas.height = 250;
      const c = canvas.getContext('2d');
      const line = (x,y,X,Y,color='#425849',w=5) => {c.strokeStyle=color;c.lineWidth=w;c.lineCap='round';c.beginPath();c.moveTo(x,y);c.lineTo(X,Y);c.stroke();};
      const box = (x,y,w,h,color,r=8) => {c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();};
      const dot = (x,y,r,color) => {c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();};
      const bowl = () => { c.fillStyle='#a7c8b5';c.beginPath();c.ellipse(200,159,91,47,0,0,Math.PI);c.fill();c.fillStyle='#e2eee3';c.beginPath();c.ellipse(200,155,91,18,0,0,Math.PI*2);c.fill(); };
      function draw(t) {
        const a = t*Math.PI*2, wave=Math.sin(a), lift=(1-Math.cos(a*2))*12;
        c.fillStyle='#fff7eb';c.fillRect(0,0,400,250);
        c.fillStyle='#345542';c.font='600 21px sans-serif';c.textAlign='center';c.fillText(type,200,36);
        box(45,207,310,5,'#e2d7c6',2);
        if (['Peel','Slice','Chop','Dice','Mince','Grate'].includes(type)) {
          box(65,171,270,30,'#d8ad7e');box(86,182,24,6,'#ba8c60',3);
          if(type==='Grate') {
            box(225,84,48,88,'#b0bcc0');for(let i=0;i<12;i++) dot(235+i%3*13,99+Math.floor(i/3)*18,3,'#fff7eb');
            box(209,95+wave*22,34,34,'#f4c955');for(let i=0;i<9;i++)line(255+i*5,177,260+i*5,182,'#eab84c',3);
          } else if(type==='Peel') {
            box(155,115,95,38,'#e99043',18);line(159+wave*20,99,225+wave*20,119,'#b2bdb5',9);line(192+wave*20,84,190+wave*20,106,'#425849',9);
            c.strokeStyle='#e99043';c.lineWidth=4;c.beginPath();c.arc(268,153,15,a,a+4);c.stroke();
          } else {
            box(139,145,66,26,'#ed994b',10);
            const n=type==='Slice'?5:type==='Chop'?7:type==='Dice'?12:23;
            for(let i=0;i<n;i++)box(220+(i%6)*12,148+Math.floor(i/6)*8,type==='Mince'?4:8,type==='Slice'?22:6,'#ed994b',2);
            c.save();c.translate(192,120-lift);c.rotate(-0.18);box(-29,0,75,17,'#b9c6c6',3);box(45,-2,43,21,'#425849',5);c.restore();
          }
        } else if(['Mix / Blend','Stir','Whisk / Beat','Knead','Season','Mash'].includes(type)) {
          if(type==='Knead') {
            box(95,175,210,25,'#d8ad7e');c.fillStyle='#ebc58d';c.beginPath();c.ellipse(200,159,62+wave*10,28-wave*6,0,0,Math.PI*2);c.fill();
            box(156,102+lift,35,45,'#d8a47f',16);box(207,102+lift,35,45,'#d8a47f',16);
          } else {
            bowl();for(let i=0;i<8;i++)dot(154+i*13,155+Math.sin(i+a)*5,5,i%2?'#e69c51':'#78a475');
            if(type==='Season') {
              c.save();c.translate(215+wave*8,92);c.rotate(0.5);box(-15,-20,30,43,'#d8ad7e');box(-15,21,30,6,'#425849',2);c.restore();
              for(let i=0;i<9;i++)dot(217+i%3*9,116+(t*65+i*8)%39,2,'#425849');
            } else if(type==='Mash') {
              line(200,85+lift,200,149+lift);line(177,150+lift,223,150+lift,'#425849',8);
            } else {
              const x=200+Math.cos(a)*35,y=144+Math.sin(a)*8;
              line(x+30,80,x,y,'#85694a',7);
              if(type==='Whisk / Beat') {for(let i=-1;i<=1;i++){c.strokeStyle='#8c9e99';c.lineWidth=2;c.beginPath();c.ellipse(x+i*5,y-5,8,20,-0.4,0,7);c.stroke();}}
              else if(type==='Mix / Blend') {box(x-12,101,24,43,'#425849');line(x,140,x,161,'#82978b',4);}
              else dot(x,y,10,'#85694a');
            }
          }
        } else if(['Boil','Simmer','Steam','Fry','Sauté','Bake / Roast','Grill'].includes(type)) {
          if(type==='Bake / Roast') {
            box(97,73,206,127,'#79978a');box(113,95,174,88,'#3b5045');box(127,110,146,57,'#e8cba5');line(135,181,265,181,'#e1e9dc');
            c.fillStyle='#ce8148';c.beginPath();c.ellipse(200,145,42,17,0,0,7);c.fill();
          } else if(type==='Grill') {
            box(100,135,200,48,'#425849');for(let i=0;i<10;i++)line(110+i*20,140,110+i*20,178,'#b4c5b6',3);
            box(160,139,80,26,'#c88352');for(let i=0;i<4;i++)line(170+i*17,140,178+i*17,163,'#78583c',3);
          } else {
            const pan=['Fry','Sauté'].includes(type);
            box(112,pan?160:130,176,pan?27:67,'#79978a');line(285,pan?165:140,332,pan?150:140,'#425849',9);
            box(112,pan?155:126,176,8,'#425849',4);
            if(pan) {for(let i=0;i<7;i++)box(133+i*20+(type==='Sauté'?wave*6:0),143-(type==='Sauté'?lift*(i%2):0),14,12,i%2?'#df954e':'#7eaa73',4);}
            else if(type==='Steam'){line(120,143,278,143,'#d7e5db',3);for(let i=0;i<5;i++)dot(148+i*26,136,9,'#80aa74');}
            else {for(let i=0;i<(type==='Boil'?12:4);i++)dot(128+i*13,148+Math.sin(a*2+i)*6,3+(1+Math.sin(a+i))*2,'#dbe9db');}
          }
          for(let i=0;i<3;i++){const y=112-(t*32+i*9)%34;line(168+i*32+wave*4,y,172+i*32+wave*4,y-12,'#b9c9b5',3);}
          if(!['Bake / Roast','Grill'].includes(type))for(let i=0;i<4;i++)dot(155+i*30,202,4+wave,'#e6a25a');
        } else {
          c.fillStyle='#e0e7da';c.beginPath();c.ellipse(200,178,107,26,0,0,7);c.fill();
          c.fillStyle='#ffffff';c.beginPath();c.ellipse(200,173,86,19,0,0,7);c.fill();
          if(type==='Drain') {
            c.save();c.translate(200,112);c.rotate(0.3+wave*0.1);box(-57,-10,114,44,'#91ac9c');for(let i=0;i<8;i++)dot(-43+i*12,18,2,'#fff7eb');c.restore();
            for(let i=0;i<5;i++)line(182+i*12,151+(t*24)%12,182+i*12,156+(t*24)%12,'#8dbec8',2);
          } else {
            for(let i=0;i<7;i++)dot(164+i*12,169+Math.sin(i)*5,10,'#e8b96f');
            if(type==='Garnish'){box(185+wave*8,82,30,30,'#d8a47f',12);for(let i=0;i<7;i++)dot(175+i*9,118+(t*45+i*7)%51,3,'#609563');}
            else {line(185+wave*20,92,208+wave*20,143,'#85694a',6);c.fillStyle='#e8b96f';c.beginPath();c.ellipse(210+wave*20,141,24,10,0.4,0,7);c.fill();}
          }
        }
      }
      draw(0);
      const stream=canvas.captureStream(24), recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:220000});
      const chunks=[];recorder.ondataavailable=e=>chunks.push(e.data);
      const done=new Promise(resolve=>recorder.onstop=resolve);recorder.start();
      const start=performance.now();
      await new Promise(resolve=>{function tick(now){const elapsed=now-start;draw((elapsed%2000)/2000);if(elapsed<2000)requestAnimationFrame(tick);else resolve();}requestAnimationFrame(tick);});
      recorder.stop();await done;stream.getTracks().forEach(track=>track.stop());
      return Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()));
    }, type);
    await writeFile(actionVideoSource(type), Buffer.from(bytes));
    await page.close();console.log(`Rendered ${type}: ${bytes.length} bytes`);
  }
} finally { await browser.close(); }
