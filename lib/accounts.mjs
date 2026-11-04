import {randomBytes,createHash,scrypt,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {GameError} from './sessions.mjs';
const derive=promisify(scrypt),PARAMETERS={N:32768,r:8,p:1,maxmem:64*1024*1024};
const hashToken=s=>createHash('sha256').update(s).digest('hex');
export const COOKIE='lantern_session';
export function sessionCookie(token,age=604800){return `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}`;}
export function cookieToken(header=''){return header.split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)??'';}
export class Accounts{
 constructor(db,{now=Date.now}={}){this.db=db;this.now=now;this.attempts=new Map();}
 limit(bucket){
  const now=this.now();for(const [key,value] of this.attempts)if(value.until<now)this.attempts.delete(key);
  const state=this.attempts.get(bucket)??{count:0,until:now+15*60000};
  if(state.count>=12)throw new GameError('Too many sign-in attempts. Please wait a few minutes.',429);
  state.count++;this.attempts.set(bucket,state);
 }
 public(user){return user?{id:user.id,username:user.username,goal:user.goal}:null;}
 authenticate(token){
  this.db.prepare('DELETE FROM auth_sessions WHERE expires_at<=?').run(this.now());
  if(!/^[a-f0-9]{64}$/.test(token))return null;
  return this.public(this.db.prepare('SELECT u.* FROM users u JOIN auth_sessions s ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').get(hashToken(token),this.now()));
 }
 require(token){const user=this.authenticate(token);if(!user)throw new GameError('Sign in to keep your learning progress.',401);return user;}
 issue(userId){
  const token=randomBytes(32).toString('hex');
  this.db.prepare('INSERT INTO auth_sessions VALUES(?,?,?)').run(hashToken(token),userId,this.now()+604800000);
  // Bound stale devices without keeping IP addresses or browser fingerprints.
  this.db.prepare('DELETE FROM auth_sessions WHERE user_id=? AND token_hash NOT IN (SELECT token_hash FROM auth_sessions WHERE user_id=? ORDER BY expires_at DESC LIMIT 10)').run(userId,userId);
  return token;
 }
 async register(username,password,bucket='local'){
  this.limit(bucket);username=typeof username==='string'?username.trim():'';
  if(!/^[a-zA-Z0-9_.-]{3,24}$/.test(username))throw new GameError('Use 3–24 letters, numbers, dots, underscores or hyphens for your name.');
  if(typeof password!=='string'||[...password].length<8||[...password].length>128||Buffer.byteLength(password)>512)throw new GameError('Choose a password with 8–128 characters.');
  const salt=randomBytes(16).toString('hex'),hash=(await derive(password,salt,64,PARAMETERS)).toString('hex');
  let userId;
  try{userId=Number(this.db.prepare('INSERT INTO users(username,username_key,password_hash,created_at) VALUES(?,?,?,?)').run(username,username.toLowerCase(),`scrypt$${salt}$${hash}`,this.now()).lastInsertRowid);}catch(e){if(e.code?.includes('CONSTRAINT')||String(e.message).includes('UNIQUE'))throw new GameError('That name is already taken. Try another.',409);throw e;}
  const user=this.public(this.db.prepare('SELECT * FROM users WHERE id=?').get(userId));return {user,token:this.issue(userId)};
 }
 async login(username,password,bucket='local'){
  this.limit(bucket);
  if(typeof username!=='string'||typeof password!=='string'||password.length>512)throw new GameError('The name or password is incorrect.',401);
  const row=this.db.prepare('SELECT * FROM users WHERE username_key=?').get(username.trim().toLowerCase());
  const [,salt,expected]=(row?.password_hash??`scrypt$${'0'.repeat(32)}$${'0'.repeat(128)}`).split('$');
  const hash=await derive(password,salt,64,PARAMETERS);
  if(!row||!timingSafeEqual(hash,Buffer.from(expected,'hex')))throw new GameError('The name or password is incorrect.',401);
  const token=this.issue(row.id);return {user:this.public(row),token};
 }
 logout(token){if(token)this.db.prepare('DELETE FROM auth_sessions WHERE token_hash=?').run(hashToken(token));}
}
