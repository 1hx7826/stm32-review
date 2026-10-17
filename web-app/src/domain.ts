import type {Attempt,Question,Rating,Response,ReviewEvent,StudyData} from './model';
import {now,uid} from './model';
export function isPublished(q:Question){
 const verified=['answer','reasoning','chipApplicability'] as const;
 const official=verified.every(k=>q.verification[k]==='official_checked');
 const match=/^q\.course(\d+)\.s(\d+)\./.exec(q.id),number=match?`${match[1]}.${match[2]}`:'';
 const course=!!match&&verified.every(k=>q.verification[k]==='source_checked')&&q.sources.some(s=>s.status==='source_checked'&&(
  s.sourceId===`src.course.${number}`&&s.url===`urn:stm32:course:${number}:pdf`||
  number==='9.10'&&s.sourceId==='src.course.original.9.10'&&s.url.startsWith('https://www.st.com/resource/en/reference_manual/rm0008-')));
 return q.publicationStatus==='published'&&(official||course)&&!q.sources.some(s=>s.status==='conflict')&&['not_applicable','compiled','on_device'].includes(q.verification.code);
}
export function grade(q:Question,r:Response):Attempt['grading'] {
 if(q.type==='flashcard'){if(r.kind!=='self_rating')throw new Error('记忆卡需要自评');return {kind:'self_rated',isCorrect:null};}
 if(q.type==='true_false'){if(r.kind!=='boolean')throw new Error('判断题答案格式错误');return {kind:'objective',isCorrect:r.value===q.answer.value};}
 if(['single_choice','code_reading','troubleshooting'].includes(q.type)){if(r.kind!=='options'||r.optionIds.length!==1||!q.payload.options?.some(o=>o.id===r.optionIds[0]))throw new Error('选项 ID 无效');return {kind:'objective',isCorrect:r.optionIds[0]===q.answer.optionId};}
 throw new Error('本原型尚不支持此题型');
}
export function recordAttempt(d:StudyData,a:Attempt):StudyData {if(d.attempts.some(x=>x.attemptId===a.attemptId))return d;const n={...d,attempts:[...d.attempts,a]};if(a.grading.isCorrect===false)n.wrongQuestionStates=[...d.wrongQuestionStates.filter(x=>x.questionId!==a.questionId),{questionId:a.questionId,state:'open',updatedAt:a.answeredAt,resolvedAt:null,note:d.wrongQuestionStates.find(x=>x.questionId===a.questionId)?.note||''}];return n;}
const reviewSteps=[1,3,7,14,30];
const automaticReviewId=(attemptId:string)=>`rev.${attemptId.slice(4)}`;
/** v1 没有 origin 字段：同次同刻的自评优先于沿用 att UUID 的默认事件。 */
function preferReview(prior:ReviewEvent|undefined,event:ReviewEvent):ReviewEvent {
 if(!prior)return event;
 const delta=Date.parse(event.reviewedAt)-Date.parse(prior.reviewedAt);if(delta!==0)return delta>0?event:prior;
 if(event.attemptId&&event.attemptId===prior.attemptId){
  const automatic=automaticReviewId(event.attemptId),priorAuto=prior.reviewEventId===automatic,eventAuto=event.reviewEventId===automatic;
  if(priorAuto!==eventAuto)return eventAuto?prior:event;
 }
 return event;
}
function currentReview(d:StudyData,event:ReviewEvent,revision:number){
 if(!event.attemptId)return true;
 const a=d.attempts.find(x=>x.attemptId===event.attemptId);return !!a&&a.questionRevision===revision&&a.grading.kind!=='ungraded';
}
function latestReview(events:ReviewEvent[]){let latest:ReviewEvent|undefined;for(const event of events)latest=preferReview(latest,event);return latest;}
/** 正式客观作答与默认复习事件作为一个变换，在同一保存事务提交。 */
export function recordAnswer(d:StudyData,a:Attempt):StudyData {
 if(d.attempts.some(x=>x.attemptId===a.attemptId))return d;
 const next=recordAttempt(d,a);if(a.grading.kind!=='objective')return next;
 const prior=latestReview(d.reviewEvents.filter(e=>e.questionId===a.questionId&&currentReview(d,e,a.questionRevision)));
 // 提前答对只保存作答，既不进阶也不把原到期时间向后移动。答错始终重排十分钟。
 if(a.grading.isCorrect&&prior&&Date.parse(a.answeredAt)<Date.parse(prior.nextDueAt))return next;
 const days=a.grading.isCorrect?(reviewSteps.find(x=>x>(prior?.intervalDays||0))??30):0;
 const event:ReviewEvent={reviewEventId:automaticReviewId(a.attemptId),questionId:a.questionId,reviewedAt:a.answeredAt,rating:a.grading.isCorrect?'good':'again',attemptId:a.attemptId,schedulerVersion:'simple-spaced-v1',intervalDays:days,nextDueAt:new Date(Date.parse(a.answeredAt)+(days?days*86400000:600000)).toISOString()};
 return addReview(next,event);
}
export function createReview(d:StudyData,questionId:string,rating:Rating,attemptId:string|null,at=now()):ReviewEvent {
 const prior=latestReview(d.reviewEvents.filter(x=>x.questionId===questionId&&(!attemptId||x.attemptId!==attemptId)));const steps=reviewSteps;const idx=steps.findIndex(x=>x>(prior?.intervalDays||0));
 const days=rating==='again'?0:rating==='hard'?1:steps[Math.min(idx<0?4:idx+(rating==='easy'?1:0),4)];
 return {reviewEventId:uid('rev'),questionId,reviewedAt:at,rating,attemptId,schedulerVersion:'simple-spaced-v1',intervalDays:days,nextDueAt:new Date(Date.parse(at)+(days===0?600000:days*86400000)).toISOString()};
}
export function addReview(d:StudyData,e:ReviewEvent){return d.reviewEvents.some(x=>x.reviewEventId===e.reviewEventId)?d:{...d,reviewEvents:[...d.reviewEvents,e]};}
export function dueQuestions(d:StudyData,qs:Question[],at=Date.now()){
 const current=new Map(qs.filter(isPublished).map(q=>[q.id,q])),latest=new Map<string,ReviewEvent>();
 for(const r of d.reviewEvents){const q=current.get(r.questionId);if(!q||!currentReview(d,r,q.revision))continue;latest.set(r.questionId,preferReview(latest.get(r.questionId),r));}
 return qs.filter(isPublished).filter(q=>{const r=latest.get(q.id);return r?Date.parse(r.nextDueAt)<=at:d.wrongQuestionStates.some(x=>x.questionId===q.id&&x.state==='open')&&d.attempts.some(a=>a.questionId===q.id&&a.questionRevision===q.revision&&a.grading.kind==='objective'&&a.grading.isCorrect===false);});
}
export function stats(d:StudyData,qs?:Question[]){const current=(x:Attempt)=>!qs||qs.some(q=>q.id===x.questionId&&q.revision===x.questionRevision&&isPublished(q));const a=d.attempts.filter(x=>x.grading.kind==='objective'&&current(x));return {total:a.length,correct:a.filter(x=>x.grading.isCorrect).length,accuracy:a.length?Math.round(a.filter(x=>x.grading.isCorrect).length/a.length*100):null,cards:d.attempts.filter(x=>x.grading.kind==='self_rated'&&current(x)).length};}
export function normalizeStudy(d:StudyData,archivedIds:ReadonlySet<string>=new Set()):StudyData {
 const dead=new Set(d.tombstones.map(x=>x.targetId));
 const attempts=d.attempts.filter(x=>!dead.has(x.attemptId));
 const reviewEvents=d.reviewEvents.filter(x=>!dead.has(x.reviewEventId)&&(!x.attemptId||attempts.some(a=>a.attemptId===x.attemptId)));
 const errors=attempts.filter(x=>x.grading.kind==='objective'&&x.grading.isCorrect===false);
 let wrongQuestionStates=d.wrongQuestionStates.filter(x=>archivedIds.has(x.questionId)||attempts.some(a=>a.questionId===x.questionId&&a.grading.kind==='ungraded')||errors.some(a=>a.questionId===x.questionId));
 for(const a of errors){const w=wrongQuestionStates.find(x=>x.questionId===a.questionId);if(!w||Date.parse(w.updatedAt)<Date.parse(a.answeredAt))wrongQuestionStates=[...wrongQuestionStates.filter(x=>x.questionId!==a.questionId),{questionId:a.questionId,state:'open',updatedAt:a.answeredAt,resolvedAt:null,note:w?.note||''}];}
 return {...d,attempts,reviewEvents,wrongQuestionStates};
}
