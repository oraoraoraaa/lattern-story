import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,chmodSync} from 'node:fs';
import path from 'node:path';
export function openDatabase(filename){
 if(filename!==':memory:'){const directory=path.dirname(filename);mkdirSync(directory,{recursive:true,mode:0o700});chmodSync(directory,0o700);}
 const db=new DatabaseSync(filename);
 db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,username TEXT NOT NULL,username_key TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,goal INTEGER NOT NULL DEFAULT 30,created_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS auth_sessions(token_hash TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS vocab_progress(user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,entry_id TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,successes INTEGER NOT NULL DEFAULT 0,lapses INTEGER NOT NULL DEFAULT 0,level INTEGER NOT NULL DEFAULT 0,last_at INTEGER NOT NULL,last_success_at INTEGER,due_at INTEGER,mastered INTEGER NOT NULL DEFAULT 0,passed INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(user_id,entry_id));
 CREATE TABLE IF NOT EXISTS review_events(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,entry_id TEXT NOT NULL,at INTEGER NOT NULL,kind TEXT NOT NULL,result INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS reviews_user_time ON review_events(user_id,at);
 CREATE TABLE IF NOT EXISTS learning_sessions(user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,id TEXT NOT NULL UNIQUE,state TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS tutor_examples(cache_key TEXT PRIMARY KEY,created_at INTEGER NOT NULL,payload TEXT NOT NULL);
 PRAGMA user_version=1;`);
 if(filename!==':memory:')chmodSync(filename,0o600);
 return db;
}
export function transaction(db,work){
 db.exec('BEGIN IMMEDIATE');try{const result=work();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}
}
