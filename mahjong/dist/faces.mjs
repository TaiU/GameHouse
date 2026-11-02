// Original tile artwork. Each face is drawn on a 40×56 grid; colours follow the usual
// three-ink convention (ink / vermilion / jade / indigo) so suits read at a glance.
const C={ink:'#1b2430',red:'#c0392b',green:'#17764a',blue:'#1d5793',ivory:'#fbf8ef'};
const f=n=>+n.toFixed(2);
const text=(s,y,size,fill)=>`<text x="20" y="${y}" font-size="${size}" fill="${fill}" dominant-baseline="central">${s}</text>`;

// 筒: a coin with an ivory ring and pierced centre.
const coin=(x,y,r,c)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/><circle cx="${x}" cy="${y}" r="${f(r*.72)}" fill="${C.ivory}"/><circle cx="${x}" cy="${y}" r="${f(r*.5)}" fill="${c}"/><circle cx="${x}" cy="${y}" r="${f(r*.17)}" fill="${C.ivory}"/>`;
const B=C.blue,G=C.green,R=C.red;
const DOTS={
  2:[[20,16,9,G],[20,40,9,B]],
  3:[[10.5,12,6.6,B],[20,28,6.6,R],[29.5,44,6.6,G]],
  4:[[12,16,7,B],[28,16,7,G],[12,40,7,G],[28,40,7,B]],
  5:[[11,13,6.2,B],[29,13,6.2,G],[20,28,6.2,R],[11,43,6.2,G],[29,43,6.2,B]],
  6:[[12,11,5.8,G],[28,11,5.8,G],[12,30,5.8,R],[28,30,5.8,R],[12,45,5.8,R],[28,45,5.8,R]],
  7:[[9,8.5,5,G],[20,14.5,5,G],[31,20.5,5,G],[13,33.5,5.6,R],[27,33.5,5.6,R],[13,46.5,5.6,R],[27,46.5,5.6,R]],
  8:[[13,9.5,5.4,B],[27,9.5,5.4,B],[13,21.8,5.4,B],[27,21.8,5.4,B],[13,34.2,5.4,B],[27,34.2,5.4,B],[13,46.5,5.4,B],[27,46.5,5.4,B]],
  9:[[9.5,11,5.3,B],[20,11,5.3,B],[30.5,11,5.3,B],[9.5,28,5.3,R],[20,28,5.3,R],[30.5,28,5.3,R],[9.5,45,5.3,G],[20,45,5.3,G],[30.5,45,5.3,G]]
};
function oneDot(){
  const petals=Array.from({length:12},(_,k)=>{const a=k*Math.PI/6;return `<circle cx="${f(20+9.4*Math.cos(a))}" cy="${f(28+9.4*Math.sin(a))}" r="1.5" fill="${R}"/>`;}).join('');
  return `<circle cx="20" cy="28" r="14.5" fill="${G}"/><circle cx="20" cy="28" r="12.6" fill="${C.ivory}"/>${petals}<circle cx="20" cy="28" r="7" fill="${B}"/><circle cx="20" cy="28" r="5" fill="${C.ivory}"/><circle cx="20" cy="28" r="3.3" fill="${R}"/><circle cx="20" cy="28" r="1.1" fill="${C.ivory}"/>`;
}

// 索: a bamboo stalk with a node at mid-height and a highlight groove.
function stick(x,y,h,c,a=0,w=5){
  const hx=f(-w*.18);
  return `<g transform="translate(${x} ${y})${a?` rotate(${a})`:''}"><rect x="${f(-w/2)}" y="${f(-h/2)}" width="${w}" height="${h}" rx="${f(w/2)}" fill="${c}"/><rect x="${f(-w/2-.8)}" y="-1.2" width="${f(w+1.6)}" height="2.4" rx="1.2" fill="${c}"/><path d="M${hx} ${f(-h/2+2.4)}V-2.6M${hx} 2.6V${f(h/2-2.4)}" stroke="${C.ivory}" stroke-width=".8" stroke-linecap="round" opacity=".45"/></g>`;
}
const STICKS={
  2:[[20,16,18,G],[20,40,18,G]],
  3:[[20,15,17,G],[12,40,17,G],[28,40,17,G]],
  4:[[12,16,18,G],[28,16,18,B],[12,40,18,B],[28,40,18,G]],
  5:[[10,14,16,G],[30,14,16,B],[20,28,16,R],[10,42,16,B],[30,42,16,G]],
  6:[[10,16,18,G],[20,16,18,G],[30,16,18,G],[10,40,18,G],[20,40,18,G],[30,40,18,G]],
  7:[[20,10,13,R],[10,27,13,G],[20,27,13,G],[30,27,13,G],[10,45,13,G],[20,45,13,G],[30,45,13,G]],
  8:[[8,16,18,G,14],[16,16,18,G,-14],[24,16,18,G,14],[32,16,18,G,-14],[8,40,18,B,-14],[16,40,18,B,14],[24,40,18,B,-14],[32,40,18,B,14]],
  9:[[10,11,14,G],[20,11,14,R],[30,11,14,G],[10,28,14,G],[20,28,14,R],[30,28,14,G],[10,45,14,G],[20,45,14,R],[30,45,14,G]]
};
// 一索: an original geometric bird.
const bird=`<path d="M30 33 L37.5 47 L33 48 L27 38Z" fill="${G}"/><path d="M27.5 36 L33 50 L28.5 50.5 L24.5 40Z" fill="${B}"/>
<path d="M10 19 C6 26 8 38 18 41.5 C26 44 32 38 31 31 C30 24.5 22 22.5 16.5 25 C16 22.5 15 20.5 13.5 19.5Z" fill="${G}"/>
<path d="M15.5 30 C20 25.5 27 26.5 29.5 31.5 C25 35 19.5 35.5 15.5 30Z" fill="${B}"/><path d="M18 31 C21.5 29 25 29.5 27 31.5" stroke="${C.ivory}" stroke-width=".9" fill="none" stroke-linecap="round"/>
<circle cx="12.5" cy="17" r="5.6" fill="${G}"/><path d="M7.4 15.6 L2.5 17.6 L7.6 19.2Z" fill="${R}"/><path d="M11 11.8 C11.5 7.5 15.5 6 18 8 C15.5 8.6 14.2 10.2 13.8 12.2Z" fill="${R}"/>
<circle cx="11.3" cy="16" r="1.6" fill="${C.ivory}"/><circle cx="11" cy="16" r=".8" fill="${C.ink}"/>
<path d="M17 41.5 L16 49 M22 42.5 L23 49 M13.5 49.5 H18.5 M21 49.5 H26" stroke="${R}" stroke-width="1.4" stroke-linecap="round"/>`;

const NUM='一二三四五六七八九',HONOR={27:['東',C.ink],28:['南',C.ink],29:['西',C.ink],30:['北',C.ink],31:['中',R],32:['發',G]};
const FLOWER='春夏秋冬梅蘭竹菊';

export function faceSvg(t){
  const n=t%9+1;let inner;
  if(t<9)inner=text(NUM[t],17,19,C.ink)+text('萬',40,22,R);
  else if(t<18)inner=n===1?oneDot():DOTS[n].map(([x,y,r,c])=>coin(x,y,r,c)).join('');
  else if(t<27)inner=n===1?bird:STICKS[n].map(([x,y,h,c,a])=>stick(x,y,h,c,a,n<=4?6:n<=6?5.4:4.8)).join('');
  else if(t===33)inner=`<rect x="6" y="8" width="28" height="40" rx="3.5" fill="none" stroke="${B}" stroke-width="2.6"/><rect x="10.5" y="12.5" width="19" height="31" rx="1.5" fill="none" stroke="${B}" stroke-width="1.1"/>`;
  else if(t<34){const [s,c]=HONOR[t];inner=text(s,29,t>=31?32:30,c);}
  else{
    const k=t-34,c=k<4?R:B;
    inner=`<circle cx="9" cy="9.5" r="5.2" fill="${c}"/><text x="9" y="9.9" font-size="7.6" fill="${C.ivory}" dominant-baseline="central" font-family="system-ui,sans-serif">${k%4+1}</text>${text(FLOWER[k],32,24,c)}<path d="M12 47 H28" stroke="${c}" stroke-width="1.2" stroke-linecap="round" opacity=".55"/>`;
  }
  return `<svg viewBox="0 0 40 56" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><g text-anchor="middle" font-family="'Noto Serif TC','Microsoft JhengHei',serif" font-weight="900">${inner}</g></svg>`;
}
