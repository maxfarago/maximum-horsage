import "./style.css";
import * as THREE from "three";


// ---------------------------------------------------------------- constants
var GOAL_R      = 4.0;      // 8 m across = 78.2hh
var START_R     = 0.30;
var ROUND_TIME  = 180;
var WORLD       = 130;
var PICKUP      = 1.55;
var FILL        = 0.32;
var FIXED       = 1/60;
var MAX_STEPS   = 6;
var HEAD_K      = 0.85;
var HEAD_POW    = 0.65;
var CM_PER_HAND = 10.16;    // four inches, exactly
var UP          = new THREE.Vector3(0,1,0);

// ---------------------------------------------------------------- rng
function fnv1a(s){
  var h = 2166136261 >>> 0;
  for (var i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
function mulberry32(a){
  return function(){
    a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function todaySeed(){
  var d = new Date();
  return d.getUTCFullYear() + "-" +
         ("0"+(d.getUTCMonth()+1)).slice(-2) + "-" +
         ("0"+d.getUTCDate()).slice(-2);
}
var SEED = (new URLSearchParams(location.search).get("seed") || todaySeed()).slice(0,40);
var DEV  = SEED === "dev";
var rnd  = mulberry32(fnv1a(SEED));
function reseed(){ rnd = mulberry32(fnv1a(SEED)); }
var trnd = mulberry32(0xC0FFEE);

// ---------------------------------------------------------------- renderer
var renderer = new THREE.WebGLRenderer({antialias:true, powerPreference:"high-performance"});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
document.body.appendChild(renderer.domElement);

var scene = new THREE.Scene();
scene.background = new THREE.Color(0x7fd4f5);
scene.fog = new THREE.Fog(0x7fd4f5, 60, 230);

var camera = new THREE.PerspectiveCamera(58, innerWidth/innerHeight, 0.1, 700);

var hemi = new THREE.HemisphereLight(0xcfefff, 0x5f8f43, 0.85);
scene.add(hemi);
var sun = new THREE.DirectionalLight(0xfff3d0, 0.95);
sun.castShadow = true;
sun.shadow.mapSize.set(1024,1024);
sun.shadow.camera.near = 1;
sun.shadow.camera.far  = 160;
sun.shadow.bias = -0.0012;
scene.add(sun);
scene.add(sun.target);

// ---------------------------------------------------------------- ground
function groundTexture(){
  var c = document.createElement("canvas"); c.width = c.height = 256;
  var g = c.getContext("2d");
  g.fillStyle = "#78c455"; g.fillRect(0,0,256,256);
  g.fillStyle = "#6cb84c"; g.fillRect(0,0,128,128); g.fillRect(128,128,128,128);
  for (var i=0;i<900;i++){
    g.fillStyle = trnd()<0.5 ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.05)";
    g.fillRect(trnd()*256, trnd()*256, 3, 3);
  }
  var t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(230,230);
  t.encoding = THREE.sRGBEncoding;
  return t;
}
var ground = new THREE.Mesh(
  new THREE.PlaneGeometry(WORLD*2.4, WORLD*2.4),
  new THREE.MeshLambertMaterial({map:groundTexture()})
);
ground.rotation.x = -Math.PI/2;
ground.receiveShadow = true;
scene.add(ground);

// ---------------------------------------------------------------- the ball
function ballTexture(){
  var c = document.createElement("canvas"); c.width = 256; c.height = 128;
  var g = c.getContext("2d");
  g.fillStyle = "#b5763f"; g.fillRect(0,0,256,128);
  for (var i=0;i<90;i++){
    g.fillStyle = trnd()<0.5 ? "rgba(0,0,0,.06)" : "rgba(255,255,255,.05)";
    g.beginPath();
    g.arc(trnd()*256, trnd()*128, 4+trnd()*10, 0, 6.283);
    g.fill();
  }
  var t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  return t;
}
var katamari = new THREE.Group();
scene.add(katamari);
var core = new THREE.Mesh(
  new THREE.SphereGeometry(1, 26, 20),
  new THREE.MeshLambertMaterial({map:ballTexture()})
);
core.castShadow = true;
katamari.add(core);

// ---------------------------------------------------------------- prop kit
var PAL = [0xff6b6b,0xffa14a,0xffd23f,0x8bd450,0x4fc4ff,0xb58cff,0xff8fc0,
           0xf4efe2,0x9a6b4f,0x5f6b7a,0x2f9e7a,0xe9573f];
function hue(){ return PAL[(rnd()*PAL.length)|0]; }

var matCache = {};
function mat(color){
  if (!matCache[color]) matCache[color] = new THREE.MeshLambertMaterial({color:color});
  return matCache[color];
}
var geoBox = new THREE.BoxGeometry(1,1,1);
var geoCyl = new THREE.CylinderGeometry(0.5,0.5,1,14);
var geoSph = new THREE.SphereGeometry(0.5,12,9);
var geoCon = new THREE.ConeGeometry(0.5,1,14);

function part(geo, color, sx, sy, sz, x, y, z){
  var m = new THREE.Mesh(geo, mat(color));
  m.scale.set(sx,sy,sz);
  m.position.set(x,y,z);
  m.castShadow = true;
  return m;
}
var box = function(c,w,h,d,x,y,z){ return part(geoBox,c,w,h,d,x,y,z); };
var cyl = function(c,r,h,x,y,z){ return part(geoCyl,c,r*2,h,r*2,x,y,z); };
var sph = function(c,r,x,y,z){ return part(geoSph,c,r*2,r*2,r*2,x,y,z); };
var con = function(c,r,h,x,y,z){ return part(geoCon,c,r*2,h,r*2,x,y,z); };
function turn(g, m, rx, ry, rz){
  m.rotation.set(rx||0, ry||0, rz||0);
  g.add(m);
  return m;
}

var HIDE = 0xb5763f, MANE = 0x4a2f1c, DARK = 0x2b2140, SOCK = 0xf7f2e4;
var BRASS = 0xd2a63c, BRONZE = 0x6f7f63, STEEL = 0x9aa3ad;

// ---------------------------------------------------------------- max himself
// The head and tail ride their own rig parented to the scene, NOT to the rolling
// group. Anything parented to the ball spends half of each revolution underground.
function buildHead(){
  var g = new THREE.Group();
  turn(g, box(HIDE, 0.30,0.66,0.30,  0, 0.26, 0.00), -0.34,0,0);
  g.add(box(HIDE, 0.32,0.34,0.46,    0, 0.62, 0.20));
  g.add(box(HIDE, 0.26,0.25,0.30,    0, 0.51, 0.47));
  g.add(box(SOCK, 0.10,0.34,0.03,    0, 0.60, 0.62));
  g.add(sph(DARK, 0.035, -0.07, 0.44, 0.61));
  g.add(sph(DARK, 0.035,  0.07, 0.44, 0.61));
  g.add(sph(DARK, 0.052, -0.165, 0.68, 0.33));
  g.add(sph(DARK, 0.052,  0.165, 0.68, 0.33));
  g.add(con(HIDE, 0.062, 0.19, -0.125, 0.86, 0.04));
  g.add(con(HIDE, 0.062, 0.19,  0.125, 0.86, 0.04));
  g.add(box(MANE, 0.13,0.32,0.30,    0, 0.66, -0.04));
  g.add(box(MANE, 0.15,0.24,0.16,    0, 0.38, -0.16));
  return g;
}
function buildTail(){
  var g = new THREE.Group();
  g.add(box(MANE, 0.16,0.16,0.18, 0, 0.10, 0.02));
  turn(g, con(MANE, 0.15, 0.62, 0, -0.10, -0.20), 2.25, 0, 0);
  return g;
}

var rig     = new THREE.Group(); scene.add(rig);
var headGrp = buildHead(); rig.add(headGrp);
var tailGrp = buildTail(); rig.add(tailGrp);

var rigYaw = 0, bobT = 0;
function angLerp(a,b,t){
  var d = ((b - a + Math.PI*3) % (Math.PI*2)) - Math.PI;
  return a + d*t;
}
function updateRig(dt){
  bobT += dt;
  var hs = HEAD_K * Math.pow(radius, HEAD_POW);
  var sp = Math.sqrt(vel.x*vel.x + vel.z*vel.z);

  rig.position.copy(katamari.position);
  if (sp > 0.35) rigYaw = angLerp(rigYaw, Math.atan2(vel.x, vel.z), 1 - Math.pow(0.0015, dt));
  rig.rotation.y = rigYaw;

  var gait = Math.min(1, sp / 5);
  var bob  = Math.sin(bobT*9) * 0.06 * gait;

  headGrp.scale.setScalar(hs);
  headGrp.position.set(0, radius*0.30 + bob*radius*0.2, radius*1.05);
  headGrp.rotation.set(bob, 0, 0);

  tailGrp.scale.setScalar(hs*0.95);
  tailGrp.position.set(0, radius*0.62, -radius*1.05);
  tailGrp.rotation.set(0, 0, Math.sin(bobT*7) * 0.16 * gait);
}

// ---------------------------------------------------------------- a horse, generally
// Eight of the recipes below are horses of one kind or another, so they share a
// builder. legK stretches the legs, which is the whole of the high-horse joke.
function quadruped(s, hide, mane, legK){
  var g = new THREE.Group();
  var leg = s*0.34*(legK || 1);
  var y   = leg + s*0.16;
  g.add(box(hide, s*0.60, s*0.30, s*0.26,  0,        y,         0));       // barrel
  g.add(box(hide, s*0.22, s*0.31, s*0.27, -s*0.26,   y+s*0.03,  0));       // rump
  turn(g, box(hide, s*0.13, s*0.36, s*0.20, s*0.29,  y+s*0.17,  0), 0,0,-0.42); // neck
  g.add(box(hide, s*0.21, s*0.13, s*0.14,  s*0.43,   y+s*0.31,  0));       // head
  g.add(box(hide, s*0.10, s*0.10, s*0.11,  s*0.51,   y+s*0.27,  0));       // muzzle
  g.add(con(hide, s*0.026, s*0.08, s*0.36, y+s*0.41, -s*0.04));
  g.add(con(hide, s*0.026, s*0.08, s*0.36, y+s*0.41,  s*0.04));            // ears
  g.add(box(mane, s*0.05, s*0.28, s*0.14,  s*0.32,   y+s*0.26, 0));        // mane
  turn(g, con(mane, s*0.05, s*0.28, -s*0.38, y-s*0.01, 0), 0,0,-2.5);      // tail
  var lp = [[s*0.20, s*0.09],[s*0.20,-s*0.09],[-s*0.20, s*0.09],[-s*0.20,-s*0.09]];
  for (var i=0;i<4;i++){
    g.add(box(hide, s*0.06, leg, s*0.06, lp[i][0], leg*0.5, lp[i][1]));
    g.add(box(DARK, s*0.07, s*0.035, s*0.075, lp[i][0], s*0.018, lp[i][1]));
  }
  return g;
}
function rider(g, s, y, coat, hat){
  g.add(box(coat, s*0.14, s*0.22, s*0.16, s*0.02, y+s*0.11, 0));
  g.add(sph(0xe8b98d, s*0.07, s*0.05, y+s*0.28, 0));
  g.add(cyl(hat, s*0.10, s*0.09, s*0.05, y+s*0.36, 0));
}

// ---------------------------------------------------------------- recipes
// hp is added to Max's horsepower on pickup. A horse is one horsepower. That is
// not a joke about the game, it is what the unit means.
var KIT = [
  // ---- pocket-sized
  {name:"horsefly", size:[0.10,0.15], w:8, zone:[0,26], make:function(s){
    var g=new THREE.Group();
    g.add(sph(0x33383f, s*0.4, 0, s*0.5, 0));
    g.add(sph(0x6f5a3a, s*0.28, s*0.34, s*0.54, 0));
    turn(g, box(0xdfeef7, s*0.7, s*0.03, s*0.26, -s*0.1, s*0.72,  s*0.22), 0,0,0.2);
    turn(g, box(0xdfeef7, s*0.7, s*0.03, s*0.26, -s*0.1, s*0.72, -s*0.22), 0,0,0.2);
    return g;}},
  {name:"thumbtack", size:[0.14,0.2], w:6, zone:[0,26], make:function(s){
    var g=new THREE.Group();
    g.add(cyl(0xd94f4f, s*0.5, s*0.25, 0, s*0.13, 0));
    g.add(cyl(STEEL, s*0.08, s*0.5, 0, -s*0.1, 0));
    return g;}},
  {name:"sugar cube", size:[0.16,0.22], w:11, zone:[0,26], make:function(s){
    var g=new THREE.Group();
    g.add(box(0xfdf9ef, s, s, s, 0, s*0.5, 0));
    return g;}},
  {name:"coin", size:[0.18,0.26], w:7, zone:[0,26], make:function(s){
    var g=new THREE.Group();
    g.add(cyl(0xffd23f, s*0.5, s*0.12, 0, s*0.06, 0));
    return g;}},
  {name:"horse chestnut", size:[0.18,0.26], w:8, zone:[0,28], make:function(s){
    var g=new THREE.Group();
    g.add(sph(0x6b3f24, s*0.42, 0, s*0.38, 0));
    g.add(sph(0x8fbf58, s*0.46, 0, s*0.30, 0));
    for (var i=0;i<7;i++){
      var a=i*0.9;
      g.add(con(0x8fbf58, s*0.05, s*0.16, Math.cos(a)*s*0.34, s*0.16, Math.sin(a)*s*0.34));
    }
    return g;}},
  {name:"candy", size:[0.2,0.3], w:6, zone:[0,26], make:function(s,c){
    var g=new THREE.Group();
    g.add(box(c, s*0.55, s*0.5, s*0.5, 0, s*0.25, 0));
    g.add(con(c, s*0.2, s*0.3, s*0.42, s*0.25, 0));
    turn(g, con(c, s*0.2, s*0.3, -s*0.42, s*0.25, 0), 0, 0, Math.PI);
    return g;}},
  {name:"die", size:[0.24,0.32], w:5, zone:[0,28], make:function(s){
    var g=new THREE.Group();
    g.add(box(0xf7f2e4, s, s, s, 0, s*0.5, 0));
    g.add(sph(DARK, s*0.09, 0, s*0.5, s*0.51));
    return g;}},
  {name:"horseshoe", size:[0.26,0.36], w:9, zone:[0,30], make:function(s){
    var g=new THREE.Group();
    for (var i=0;i<7;i++){
      var a = -0.5 + (i/6)*4.1;
      g.add(box(STEEL, s*0.16, s*0.1, s*0.16, Math.cos(a)*s*0.38, s*0.05, Math.sin(a)*s*0.38));
    }
    return g;}},
  {name:"eraser", size:[0.28,0.4], w:5, zone:[0,28], make:function(s,c){
    var g=new THREE.Group();
    g.add(box(c, s, s*0.35, s*0.45, 0, s*0.17, 0));
    return g;}},
  {name:"seahorse", size:[0.3,0.44], w:5, zone:[0,40], make:function(s){
    var g=new THREE.Group();
    g.add(cyl(0x3fb8c4, s*0.30, s*0.06, 0, s*0.03, 0));
    for (var i=0;i<5;i++){
      var a = i*0.42;
      g.add(box(0xf2a341, s*0.13, s*0.13, s*0.10,
                Math.sin(a)*s*0.14, s*0.22+i*s*0.12, 0));
    }
    g.add(box(0xf2a341, s*0.16, s*0.11, s*0.10, s*0.10, s*0.84, 0));
    g.add(box(0xf2a341, s*0.14, s*0.06, s*0.07, s*0.22, s*0.80, 0));
    g.add(con(0xf2a341, s*0.05, s*0.12, -s*0.04, s*0.94, 0));
    return g;}},
  {name:"horseradish", size:[0.32,0.46], w:7, zone:[0,40], make:function(s){
    var g=new THREE.Group();
    g.add(sph(0xf0e6cf, s*0.24, 0, s*0.20, 0));
    g.add(sph(0xe8dcbe, s*0.18, s*0.04, s*0.38, 0));
    turn(g, con(0xe0d3b0, s*0.13, s*0.34, -s*0.03, s*0.50, 0), 0,0,Math.PI);
    for (var i=0;i<3;i++)
      turn(g, box(0x5aa04a, s*0.09, s*0.34, s*0.05, (i-1)*s*0.09, s*0.66, 0), 0,0,(i-1)*0.4);
    return g;}},
  {name:"knight", size:[0.34,0.48], w:6, zone:[0,36], make:function(s){
    var g=new THREE.Group();
    g.add(cyl(0xf4efe2, s*0.28, s*0.10, 0, s*0.05, 0));
    g.add(cyl(0xf4efe2, s*0.20, s*0.14, 0, s*0.16, 0));
    g.add(cyl(0xf4efe2, s*0.12, s*0.26, 0, s*0.35, 0));
    turn(g, box(0xf4efe2, s*0.16, s*0.30, s*0.20, s*0.03, s*0.60, 0), -0.30,0,0);
    g.add(box(0xf4efe2, s*0.14, s*0.13, s*0.15, s*0.12, s*0.72, 0));
    g.add(con(0xf4efe2, s*0.05, s*0.14, -s*0.06, s*0.80, 0));
    return g;}},
  {name:"horsehair brush", size:[0.36,0.5], w:6, zone:[0,42], make:function(s){
    var g=new THREE.Group();
    g.add(box(0x9a6b4f, s*0.9, s*0.20, s*0.36, 0, s*0.26, 0));
    g.add(box(0x3a2a1a, s*0.84, s*0.18, s*0.32, 0, s*0.09, 0));
    return g;}},
  {name:"pencil", size:[0.4,0.6], w:5, zone:[0,30], make:function(s){
    var g=new THREE.Group();
    turn(g, cyl(0xffd23f, s*0.07, s*0.9, 0, s*0.07, 0), 0, 0, Math.PI/2);
    turn(g, con(0xf1c8a0, s*0.07, s*0.16, s*0.52, s*0.07, 0), 0, 0, -Math.PI/2);
    return g;}},

  // ---- yard
  {name:"carrot", size:[0.3,0.45], w:9, zone:[0,44], make:function(s){
    var g=new THREE.Group();
    turn(g, con(0xf08a3c, s*0.15, s*0.9, 0, s*0.16, 0), 0, 0, -2.0);
    for (var i=0;i<3;i++)
      g.add(box(0x4fa34a, s*0.06, s*0.26, s*0.06, s*0.34+i*s*0.06, s*0.34, (i-1)*s*0.07));
    return g;}},
  {name:"apple", size:[0.35,0.5], w:8, zone:[0,46], make:function(s){
    var g=new THREE.Group();
    g.add(sph(0xe9573f, s*0.45, 0, s*0.45, 0));
    g.add(cyl(0x6b4a2f, s*0.05, s*0.3, 0, s*0.95, 0));
    return g;}},
  {name:"mug", size:[0.4,0.55], w:5, zone:[0,46], make:function(s,c){
    var g=new THREE.Group();
    g.add(cyl(c, s*0.4, s*0.8, 0, s*0.4, 0));
    g.add(box(c, s*0.12, s*0.35, s*0.1, s*0.44, s*0.45, 0));
    return g;}},
  {name:"soda can", size:[0.4,0.55], w:5, zone:[0,48], make:function(s,c){
    var g=new THREE.Group();
    g.add(cyl(c, s*0.32, s, 0, s*0.5, 0));
    g.add(cyl(STEEL, s*0.33, s*0.08, 0, s*1.0, 0));
    return g;}},
  {name:"book", size:[0.5,0.8], w:5, zone:[0,48], make:function(s,c){
    var g=new THREE.Group();
    g.add(box(c, s, s*0.22, s*0.75, 0, s*0.11, 0));
    g.add(box(0xf7f2e4, s*0.94, s*0.16, s*0.7, s*0.03, s*0.11, 0));
    return g;}},
  {name:"rubber duck", size:[0.4,0.6], w:4, zone:[0,50], make:function(s){
    var g=new THREE.Group();
    g.add(sph(0xffd23f, s*0.45, 0, s*0.42, 0));
    g.add(sph(0xffd23f, s*0.26, 0, s*0.85, s*0.2));
    turn(g, con(0xff8c1a, s*0.1, s*0.22, 0, s*0.85, s*0.44), Math.PI/2, 0, 0);
    return g;}},
  {name:"feed bucket", size:[0.55,0.8], w:7, zone:[0,52], make:function(s){
    var g=new THREE.Group();
    g.add(cyl(0x4a7ec4, s*0.4, s*0.7, 0, s*0.35, 0));
    g.add(cyl(0x2f5a95, s*0.43, s*0.09, 0, s*0.72, 0));
    g.add(sph(0xc9a227, s*0.3, 0, s*0.7, 0));
    return g;}},
  {name:"potted plant", size:[0.8,1.3], w:6, zone:[0,56], make:function(s){
    var g=new THREE.Group();
    g.add(cyl(0xc06a44, s*0.28, s*0.4, 0, s*0.2, 0));
    for (var i=0;i<4;i++){
      var a = i*1.57 + rnd();
      g.add(sph(0x4fa34a, s*0.22, Math.cos(a)*s*0.18, s*0.5+rnd()*s*0.3, Math.sin(a)*s*0.18));
    }
    return g;}},
  {name:"hobby horse", size:[0.9,1.4], w:6, zone:[0,58], make:function(s){
    var g=new THREE.Group();
    g.add(cyl(0x9a6b4f, s*0.04, s*0.92, 0, s*0.46, 0));
    var h = buildHead();
    h.scale.setScalar(s*0.52);
    h.position.set(0, s*0.62, 0);
    h.rotation.y = Math.PI/2;
    g.add(h);
    return g;}},

  // ---- room-sized
  {name:"traffic cone", size:[1.0,1.5], w:6, zone:[4,80], make:function(s){
    var g=new THREE.Group();
    g.add(box(0xe9573f, s*0.7, s*0.1, s*0.7, 0, s*0.05, 0));
    g.add(con(0xe9573f, s*0.3, s*0.95, 0, s*0.52, 0));
    g.add(cyl(0xf7f2e4, s*0.2, s*0.14, 0, s*0.6, 0));
    return g;}},
  {name:"sawhorse", size:[1.2,1.8], w:7, zone:[4,80], make:function(s){
    var g=new THREE.Group();
    g.add(box(0xc79a5e, s*0.9, s*0.09, s*0.12, 0, s*0.6, 0));
    var p=[[-1,-1],[1,-1],[-1,1],[1,1]];
    for (var i=0;i<4;i++)
      turn(g, box(0xc79a5e, s*0.07, s*0.66, s*0.07, p[i][0]*s*0.32, s*0.30, p[i][1]*s*0.14),
           p[i][1]*0.25, 0, -p[i][0]*0.18);
    return g;}},
  {name:"lawnmower", size:[1.3,1.9], w:6, hp:5, zone:[4,80], make:function(s,c){
    var g=new THREE.Group();
    g.add(box(c, s*0.7, s*0.22, s*0.52, 0, s*0.24, 0));
    g.add(box(0x33383f, s*0.26, s*0.20, s*0.30, s*0.06, s*0.44, 0));
    turn(g, box(STEEL, s*0.05, s*0.62, s*0.05, -s*0.38, s*0.50, 0), 0,0,0.55);
    g.add(box(STEEL, s*0.05, s*0.05, s*0.34, -s*0.66, s*0.76, 0));
    var p=[[-1,-1],[1,-1],[-1,1],[1,1]];
    for (var i=0;i<4;i++)
      turn(g, cyl(DARK, s*0.11, s*0.06, p[i][0]*s*0.28, s*0.11, p[i][1]*s*0.24), Math.PI/2,0,0);
    return g;}},
  {name:"chair", size:[1.3,2.0], w:6, zone:[4,80], make:function(s,c){
    var g=new THREE.Group(), t=s*0.07;
    g.add(box(c, s*0.6, t*1.4, s*0.6, 0, s*0.5, 0));
    g.add(box(c, s*0.6, s*0.55, t*1.4, 0, s*0.78, -s*0.27));
    var p=[[-1,-1],[1,-1],[-1,1],[1,1]];
    for (var i=0;i<4;i++) g.add(box(c, t, s*0.5, t, p[i][0]*s*0.25, s*0.25, p[i][1]*s*0.25));
    return g;}},
  {name:"rocking horse", size:[1.3,1.9], w:6, zone:[4,80], make:function(s){
    var g=new THREE.Group();
    var q = quadruped(s*0.95, 0xf0e2c8, 0xc0503f, 0.55);
    q.position.y = s*0.16;
    g.add(q);
    for (var k=-1;k<=1;k+=2){
      for (var i=0;i<4;i++){
        var t=(i/3-0.5)*1.7;
        g.add(box(0xc79a5e, s*0.28, s*0.07, s*0.07, t*s*0.5, s*0.03+t*t*s*0.12, k*s*0.14));
      }
    }
    return g;}},
  {name:"trash can", size:[1.2,1.8], w:5, zone:[4,82], make:function(s){
    var g=new THREE.Group();
    g.add(cyl(0x5f6b7a, s*0.34, s*0.9, 0, s*0.45, 0));
    g.add(cyl(0x3f4a57, s*0.38, s*0.1, 0, s*0.92, 0));
    return g;}},
  {name:"hay bale", size:[1.4,2.1], w:8, zone:[6,84], make:function(s){
    var g=new THREE.Group();
    turn(g, cyl(0xd9b45a, s*0.42, s*0.9, 0, s*0.42, 0), 0, 0, Math.PI/2);
    turn(g, cyl(0xc39c3f, s*0.43, s*0.06, -s*0.44, s*0.42, 0), 0, 0, Math.PI/2);
    turn(g, cyl(0xc39c3f, s*0.43, s*0.06,  s*0.44, s*0.42, 0), 0, 0, Math.PI/2);
    return g;}},
  {name:"clotheshorse", size:[1.5,2.1], w:6, zone:[6,82], make:function(s,c){
    var g=new THREE.Group();
    for (var k=-1;k<=1;k+=2)
      for (var j=-1;j<=1;j+=2)
        turn(g, box(0xd8c9a6, s*0.06, s*0.82, s*0.06, j*s*0.34, s*0.40, k*s*0.16),
             k*0.18, 0, 0);
    for (var i=0;i<3;i++)
      for (k=-1;k<=1;k+=2)
        g.add(box(0xd8c9a6, s*0.74, s*0.04, s*0.04, 0, s*0.30+i*s*0.22, k*s*0.20));
    g.add(box(c, s*0.34, s*0.44, s*0.04, -s*0.16, s*0.56, s*0.21));
    g.add(box(0xf7f2e4, s*0.30, s*0.38, s*0.04, s*0.20, s*0.60, -s*0.21));
    return g;}},
  {name:"horse trough", size:[1.7,2.4], w:6, zone:[6,84], make:function(s){
    var g=new THREE.Group();
    g.add(box(0x7d6a52, s, s*0.10, s*0.44, 0, s*0.05, 0));
    for (var k=-1;k<=1;k+=2){
      g.add(box(0x8a7458, s, s*0.34, s*0.05, 0, s*0.24, k*s*0.20));
      g.add(box(0x8a7458, s*0.05, s*0.34, s*0.42, k*s*0.48, s*0.24, 0));
    }
    g.add(box(0x4aa8c9, s*0.92, s*0.02, s*0.36, 0, s*0.32, 0));
    return g;}},
  {name:"mailbox", size:[1.5,2.2], w:4, zone:[8,86], make:function(s){
    var g=new THREE.Group();
    g.add(cyl(0x6b4a2f, s*0.06, s*0.7, 0, s*0.35, 0));
    g.add(box(0x2f6fa8, s*0.34, s*0.3, s*0.55, 0, s*0.85, 0));
    turn(g, cyl(0x2f6fa8, s*0.17, s*0.32, 0, s*1.0, 0), 0, 0, Math.PI/2);
    return g;}},
  {name:"bicycle", size:[1.8,2.4], w:4, zone:[8,86], make:function(s,c){
    var g=new THREE.Group();
    turn(g, cyl(DARK, s*0.28, s*0.06, -s*0.3, s*0.28, 0), 0, 0, Math.PI/2);
    turn(g, cyl(DARK, s*0.28, s*0.06,  s*0.3, s*0.28, 0), 0, 0, Math.PI/2);
    g.add(box(c, s*0.6, s*0.06, s*0.06, 0, s*0.42, 0));
    g.add(box(c, s*0.06, s*0.3, s*0.06, -s*0.28, s*0.5, 0));
    return g;}},
  {name:"moped", size:[1.8,2.5], w:5, hp:8, zone:[8,86], make:function(s,c){
    var g=new THREE.Group();
    turn(g, cyl(DARK, s*0.20, s*0.07, -s*0.32, s*0.20, 0), 0, 0, Math.PI/2);
    turn(g, cyl(DARK, s*0.20, s*0.07,  s*0.32, s*0.20, 0), 0, 0, Math.PI/2);
    g.add(box(c, s*0.62, s*0.20, s*0.20, 0, s*0.34, 0));
    g.add(box(0x33383f, s*0.24, s*0.13, s*0.22, -s*0.12, s*0.50, 0));
    turn(g, box(c, s*0.10, s*0.42, s*0.16, s*0.30, s*0.48, 0), 0,0,-0.25);
    g.add(box(DARK, s*0.05, s*0.05, s*0.40, s*0.36, s*0.66, 0));
    return g;}},
  {name:"park bench", size:[2.2,3.2], w:5, zone:[10,90], make:function(s){
    var g=new THREE.Group();
    g.add(box(0x9a6b4f, s, s*0.08, s*0.32, 0, s*0.24, 0));
    g.add(box(0x9a6b4f, s, s*0.32, s*0.07, 0, s*0.42, -s*0.14));
    g.add(box(0x5f6b7a, s*0.07, s*0.24, s*0.3, -s*0.42, s*0.12, 0));
    g.add(box(0x5f6b7a, s*0.07, s*0.24, s*0.3,  s*0.42, s*0.12, 0));
    return g;}},
  {name:"carousel horse", size:[2.2,3.0], w:5, zone:[10,90], make:function(s){
    var g=new THREE.Group();
    var q = quadruped(s*0.9, 0xf7f2e4, 0xff8fc0, 1.0);
    q.position.y = s*0.20;
    g.add(q);
    g.add(cyl(BRASS, s*0.035, s*1.5, 0, s*0.75, 0));
    g.add(box(0xffd23f, s*0.30, s*0.08, s*0.30, -s*0.04, s*0.66, 0));
    return g;}},
  {name:"jump fence", size:[2.6,3.6], w:5, zone:[10,92], make:function(s){
    var g=new THREE.Group();
    g.add(box(0xf2ead4, s*0.08, s*0.9, s*0.08, -s*0.45, s*0.45, 0));
    g.add(box(0xf2ead4, s*0.08, s*0.9, s*0.08,  s*0.45, s*0.45, 0));
    for (var i=0;i<3;i++)
      g.add(box(0xe4d7ae, s*0.9, s*0.09, s*0.06, 0, s*0.3+i*s*0.22, 0));
    return g;}},
  {name:"dark horse", size:[2.6,3.6], w:3, hp:1, zone:[6,130], make:function(s){
    return quadruped(s, 0x241d2e, 0x120e18, 1.05);}},

  // ---- street-sized
  {name:"car", size:[3.5,5.0], w:7, hp:120, zone:[16,130], make:function(s,c){
    var g=new THREE.Group();
    g.add(box(c, s, s*0.22, s*0.42, 0, s*0.22, 0));
    g.add(box(c, s*0.5, s*0.2, s*0.38, -s*0.04, s*0.42, 0));
    var p=[[-1,-1],[1,-1],[-1,1],[1,1]];
    for (var i=0;i<4;i++)
      turn(g, cyl(DARK, s*0.1, s*0.07, p[i][0]*s*0.33, s*0.1, p[i][1]*s*0.21), Math.PI/2, 0, 0);
    return g;}},
  {name:"police horse", size:[3.5,5.0], w:5, hp:1, zone:[16,130], make:function(s){
    var g = quadruped(s, 0x4a3524, 0x2a1c12, 1.1);
    rider(g, s, s*0.62, 0x2f3f6b, 0x1b2440);
    return g;}},
  {name:"lamppost", size:[4.5,6.5], w:4, zone:[16,130], make:function(s){
    var g=new THREE.Group();
    g.add(cyl(0x3f4a57, s*0.05, s*0.9, 0, s*0.45, 0));
    g.add(box(0x3f4a57, s*0.2, s*0.05, s*0.05, s*0.1, s*0.9, 0));
    g.add(sph(0xffe9a8, s*0.09, s*0.19, s*0.86, 0));
    return g;}},
  {name:"tractor", size:[4.5,6.5], w:4, hp:95, zone:[20,130], make:function(s,c){
    var g=new THREE.Group();
    g.add(box(c, s*0.68, s*0.26, s*0.40, s*0.02, s*0.34, 0));
    g.add(box(c, s*0.28, s*0.26, s*0.34, s*0.30, s*0.52, 0));
    g.add(box(0x2b2140, s*0.26, s*0.22, s*0.36, -s*0.16, s*0.58, 0));
    g.add(cyl(0x33383f, s*0.05, s*0.24, s*0.30, s*0.74, 0));
    for (var k=-1;k<=1;k+=2){
      turn(g, cyl(DARK, s*0.28, s*0.12, -s*0.22, s*0.28, k*s*0.24), Math.PI/2,0,0);
      turn(g, cyl(DARK, s*0.15, s*0.10,  s*0.34, s*0.15, k*s*0.22), Math.PI/2,0,0);
    }
    return g;}},
  {name:"tree", size:[5,9], w:8, zone:[14,130], make:function(s){
    var g=new THREE.Group();
    g.add(cyl(0x7a5636, s*0.07, s*0.5, 0, s*0.25, 0));
    g.add(sph(0x3f8f3f, s*0.3, 0, s*0.62, 0));
    g.add(sph(0x4fa34a, s*0.22, s*0.18, s*0.78, s*0.1));
    g.add(sph(0x35803a, s*0.2, -s*0.16, s*0.72, -s*0.12));
    return g;}},
  {name:"horse float", size:[5.5,8], w:4, zone:[20,130], make:function(s,c){
    var g=new THREE.Group();
    g.add(box(c, s*0.8, s*0.5, s*0.42, 0, s*0.42, 0));
    g.add(box(0x9a6b4f, s*0.06, s*0.42, s*0.36, -s*0.42, s*0.3, 0));
    g.add(box(0x3f4a57, s*0.3, s*0.06, s*0.08, s*0.55, s*0.24, 0));
    for (var k=-1;k<=1;k+=2)
      turn(g, cyl(DARK, s*0.1, s*0.08, -s*0.1, s*0.1, k*s*0.21), Math.PI/2, 0, 0);
    return g;}},
  {name:"equestrian statue", size:[6,9], w:4, zone:[26,130], make:function(s){
    var g=new THREE.Group();
    g.add(box(0x8d8577, s*0.72, s*0.22, s*0.44, 0, s*0.11, 0));
    g.add(box(0xa39a89, s*0.62, s*0.10, s*0.36, 0, s*0.27, 0));
    var q = quadruped(s*0.78, BRONZE, BRONZE, 1.0);
    q.position.y = s*0.32;
    g.add(q);
    rider(g, s*0.78, s*0.32 + s*0.50, BRONZE, BRONZE);
    return g;}},
  {name:"food truck", size:[6,9], w:4, hp:210, zone:[24,130], make:function(s,c){
    var g=new THREE.Group();
    g.add(box(c, s, s*0.45, s*0.42, 0, s*0.35, 0));
    g.add(box(0xf7f2e4, s*0.28, s*0.3, s*0.4, -s*0.42, s*0.28, 0));
    g.add(box(DARK, s*0.5, s*0.16, s*0.44, s*0.1, s*0.42, 0));
    for (var k=-1;k<=1;k+=2)
      turn(g, cyl(DARK, s*0.11, s*0.09, s*0.3*k, s*0.11, s*0.21), Math.PI/2, 0, 0);
    return g;}},
  {name:"high horse", size:[7,11], w:3, hp:1, zone:[30,130], make:function(s){
    return quadruped(s*0.72, 0xdcc9a8, 0x8a6f45, 3.4);}},
  {name:"stable", size:[8,13], w:5, zone:[28,130], make:function(s){
    var g=new THREE.Group();
    g.add(box(0xc0503f, s*0.85, s*0.5, s*0.6, 0, s*0.25, 0));
    turn(g, con(0xf2ead4, s*0.6, s*0.34, 0, s*0.66, 0), 0, Math.PI/4, 0);
    g.add(box(0x6b4a2f, s*0.2, s*0.3, s*0.03, -s*0.2, s*0.15, s*0.31));
    g.add(box(0x6b4a2f, s*0.2, s*0.3, s*0.03,  s*0.2, s*0.15, s*0.31));
    return g;}},
  {name:"house", size:[9,15], w:6, zone:[30,130], make:function(s,c){
    var g=new THREE.Group();
    g.add(box(c, s*0.8, s*0.55, s*0.7, 0, s*0.27, 0));
    turn(g, con(0xc0503f, s*0.62, s*0.4, 0, s*0.74, 0), 0, Math.PI/4, 0);
    g.add(box(0x6b4a2f, s*0.14, s*0.26, s*0.03, 0, s*0.13, s*0.36));
    g.add(box(0x9fdcf5, s*0.14, s*0.14, s*0.03, -s*0.26, s*0.34, s*0.36));
    return g;}},
  {name:"carousel", size:[9,14], w:3, hp:15, zone:[40,130], make:function(s){
    var g=new THREE.Group();
    g.add(cyl(0xf2ead4, s*0.50, s*0.10, 0, s*0.05, 0));
    g.add(cyl(BRASS, s*0.04, s*0.9, 0, s*0.45, 0));
    for (var i=0;i<4;i++){
      var a = i*1.571;
      g.add(cyl(BRASS, s*0.018, s*0.68, Math.cos(a)*s*0.40, s*0.44, Math.sin(a)*s*0.40));
    }
    for (i=0;i<2;i++){
      var b = i*3.14;
      var q = quadruped(s*0.24, 0xf7f2e4, 0xff8fc0, 1.0);
      q.position.set(Math.cos(b)*s*0.34, s*0.16, Math.sin(b)*s*0.34);
      q.rotation.y = -b;
      g.add(q);
    }
    turn(g, con(0xe9573f, s*0.56, s*0.30, 0, s*0.93, 0), 0, 0, 0);
    return g;}},
  {name:"office block", size:[12,20], w:3, zone:[46,130], make:function(s,c){
    var g=new THREE.Group();
    g.add(box(c, s*0.55, s, s*0.55, 0, s*0.5, 0));
    for (var i=0;i<5;i++)
      g.add(box(0x9fdcf5, s*0.5, s*0.07, s*0.56, 0, s*0.16+i*s*0.17, 0));
    return g;}}
];

var WSUM = 0, i0;
for (i0=0;i0<KIT.length;i0++) WSUM += KIT[i0].w;
function pickRecipe(){
  var r = rnd()*WSUM;
  for (var i=0;i<KIT.length;i++){ r -= KIT[i].w; if (r<=0) return KIT[i]; }
  return KIT[0];
}

// ---------------------------------------------------------------- hands
// A hand is four inches. 14.2hh means fourteen hands and two inches, which is
// 14.5 hands decimal. The notation is wrong and everybody uses it anyway.
function handsOf(r){ return r*200/CM_PER_HAND; }
function handsText(h){
  var whole = Math.floor(h);
  var inch  = Math.floor((h - whole) * 4);
  return inch ? whole + "." + inch : "" + whole;
}
function metricText(r){
  var cm = r*200;
  return cm < 100 ? Math.round(cm) + "cm" : (cm/100).toFixed(2) + "m";
}

// thresholds in decimal hands; 14.5 decimal is the famous 14.2hh
var TIERS = [
  [ 8.5,   "miniature",     ""],
  [10.0,   "shetland",      ""],
  [12.5,   "large pony",    ""],
  [14.5,   "a horse",       "14.2hh. Up to here you were a pony. Officially."],
  [16.0,   "hunter",        ""],
  [17.5,   "shire",         ""],
  [21.5,   "record",        "21.2hh. Sampson stood this tall in 1850. No horse has beaten it."],
  [30.0,   "hazard",        ""],
  [45.0,   "landmark",      ""],
  [60.0,   "weather",       ""],
  [120.0,  "unlicensed",    ""],
  [200.0,  "geological",    ""],
  [400.0,  "constellation", "You are visible from other fields entirely."]
];
function tierIndex(h){
  var i = -1;
  while (i+1 < TIERS.length && h >= TIERS[i+1][0]) i++;
  return i;
}
function tierName(i){ return i < 0 ? "foal" : TIERS[i][1]; }

// ---------------------------------------------------------------- world
var props = [];
var attached = [];
var tmpV = new THREE.Vector3();
var tmpQ = new THREE.Quaternion();

function spawnWorld(count){
  for (var i=0;i<count;i++){
    var rec = pickRecipe();
    var s = rec.size[0] + rnd()*(rec.size[1]-rec.size[0]);
    var g = rec.make(s, hue());
    var lo = rec.zone[0], hi = rec.zone[1];
    var d = lo + Math.sqrt(rnd())*(hi-lo);
    var a = rnd()*Math.PI*2;
    g.position.set(Math.cos(a)*d, 0, Math.sin(a)*d);
    g.rotation.y = rnd()*Math.PI*2;
    if (s < 0.7) g.traverse(function(o){ o.castShadow = false; });
    g.userData = {size:s, name:rec.name, r:s*0.42, hp:rec.hp || 0};
    scene.add(g);
    props.push(g);
  }
}

// ---------------------------------------------------------------- state
var radius, volume, collected, timeLeft, running, vel, camYaw, shake, cleared;
var hp, tier, dirty;

function setRadius(r){
  radius = r;
  volume = (4/3)*Math.PI*r*r*r;
  core.scale.setScalar(r);
}
function powerMul(){ return 1 + Math.log10(Math.max(1,hp)) * 0.30; }
function applyFov(){
  camera.fov = 58 + Math.min(9, Math.log10(Math.max(1,hp)) * 3.2);
  camera.updateProjectionMatrix();
}

function reset(){
  var i;
  for (i=0;i<props.length;i++) scene.remove(props[i]);
  for (i=0;i<attached.length;i++) katamari.remove(attached[i]);
  props.length = 0; attached.length = 0;

  reseed();

  setRadius(START_R);
  collected= 0;
  timeLeft = ROUND_TIME;
  cleared  = false;
  dirty    = false;
  hp       = 1;
  tier     = tierIndex(handsOf(START_R));
  vel      = new THREE.Vector3();
  camYaw   = 0;
  shake    = 0;
  rigYaw   = 0;
  bobT     = 0;
  nayAt    = 0;
  nayProp  = null;

  katamari.position.set(0, radius, 0);
  katamari.quaternion.identity();

  spawnWorld(1100);
  pickedEl.innerHTML = "";
  bannerEl.classList.remove("show");
  var h = document.getElementById("hint");
  h.style.opacity = 1;
  setTimeout(function(){ h.style.opacity = 0; }, 7000);
  applyFov();
  syncHUD();
  updateRig(0);
  placeCamera(0, true);
}

// ---------------------------------------------------------------- collecting
function collect(p){
  var s = p.userData.size;

  katamari.getWorldQuaternion(tmpQ).invert();
  tmpV.copy(p.position).sub(katamari.position).applyQuaternion(tmpQ);
  if (tmpV.lengthSq() < 1e-6) tmpV.set(0, 1, 0);
  tmpV.normalize().multiplyScalar(radius*0.96 + s*0.34);
  p.position.copy(tmpV);
  p.quaternion.premultiply(tmpQ);

  scene.remove(p);
  katamari.add(p);
  attached.push(p);

  volume += s*s*s*FILL;
  radius = Math.cbrt(volume*3/(4*Math.PI));
  core.scale.setScalar(radius);
  collected++;

  if (p.userData.hp){ hp += p.userData.hp; applyFov(); }

  for (var i=attached.length-1;i>=0;i--){
    var a = attached[i];
    if (a.position.length() + a.userData.size*0.55 < radius*0.94){
      katamari.remove(a);
      attached.splice(i,1);
    }
  }
  announce(p.userData.name, p.userData.hp);
  checkTier();
  syncHUD();
}

var pickedEl = document.getElementById("picked");
function announce(name, gain){
  if (pickedEl.childElementCount > 4) pickedEl.removeChild(pickedEl.firstChild);
  var d = document.createElement("div");
  d.className = "pick";
  d.textContent = name;
  if (gain){
    var b = document.createElement("b");
    b.textContent = "+" + gain + " hp";
    d.appendChild(b);
  }
  pickedEl.appendChild(d);
  setTimeout(function(){ if (d.parentNode) d.parentNode.removeChild(d); }, 1700);
}

// ---------------------------------------------------------------- banners
var bannerEl = document.getElementById("banner");
var bannerT = null;
function banner(text, ms){
  bannerEl.textContent = text;
  bannerEl.classList.add("show");
  clearTimeout(bannerT);
  bannerT = setTimeout(function(){ bannerEl.classList.remove("show"); }, ms || 2600);
}
function checkTier(){
  var h = handsOf(radius);
  var t = tierIndex(h);
  if (t <= tier) { tier = t; return; }
  tier = t;
  if (cleared) return;                  // goal banner owns the screen up there
  var row = TIERS[t];
  banner(row[2] || (handsText(row[0]) + "hh — " + row[1]), row[2] ? 3600 : 2200);
}

// ---------------------------------------------------------------- nay
var nayEl = document.getElementById("nay");
var nayAt = 0, nayProp = null;
function nay(p){
  var t = performance.now();
  if (p === nayProp && t - nayAt < 1500) return;
  if (t - nayAt < 600) return;
  nayProp = p; nayAt = t;
  nayEl.classList.remove("go");
  void nayEl.offsetWidth;
  nayEl.classList.add("go");
}

// ---------------------------------------------------------------- HUD
var sizeval = document.getElementById("sizeval");
var metricEl= document.getElementById("metric");
var barfill = document.getElementById("barfill");
var barEl   = document.getElementById("bar");
var tierEl  = document.getElementById("tier");
var hpEl    = document.getElementById("hp");
var timeEl  = document.getElementById("time");
var clockEl = document.getElementById("clock");

function progOf(r){
  return (Math.log(r/START_R) / Math.log(GOAL_R/START_R)) * 100;
}
(function buildTicks(){
  for (var i=0;i<TIERS.length;i++){
    var r = TIERS[i][0] * CM_PER_HAND / 200;
    var p = progOf(r);
    if (p <= 2 || p >= 99) continue;
    var d = document.createElement("div");
    d.className = "tick" + (TIERS[i][2] ? " big" : "");
    d.style.left = p + "%";
    barEl.appendChild(d);
  }
})();

var lastHp = 1, hpT = null;
function syncHUD(){
  var h = handsOf(radius);
  sizeval.innerHTML = handsText(h) + "<span>hh</span>";
  metricEl.textContent = metricText(radius);
  barfill.style.width = Math.max(0, Math.min(100, progOf(radius))) + "%";
  tierEl.textContent = tierName(tier);
  hpEl.textContent = Math.round(hp) + " hp";
  if (hp !== lastHp){
    lastHp = hp;
    hpEl.classList.add("up");
    clearTimeout(hpT);
    hpT = setTimeout(function(){ hpEl.classList.remove("up"); }, 700);
  }
}
function syncClock(){
  var t = Math.max(0, Math.ceil(timeLeft));
  timeEl.textContent = Math.floor(t/60) + ":" + ("0" + (t%60)).slice(-2);
  clockEl.classList.toggle("low", t <= 20);
}

// ---------------------------------------------------------------- input
var keys = {};
addEventListener("keydown", function(e){
  keys[e.code] = true;
  if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space"].indexOf(e.code) >= 0) e.preventDefault();
  if (DEV && running) devKey(e.code);
});
addEventListener("keyup", function(e){ keys[e.code] = false; });
addEventListener("blur", function(){ keys = {}; });

// Dev field only. Any of these marks the run so it can never be a record.
function devKey(code){
  if (code === "BracketRight"){ setRadius(radius*1.4); dirty = true; }
  else if (code === "BracketLeft"){ setRadius(Math.max(START_R, radius/1.4)); dirty = true; }
  else if (code === "KeyT"){ timeLeft += 30; dirty = true; }
  else if (code === "KeyY"){ hp *= 4; applyFov(); dirty = true; }
  else return;
  checkTier();
  syncHUD();
  syncClock();
}

var dragging = false, lastX = 0;
renderer.domElement.addEventListener("pointerdown", function(e){
  if (e.pointerType === "touch") return;
  dragging = true; lastX = e.clientX;
  renderer.domElement.setPointerCapture(e.pointerId);
});
renderer.domElement.addEventListener("pointermove", function(e){
  if (!dragging) return;
  camYaw -= (e.clientX - lastX) * 0.005;
  lastX = e.clientX;
});
addEventListener("pointerup", function(){ dragging = false; });

var touchDir = new THREE.Vector2();
var knob = document.getElementById("knob");
var stickId = null, stickOrigin = {x:0,y:0};

function stickStart(e){
  var t = e.changedTouches[0];
  stickId = t.identifier;
  stickOrigin.x = t.clientX; stickOrigin.y = t.clientY;
  knob.style.display = "block";
  knob.style.left = (t.clientX-55) + "px";
  knob.style.top  = (t.clientY-55) + "px";
  e.preventDefault();
}
function stickMove(e){
  for (var i=0;i<e.changedTouches.length;i++){
    var t = e.changedTouches[i];
    if (t.identifier !== stickId) continue;
    var dx = t.clientX - stickOrigin.x, dy = t.clientY - stickOrigin.y;
    var len = Math.hypot(dx,dy) || 1;
    var cl = Math.min(len, 55);
    touchDir.set(dx/len * (cl/55), dy/len * (cl/55));
    knob.firstElementChild.style.transform =
      "translate(" + (dx/len*cl) + "px," + (dy/len*cl) + "px)";
  }
  e.preventDefault();
}
function stickEnd(e){
  for (var i=0;i<e.changedTouches.length;i++){
    if (e.changedTouches[i].identifier === stickId){
      stickId = null; touchDir.set(0,0);
      knob.style.display = "none";
      knob.firstElementChild.style.transform = "";
    }
  }
}
var stickEl = document.getElementById("stick");
stickEl.addEventListener("touchstart", stickStart, {passive:false});
stickEl.addEventListener("touchmove",  stickMove,  {passive:false});
stickEl.addEventListener("touchend",   stickEnd);
stickEl.addEventListener("touchcancel",stickEnd);

var lookId = null, lookX = 0;
var lookEl = document.getElementById("look");
lookEl.addEventListener("touchstart", function(e){
  var t = e.changedTouches[0]; lookId = t.identifier; lookX = t.clientX; e.preventDefault();
}, {passive:false});
lookEl.addEventListener("touchmove", function(e){
  for (var i=0;i<e.changedTouches.length;i++){
    var t = e.changedTouches[i];
    if (t.identifier !== lookId) continue;
    camYaw -= (t.clientX - lookX) * 0.006;
    lookX = t.clientX;
  }
  e.preventDefault();
}, {passive:false});
lookEl.addEventListener("touchend", function(){ lookId = null; });

// ---------------------------------------------------------------- camera
var camPos = new THREE.Vector3();
var camAim = new THREE.Vector3();
function placeCamera(dt, snap){
  var dist = 4.2 + radius*4.2;
  var high = 1.8 + radius*2.4;
  camPos.set(
    katamari.position.x + Math.sin(camYaw)*dist,
    katamari.position.y + high,
    katamari.position.z + Math.cos(camYaw)*dist
  );
  camAim.copy(katamari.position);
  camAim.y += radius*0.6;
  if (snap) camera.position.copy(camPos);
  else camera.position.lerp(camPos, 1 - Math.pow(1 - 0.09, dt*60));
  camera.lookAt(camAim);
  if (shake > 0){
    camera.position.x += (Math.random()-0.5)*shake;
    camera.position.y += (Math.random()-0.5)*shake;
  }
}

// ---------------------------------------------------------------- loop
var clock = new THREE.Clock();
var moveDir = new THREE.Vector3();
var axis = new THREE.Vector3();
var fwd = new THREE.Vector3();
var right = new THREE.Vector3();

function step(dt){
  var fx = 0, fz = 0;
  if (keys.KeyW || keys.ArrowUp)    fz += 1;
  if (keys.KeyS || keys.ArrowDown)  fz -= 1;
  if (keys.KeyD || keys.ArrowRight) fx += 1;
  if (keys.KeyA || keys.ArrowLeft)  fx -= 1;
  if (touchDir.lengthSq() > 0.01){ fx += touchDir.x; fz -= touchDir.y; }
  if (keys.KeyQ) camYaw += dt*1.8;
  if (keys.KeyE) camYaw -= dt*1.8;

  fwd.set(-Math.sin(camYaw), 0, -Math.cos(camYaw));
  right.set(-fwd.z, 0, fwd.x);
  moveDir.set(0,0,0).addScaledVector(fwd, fz).addScaledVector(right, fx);
  if (moveDir.lengthSq() > 1) moveDir.normalize();

  var pm      = powerMul();
  var accel   = (16 + radius*7)   * pm;
  var maxSpd  = (7  + radius*2.6) * pm;
  vel.addScaledVector(moveDir, accel*dt);
  vel.multiplyScalar(Math.pow(0.02, dt));
  var sp = vel.length();
  if (sp > maxSpd){ vel.multiplyScalar(maxSpd/sp); sp = maxSpd; }

  katamari.position.addScaledVector(vel, dt);
  katamari.position.y = radius;

  var dist = sp*dt;
  if (dist > 1e-5){
    axis.set(vel.x, 0, vel.z).normalize();
    axis.crossVectors(UP, axis);
    katamari.rotateOnWorldAxis(axis, dist/radius);
  }

  var lim = WORLD;
  if (Math.abs(katamari.position.x) > lim){
    katamari.position.x = Math.sign(katamari.position.x)*lim; vel.x *= -0.3;
  }
  if (Math.abs(katamari.position.z) > lim){
    katamari.position.z = Math.sign(katamari.position.z)*lim; vel.z *= -0.3;
  }

  var reach = radius + 3.2;
  for (var i=props.length-1;i>=0;i--){
    var p = props[i];
    var dx = p.position.x - katamari.position.x;
    var dz = p.position.z - katamari.position.z;
    var pr = p.userData.r;
    if (Math.abs(dx) > reach + pr || Math.abs(dz) > reach + pr) continue;

    var d2 = dx*dx + dz*dz;
    var hit = radius + pr;
    if (d2 > hit*hit) continue;
    if (p.userData.size <= radius * PICKUP){
      props.splice(i,1);
      collect(p);
    } else {
      var d = Math.sqrt(d2) || 0.001;
      var nx = -dx/d, nz = -dz/d;
      katamari.position.x += nx*(hit-d);
      katamari.position.z += nz*(hit-d);
      var into = vel.x*(-nx) + vel.z*(-nz);
      if (into > 0){
        vel.x += nx*into*1.5;
        vel.z += nz*into*1.5;
        shake = Math.min(0.35, into*0.03);
        if (into > 1.2) nay(p);
      }
    }
  }
  if (shake > 0) shake = Math.max(0, shake - dt*1.4);

  sun.position.set(katamari.position.x + 30, 55, katamari.position.z + 22);
  sun.target.position.copy(katamari.position);
  scene.fog.near = 60 + radius*9;
  scene.fog.far  = 230 + radius*34;
  var ext = Math.max(20, radius*9);
  var sc = sun.shadow.camera;
  sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext;
  sc.updateProjectionMatrix();
}

var acc = 0;
function frame(){
  requestAnimationFrame(frame);
  var dt = Math.min(clock.getDelta(), 0.25);

  if (running){
    acc += dt;
    var n = 0;
    while (acc >= FIXED && n < MAX_STEPS && running){
      step(FIXED);
      timeLeft -= FIXED;
      acc -= FIXED;
      n++;
      if (timeLeft <= 0) break;
    }
    if (acc > FIXED*MAX_STEPS) acc = 0;
    syncClock();
    if (radius >= GOAL_R && !cleared) clearGoal();
    if (timeLeft <= 0) finish(cleared);
  }

  updateRig(dt);
  placeCamera(dt, false);
  renderer.render(scene, camera);
}

// ---------------------------------------------------------------- flow
function clearGoal(){
  cleared = true;
  banner("78.2hh. Max is max. Keep going.", 3200);
}

var startveil = document.getElementById("startveil");
var endveil   = document.getElementById("endveil");

function finish(won){
  running = false;
  var h = handsOf(radius);
  document.getElementById("endtitle").textContent = won ? "MAX HORSE" : "time.";
  document.getElementById("final").innerHTML = handsText(h) + "<span>hh</span>";
  document.getElementById("tally").textContent =
    collected + " things stuck to Max · " + metricText(radius) + " across";
  document.getElementById("exprval").textContent = handsText(h) + "hh, " + Math.round(hp) + " hp";
  document.getElementById("endnote").textContent = won
    ? "Sampson managed 21.2hh in 1850 and nothing has beaten him since. Max did it in three minutes."
    : "Start on the crumbs. Every pickup unlocks the next size up.";
  document.getElementById("devnote").classList.toggle("hidden", !dirty);
  document.getElementById("seedend").textContent = "field " + SEED;
  endveil.classList.remove("hidden");
}

function begin(){
  startveil.classList.add("hidden");
  endveil.classList.add("hidden");
  reset();
  clock.getDelta();
  acc = 0;
  running = true;
}
document.getElementById("startbtn").addEventListener("click", begin);
document.getElementById("againbtn").addEventListener("click", begin);

addEventListener("resize", function(){
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------------------------------------------------------------- title card
var GLOSS = [
  "<b>max</b> <i>proper noun</i><br>a horse.",
  "<b>max</b> <i>verb</i><br>to enlarge, past all reason.",
  "<b>max.horse</b> <i>property</i><br>the number that comes back. it only goes up."
];
var glossEl = document.getElementById("gloss"), gi = 1;
glossEl.innerHTML = GLOSS[0];
setInterval(function(){
  if (startveil.classList.contains("hidden")) return;
  glossEl.style.opacity = 0;
  setTimeout(function(){
    glossEl.innerHTML = GLOSS[gi % GLOSS.length]; gi++;
    glossEl.style.opacity = 1;
  }, 340);
}, 3200);

var seedstart = document.getElementById("seedstart");
if (DEV){
  document.getElementById("devbadge").classList.remove("hidden");
  seedstart.innerHTML = "dev field &middot; <b>[</b> <b>]</b> size, <b>T</b> time, <b>Y</b> power " +
                        "&middot; <a href='?'>today's field</a>";
} else {
  seedstart.innerHTML = "field " + SEED + " — everyone gets the same one today " +
                        "&middot; <a href='?seed=dev'>dev field</a>";
}

// idle backdrop behind the title card
reset();
running = false;
frame();

