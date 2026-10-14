import type {StudyData} from './model';
import {emptyStudy,now,uid} from './model';
export interface Snapshot {revision:number;data:StudyData}
export const DB_NAME='stm32-review-v1';
let opening:Promise<IDBDatabase>|undefined;
export function database(){if(!opening)opening=new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>{r.result.createObjectStore('main');r.result.createObjectStore('backups',{keyPath:'id'});};r.onerror=()=>{opening=undefined;reject(r.error||new Error('无法打开 IndexedDB'));};r.onblocked=()=>{opening=undefined;reject(new Error('其他标签页阻止打开数据库，请关闭旧页面后重试'));};r.onsuccess=()=>{r.result.onversionchange=()=>{r.result.close();opening=undefined;};resolve(r.result);};});return opening;}
export async function loadStudy(version:string):Promise<Snapshot>{const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('main','readwrite');const r=tx.objectStore('main').get('state');let result:Snapshot;r.onsuccess=()=>{result=r.result||{revision:0,data:emptyStudy(version)};if(!r.result)tx.objectStore('main').put(result,'state');};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('读取事务取消'));});}
export async function mutateStudy(version:string,change:(d:StudyData)=>StudyData,options:{backup?:boolean;expectedRevision?:number}={}):Promise<Snapshot>{
 const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction(['main','backups'],'readwrite');const store=tx.objectStore('main');let result:Snapshot;let failure:Error|undefined;const r=store.get('state');
 r.onsuccess=()=>{try{const current:Snapshot=r.result||{revision:0,data:emptyStudy(version)};if(options.expectedRevision!==undefined&&current.revision!==options.expectedRevision)throw new Error('本地记录已变化，请重新预览导入');const next=change(structuredClone(current.data));if(options.backup)tx.objectStore('backups').put({id:uid('backup'),at:now(),data:current.data});result={revision:current.revision+1,data:next};store.put(result,'state');}catch(e){failure=e instanceof Error?e:new Error(String(e));tx.abort();}};
 tx.oncomplete=()=>{try{const c=new BroadcastChannel(DB_NAME);c.postMessage(result.revision);c.close();}catch{}resolve(result);};tx.onerror=()=>reject(failure||tx.error||new Error('保存失败'));tx.onabort=()=>reject(failure||tx.error||new Error('保存事务取消'));
 });
}
export async function latestBackup():Promise<StudyData|null>{const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('backups','readonly');const r=tx.objectStore('backups').getAll();r.onsuccess=()=>resolve(r.result.sort((a,b)=>Date.parse(b.at)-Date.parse(a.at))[0]?.data||null);r.onerror=()=>reject(r.error);});}
export function closeDatabase(){opening?.then(db=>db.close()).catch(()=>{});opening=undefined;}
