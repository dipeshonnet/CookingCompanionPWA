// Original deterministic artwork. Coordinates are in a 400 × 250 design space.
export function drawCookingAction({ type, time, size = 640 }) {
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size * 250 / 400;
  const c = canvas.getContext('2d'); c.scale(size / 400, size / 400);
  const C = { bg:'#fcf7ee', ink:'#334d43', green:'#6b9977', light:'#dbe8d6', wood:'#d8ab77', grain:'#c5935e', metal:'#c1d1cb', edge:'#8da59b', orange:'#e89348', cream:'#f4d39a', skin:'#dfa880' };
  const TAU = 2 * Math.PI, a = time * TAU, s = Math.sin(a), pulse = (1 - Math.cos(a)) / 2;
  function path(points, fill, stroke, width=2) {c.beginPath();points.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.lineJoin='round';c.stroke();}}
  function line(x,y,X,Y,color=C.ink,w=3){c.beginPath();c.moveTo(x,y);c.lineTo(X,Y);c.strokeStyle=color;c.lineWidth=w;c.lineCap='round';c.stroke();}
  function box(x,y,w,h,fill,r=5,stroke){c.beginPath();c.roundRect(x,y,w,h,r);c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=2;c.stroke();}}
  function oval(x,y,rx,ry,fill,stroke){c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=2;c.stroke();}}
  function arc(x,y,r,start,end,color,w=2){c.beginPath();c.arc(x,y,r,start,end);c.strokeStyle=color;c.lineWidth=w;c.lineCap='round';c.stroke();}
  function herb(x,y,scale=1){c.save();c.translate(x,y);c.scale(scale,scale);line(0,8,0,-7,C.green,2);oval(-5,-3,6,3,C.green);oval(5,-8,6,3,C.green);c.restore();}
  function hand(x,y,angle=0){c.save();c.translate(x,y);c.rotate(angle);box(-14,-35,28,47,C.skin,10);box(-18,-37,36,13,C.green,3);for(let i=0;i<3;i++)line(-8+i*7,3,-8+i*7,10,'#bc815f',1);c.restore();}
  function board(){box(59,174,282,37,'#bb8c5e',13);box(59,168,282,35,C.wood,13);box(74,180,23,8,'#ad7f53',4);for(let i=0;i<3;i++)line(111,177+i*9,322,177+i*9,C.grain,1);}
  function carrot(x,y){box(x,y,73,25,C.orange,11);line(x+8,y+5,x+13,y+5,'#f6bf75',2);line(x+28,y+7,x+33,y+7,'#bf7038',1);line(x+47,y+16,x+53,y+16,'#bf7038',1);for(let i=-1;i<=1;i++)line(x-1,y+12,x-15,y+12+i*10,C.green,3);}
  function knife(x,y,angle=0){c.save();c.translate(x,y);c.rotate(angle);path([[-48,-22],[32,-22],[32,3],[-32,3],[-48,-3]],C.metal,C.edge);line(-33,-17,23,-17,'#edf3e9',2);box(32,-24,52,25,C.ink,7);oval(46,-12,2,2,C.metal);oval(65,-12,2,2,C.metal);c.restore();}
  function bowlBack(){oval(200,199,74,8,'#e5dfd1');path([[114,142],[123,181],[147,201],[253,201],[277,181],[286,142]],C.green,C.ink);line(135,164,143,180,'#a5c2a0',2);oval(200,143,86,22,C.light,C.ink);oval(200,145,73,14,C.cream);}
  function bowlFront(){c.beginPath();c.ellipse(200,143,86,22,0,0,Math.PI);c.strokeStyle=C.ink;c.lineWidth=3;c.stroke();line(137,176,149,188,'#a5c2a0',3);}
  function plate(){oval(200,191,111,24,'#e3dece');oval(200,181,113,28,'#fffefa',C.edge);oval(200,180,86,18,C.light);}
  function steam(x,y,phase){const u=(time+phase)%1;c.strokeStyle='#b5c7b7';c.lineWidth=3;c.beginPath();c.moveTo(x,y-u*12);c.bezierCurveTo(x-12,y-13-u*12,x+12,y-22-u*12,x,y-34-u*12);c.stroke();}
  function stove(){box(95,202,215,13,C.ink,6);line(125,208,282,208,C.edge,2);for(let i=0;i<4;i++)oval(159+i*29,196,4,6,C.orange);}
  function pot(){stove();box(117,129,166,63,C.green,12,C.ink);line(135,144,135,173,'#a7c6a4',3);box(94,138,23,12,C.ink,5);box(283,138,23,12,C.ink,5);oval(200,129,83,16,C.ink);oval(200,128,75,10,'#c1d8c0');}
  c.fillStyle=C.bg;c.fillRect(0,0,400,250);
  oval(200,219,138,7,'#ebe5d7');
  if(['Peel','Slice','Chop','Dice','Mince','Grate'].includes(type)){
    board();
    if(type==='Peel'){
      carrot(150,143);hand(131,135,-.15);
      const x=192+s*24;line(x,112,x,140,C.ink,10);path([[x-22,132],[x+22,132],[x+18,148],[x-18,148]],C.metal,C.edge);line(x-15,141,x+15,141,C.ink,2);
      c.beginPath();c.moveTo(230,151);c.bezierCurveTo(257,159,224,171,250,175);c.strokeStyle=C.orange;c.lineWidth=4;c.stroke();
    }else if(type==='Grate'){
      path([[211,82],[256,82],[278,177],[201,177]],C.metal,C.ink);path([[256,82],[270,90],[289,171],[278,177]],C.edge,C.ink);arc(234,80,13,Math.PI,TAU,C.ink,4);
      for(let y=102;y<165;y+=17)for(let x=218;x<256;x+=14){line(x,y,x+5,y,C.ink,2);line(x,y+3,x+5,y+3,'#ecf2e9',1);}
      c.save();c.translate(215,121+s*17);c.rotate(-.25);box(-35,-12,35,30,'#f2c65e',3);oval(-23,-2,3,3,'#d7a747');oval(-11,10,3,3,'#d7a747');c.restore();hand(173,106+s*17,-.35);
      for(let i=0;i<10;i++)line(240+i%5*8,179+Math.floor(i/5)*6,245+i%5*8,182+Math.floor(i/5)*6,'#d9aa48',2);
    }else{
      const fine=type==='Mince',dice=type==='Dice';
      if(fine){for(let i=0;i<26;i++)box(149+i%9*9,159+Math.floor(i/9)*7,4,4,C.green,1);}
      else {carrot(116,149);hand(126,138,-.2);}
      for(let i=0;i<(fine?19:dice?15:6);i++){
        const x=213+i%7*12,y=158+Math.floor(i/7)*9;
        if(type==='Slice'){oval(x,y,4,12,C.orange,'#cf783d');line(x,y-7,x,y+7,'#f5bf75',1);}
        else box(x,y,fine?3:dice?8:10,fine?3:7,fine?C.green:C.orange,2);
      }
      // The blade reaches the board at the low point of each stroke.
      knife(fine?194:190,168-pulse*(fine?21:44),fine?s*.10:-.04);
    }
  }else if(['Mix / Blend','Stir','Whisk / Beat','Knead','Season','Mash'].includes(type)){
    if(type==='Knead'){
      board();oval(201,170,64+pulse*10,24-pulse*7,C.cream,'#d1a76a');arc(200,163,28,.3,2.7,'#e3ba7f',2);hand(173,130+pulse*23,-.15);hand(227,130+pulse*23,.15);
      for(let i=0;i<8;i++)oval(118+i*22,195+(i%2)*3,1.5,1.5,'#fff4d8');
    }else{
      bowlBack();
      for(let i=0;i<8;i++){const q=i*TAU/8+a;oval(200+Math.cos(q)*48,144+Math.sin(q)*8,4,3,i%2?C.green:C.orange);}
      if(type==='Season'){
        c.save();c.translate(220+s*6,95);c.rotate(.45);box(-16,-21,32,40,C.wood,5,C.ink);box(-17,18,34,9,C.metal,3);for(let i=0;i<3;i++)oval(-9+i*9,24,1,1,C.ink);c.restore();
        for(let i=0;i<9;i++)oval(211+i%3*8,117+((time+i/9)%1)*31,1.5,1.5,C.ink);
      }else if(type==='Mash'){
        const y=pulse*26;box(191,67+y,18,47,C.wood,6,C.ink);line(200,112+y,200,146+y,C.edge,5);path([[174,138+y],[174,147+y],[226,147+y],[226,138+y]],null,C.ink,3);for(let i=0;i<4;i++)line(182+i*12,143+y,182+i*12,149+y,C.ink,2);
      }else if(type==='Mix / Blend'){
        const x=200+s*8;box(x-18,61,36,63,C.ink,12);box(x-12,72,24,30,C.green,6);oval(x,89,3,3,C.cream);line(x,122,x,150,C.edge,8);path([[x-16,151],[x-11,139],[x+11,139],[x+16,151]],C.metal,C.ink);arc(x,148,27,a,a+2,C.orange,2);
      }else{
        const x=200+Math.cos(a)*29,y=143+Math.sin(a)*9;
        c.save();c.translate(x,y);c.rotate(-.25);
        line(0,-71,0,-18,type==='Stir'?C.wood:C.ink,9);
        if(type==='Stir'){oval(0,-8,9,15,C.wood,C.grain);line(-3,-13,-3,-3,'#ecc99a',1);}
        else for(let i=0;i<3;i++){c.beginPath();c.ellipse(0,-6,5+i*4,22,0,0,TAU);c.strokeStyle=C.edge;c.lineWidth=2;c.stroke();}
        c.restore();
      }
      bowlFront();
    }
  }else if(['Boil','Simmer','Steam','Fry','Sauté','Bake / Roast','Grill'].includes(type)){
    if(type==='Bake / Roast'){
      box(91,63,218,150,C.green,14,C.ink);box(102,74,196,22,C.light,5);for(let i=0;i<3;i++)oval(119+i*21,85,5,5,C.ink);box(255,79,29,11,C.ink,3);
      box(108,105,184,92,C.ink,8);box(118,115,164,66,'#dba875',5);line(131,178,270,178,C.edge,3);box(145,142,112,25,C.metal,4);for(let i=0;i<5;i++)oval(159+i*21,149,9,7,i%2?C.orange:C.cream);line(130,191,270,191,C.metal,5);
      steam(183,141,0);steam(223,141,.5);
    }else if(type==='Grill'){
      box(91,138,218,60,C.ink,16);oval(200,140,109,20,C.edge,C.ink);for(let i=0;i<10;i++)line(111+i*20,131,111+i*20,153,C.ink,3);
      for(let i=0;i<2;i++){box(139+i*68,131,53,23,i?C.orange:'#c88e5d',9);for(let j=0;j<3;j++)line(150+i*68+j*13,133,154+i*68+j*13,150,'#815d3c',2);}
      line(127,195,120,214,C.ink,5);line(273,195,280,214,C.ink,5);steam(171,119,0);steam(229,119,.5);
    }else if(['Fry','Sauté'].includes(type)){
      stove();const hop=type==='Sauté'?pulse*12:0;
      c.save();c.translate(type==='Sauté'?s*6:0,-hop);box(108,154,178,28,C.ink,11);oval(197,154,88,20,C.edge,C.ink);oval(197,153,78,14,'#d8bd77');path([[280,147],[333,128],[338,138],[281,162]],C.ink);oval(330,134,3,2,C.edge);
      for(let i=0;i<7;i++){const x=143+i*18,y=149+Math.sin(i)*5-(type==='Sauté'?pulse*(i%3)*7:0);box(x,y,13,9,i%2?C.orange:C.green,3);if(type==='Fry')arc(x+6,y+4,10,a+i,a+i+1,'#f6e4ae',1);}
      c.restore();steam(168,129,0);steam(225,129,.5);
    }else{
      pot();
      if(type==='Steam'){
        line(131,132,269,132,C.edge,2);for(let i=0;i<6;i++){oval(153+i*19,126+(i%2)*3,10,6,C.green);line(153+i*19,127,153+i*19,133,C.ink,1);}path([[128,98],[146,83],[254,83],[272,98]],C.metal,C.ink);box(185,73,30,9,C.ink,4);steam(154,88,0);steam(240,88,.5);
      }else{
        const n=type==='Boil'?11:3;for(let i=0;i<n;i++){const q=(time+i/n)%1;oval(143+i*(114/n),127+Math.sin(i)*3,2+q*3,1+q*2,'#e9f0dd',C.edge);}steam(169,115,0);steam(230,115,.5);
      }
    }
  }else{
    plate();
    if(type==='Drain'){
      c.save();c.translate(204,115);c.rotate(.16+s*.04);path([[-65,-6],[-48,35],[48,35],[65,-6]],C.metal,C.ink);oval(0,-7,65,12,C.light,C.ink);for(let i=0;i<7;i++)oval(-43+i*14,-7,8,4,C.orange);for(let i=0;i<9;i++)oval(-37+i%5*18,12+Math.floor(i/5)*13,2,2,C.edge);line(-84,-3,-65,-3,C.ink,5);line(65,-3,84,-3,C.ink,5);c.restore();
      for(let i=0;i<5;i++){const y=151+((time+i/5)%1)*21;line(179+i*14,y,179+i*14,y+5,'#7ca9b2',2);}
    }else{
      for(let i=0;i<9;i++)oval(159+i%5*19,173+Math.floor(i/5)*8,13,6,i%2?C.orange:C.cream);
      if(type==='Garnish'){
        hand(211+s*9,95,.3);for(let i=0;i<6;i++)herb(178+i*10,121+((time+i/6)%1)*51,.5);
      }else{
        const x=200+s*22,y=112+pulse*38;line(x+36,y-49,x,y,C.wood,7);oval(x,y,23,10,C.metal,C.ink);oval(x,y-3,18,6,C.cream);herb(x,y-5,.5);
      }
      herb(164,180,.6);herb(220,174,.7);
    }
  }
  return canvas.toDataURL('image/png').split(',')[1];
}
