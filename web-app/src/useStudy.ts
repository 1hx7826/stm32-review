import {useCallback,useEffect,useRef,useState} from 'react';
import {DB_NAME,loadStudy,mutateStudy,type Snapshot} from './storage';
import {emptyStudy,type StudyData} from './model';
export function useStudy(version:string){
 const [snapshot,setSnapshot]=useState<Snapshot>(()=>({revision:0,data:emptyStudy(version)}));const ref=useRef(snapshot);ref.current=snapshot;
 const [status,setStatus]=useState<'loading'|'saved'|'saving'|'failed'|'unavailable'>('loading');const [error,setError]=useState('');const pending=useRef<((d:StudyData)=>StudyData)[]>([]);const busy=useRef(false);
 const load=useCallback(async()=>{try{setStatus('loading');const s=await loadStudy(version);ref.current=s;setSnapshot(s);setStatus('saved');setError('');}catch(e){setStatus('unavailable');setError(String(e));}},[version]);
 useEffect(()=>{void load();},[load]);
 useEffect(()=>{let channel:BroadcastChannel|undefined;try{channel=new BroadcastChannel(DB_NAME);channel.onmessage=()=>{if(!busy.current&&!pending.current.length)void loadStudy(version).then(s=>{ref.current=s;setSnapshot(s);}).catch(e=>{setError(String(e));setStatus('unavailable');});};}catch{}return()=>channel?.close();},[version]);
 const save=useCallback(async(change:(d:StudyData)=>StudyData,options:{backup?:boolean;expectedRevision?:number}={})=>{
  if(busy.current||status==='loading'||status==='unavailable')return false;
  if(pending.current.length){pending.current.push(change);const next={...ref.current,data:change(ref.current.data)};ref.current=next;setSnapshot(next);setStatus('failed');return false;}
  busy.current=true;setStatus('saving');try{const next=await mutateStudy(version,change,options);ref.current=next;setSnapshot(next);setStatus('saved');setError('');return true;}catch(e){if(options.backup){setStatus('saved');setError(String(e));}else{pending.current.push(change);const next={...ref.current,data:change(ref.current.data)};ref.current=next;setSnapshot(next);setStatus('failed');setError(String(e));}return false;}finally{busy.current=false;}
 },[status,version]);
 const retry=useCallback(async()=>{if(busy.current)return;busy.current=true;setStatus('saving');try{const ops=[...pending.current];const next=await mutateStudy(version,d=>ops.reduce((v,fn)=>fn(v),d));pending.current=[];ref.current=next;setSnapshot(next);setStatus('saved');setError('');}catch(e){setStatus('failed');setError(String(e));}finally{busy.current=false;}},[version]);
 return {data:snapshot.data,revision:snapshot.revision,status,error,save,retry,reload:load,ready:status!=='loading'&&status!=='unavailable',clean:status==='saved'};
}
