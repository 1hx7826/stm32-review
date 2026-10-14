import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import schema from './generated/study-schema.json';
import type {Content,StudyData} from './model';
import {grade,isPublished,normalizeStudy} from './domain';
import {archiveDetails} from './history';
const ajv=new Ajv2020({allErrors:true,strict:false});addFormats(ajv);const validate=ajv.compile(schema);
export const MAX_IMPORT_BYTES=5*1024*1024;
function safeTree(v:unknown,depth=0):void{if(depth>20)throw new Error('JSON 嵌套过深');if(v&&typeof v==='object')for(const [k,x]of Object.entries(v)){if(['__proto__','constructor','prototype'].includes(k))throw new Error(`不允许的字段：${k}`);safeTree(x,depth+1);}}
function unique<T>(a:T[],key:(x:T)=>string,label:string){if(new Set(a.map(key)).size!==a.length)throw new Error(`${label} ID 重复`);}
export function parseImport(text:string,c:Content):StudyData {
 if(new TextEncoder().encode(text).length>MAX_IMPORT_BYTES)throw new Error('文件超过 5 MiB 限制');let p:unknown;try{p=JSON.parse(text);}catch{throw new Error('不是有效的 JSON 文件');}safeTree(p);if(!validate(p))throw new Error(`格式校验失败：${ajv.errorsText(validate.errors,{separator:'；'})}`);const d=structuredClone(p) as unknown as StudyData;
 const chapters=new Set(c.chapters.map(x=>x.id)),points=new Set(c.chapters.flatMap(x=>x.knowledgePoints.map(p=>p.id))),qs=new Map([...c.historyQuestions,...c.questions].map(x=>[x.id,x]));try{new Intl.DateTimeFormat('zh-CN',{timeZone:d.profile.timeZone});}catch{throw new Error('时区无效');}
 unique(d.chapterStates,x=>x.chapterId,'章节');unique(d.knowledgeStates,x=>x.knowledgePointId,'知识点');unique(d.questionStates,x=>x.questionId,'题目状态');unique(d.attempts,x=>x.attemptId,'答题');unique(d.reviewEvents,x=>x.reviewEventId,'复习');unique(d.wrongQuestionStates,x=>x.questionId,'错题');unique(d.tombstones,x=>x.deletionId,'删除记录');
 for(const x of d.chapterStates)if(!chapters.has(x.chapterId))throw new Error(`未知章节 ID：${x.chapterId}`);for(const x of d.knowledgeStates)if(!points.has(x.knowledgePointId))throw new Error(`未知知识点 ID：${x.knowledgePointId}`);
 for(const x of d.attempts){
  if(!x.attemptId.startsWith('att.'))throw new Error('答题事件前缀错误');
  const response=x.response;
  const tokens=response.kind==='options'?response.optionIds:response.kind==='ordering'?response.orderedItemIds:response.kind==='matching'?response.pairs.flatMap(p=>[p.leftId,p.rightId]):[];
  if(tokens.some(id=>!/^[-A-Za-z0-9._]+$/.test(id)))throw new Error('历史答案选项 ID 格式无效');
  if(response.kind==='matching'&&(new Set(response.pairs.map(p=>p.leftId)).size!==response.pairs.length||new Set(response.pairs.map(p=>p.rightId)).size!==response.pairs.length))throw new Error('历史匹配答案 ID 重复');
  const q=qs.get(x.questionId);
  if(!q||q.revision!==x.questionRevision||!isPublished(q)){x.grading={kind:'ungraded',isCorrect:null};continue;}
  x.grading=grade(q,response);
 }
 const attempts=new Map(d.attempts.map(x=>[x.attemptId,x]));for(const x of d.reviewEvents){if(!x.reviewEventId.startsWith('rev.'))throw new Error('复习事件前缀错误');if(x.attemptId){const a=attempts.get(x.attemptId);if(!a||a.questionId!==x.questionId)throw new Error('复习事件引用无效');if(Date.parse(x.reviewedAt)<Date.parse(a.answeredAt))throw new Error('复习时间早于作答时间');}if(Date.parse(x.nextDueAt)<Date.parse(x.reviewedAt))throw new Error('到期时间早于复习时间');}
 for(const x of d.tombstones)if(!x.deletionId.startsWith('del.')||!x.targetId.startsWith(x.targetKind==='attempt'?'att.':'rev.'))throw new Error('删除记录前缀错误');for(const x of d.wrongQuestionStates)if(x.resolvedAt&&Date.parse(x.resolvedAt)>Date.parse(x.updatedAt))throw new Error('错题解决时间无效');return normalizeStudy(d,new Set(archiveDetails(d,c).questionIds));
}
export interface ImportPreview {merged:StudyData;newEvents:number;duplicates:number;conflicts:number;foreignProfile:boolean;deletions:number;archived:ReturnType<typeof archiveDetails>;replacement:{attempts:number;reviews:number;chapterStates:number}}
const stable=(x:unknown):string=>Array.isArray(x)?`[${x.map(stable).join(',')}]`:x&&typeof x==='object'?`{${Object.entries(x).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${JSON.stringify(k)}:${stable(v)}`).join(',')}}`:JSON.stringify(x);
export function previewImport(current:StudyData,incoming:StudyData,c:Content):ImportPreview {
 let newEvents=0,duplicates=0,conflicts=0;
 function merge<T extends object>(a:T[],b:T[],key:(x:T)=>string,event=false):T[]{const map=new Map(a.map(x=>[key(x),x]));for(const x of b){const old=map.get(key(x));if(!old){map.set(key(x),x);if(event)newEvents++;}else if(stable(old)===stable(x)){if(event)duplicates++;}else{conflicts++;if(!event){const ta=Date.parse((old as {updatedAt?:string}).updatedAt||''),tb=Date.parse((x as {updatedAt?:string}).updatedAt||'');if(tb>ta)map.set(key(x),x);}}}return [...map.values()];}
 const merged:StudyData={...current,chapterStates:merge(current.chapterStates,incoming.chapterStates,x=>x.chapterId),knowledgeStates:merge(current.knowledgeStates,incoming.knowledgeStates,x=>x.knowledgePointId),questionStates:merge(current.questionStates,incoming.questionStates,x=>x.questionId),attempts:merge(current.attempts,incoming.attempts,x=>x.attemptId,true),reviewEvents:merge(current.reviewEvents,incoming.reviewEvents,x=>x.reviewEventId,true),wrongQuestionStates:merge(current.wrongQuestionStates,incoming.wrongQuestionStates,x=>x.questionId),tombstones:merge(current.tombstones,incoming.tombstones,x=>x.deletionId,true)};
 const dead=new Set(merged.tombstones.map(x=>x.targetId));merged.attempts=merged.attempts.filter(x=>!dead.has(x.attemptId));merged.reviewEvents=merged.reviewEvents.filter(x=>!dead.has(x.reviewEventId)&&(!x.attemptId||merged.attempts.some(a=>a.attemptId===x.attemptId)));
 for(const a of merged.attempts.filter(x=>x.grading.isCorrect===false)){const w=merged.wrongQuestionStates.find(x=>x.questionId===a.questionId);if(!w||Date.parse(w.updatedAt)<Date.parse(a.answeredAt))merged.wrongQuestionStates=[...merged.wrongQuestionStates.filter(x=>x.questionId!==a.questionId),{questionId:a.questionId,state:'open',updatedAt:a.answeredAt,resolvedAt:null,note:w?.note||''}];}
 return {merged:normalizeStudy(merged,new Set(archiveDetails(merged,c).questionIds)),newEvents,duplicates,conflicts,foreignProfile:current.profile.profileId!==incoming.profile.profileId,deletions:incoming.tombstones.length,archived:archiveDetails(incoming,c),replacement:{attempts:current.attempts.length,reviews:current.reviewEvents.length,chapterStates:current.chapterStates.length}};
}
