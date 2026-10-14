import {describe,it,expect} from 'vitest';
import raw from '../src/generated/content.json';
import {emptyStudy,type Attempt,type Content,type Rating} from '../src/model';
import {addReview,createReview,dueQuestions,recordAnswer,recordAttempt} from '../src/domain';
import {parseImport,previewImport} from '../src/validation';
import {archiveDetails} from '../src/history';

const c=raw as unknown as Content,q=c.questions.find(q=>q.type==='single_choice')!;
const start=Date.parse('2026-10-14T00:00:00.000Z'),day=86400000;
const study=()=>emptyStudy(c.version);
function answer(index:number,at=start,correct=true):Attempt {
 return {attemptId:`att.10000000-0000-4000-8000-${String(index).padStart(12,'0')}`,questionId:q.id,questionRevision:q.revision,answeredAt:new Date(at).toISOString(),mode:'practice',response:{kind:'options',optionIds:[correct?q.answer.optionId!:q.payload.options!.find(o=>o.id!==q.answer.optionId)!.id]},grading:{kind:'objective',isCorrect:correct},durationMs:50};
}

describe('复习调度到期边界',()=>{
 it('五次正确各隔一秒只保存五次作答，仍为首次一天计划',()=>{
  let d=study();for(let i=1;i<=5;i++)d=recordAnswer(d,answer(i,start+(i-1)*1000));
  expect(d.attempts).toHaveLength(5);expect(d.reviewEvents).toHaveLength(1);
  expect(d.reviewEvents[0]).toMatchObject({intervalDays:1,nextDueAt:new Date(start+day).toISOString()});
  expect(dueQuestions(d,[q],start+day-1)).toEqual([]);expect(dueQuestions(d,[q],start+day)).toEqual([q]);
 });
 it('到期前一毫秒不延期，到期时再次正确延长到三天',()=>{
  let d=recordAnswer(study(),answer(1));const original=d.reviewEvents[0];
  d=recordAnswer(d,answer(2,start+day-1));expect(d.reviewEvents).toEqual([original]);
  d=recordAnswer(d,answer(3,start+day));expect(d.reviewEvents.at(-1)).toMatchObject({intervalDays:3,nextDueAt:new Date(start+4*day).toISOString()});
 });
 it('只有到期成功逐档进入 1/3/7/14/30，延迟复习也只前进一档',()=>{
  let d=study(),at=start;for(let i=1;i<=6;i++){d=recordAnswer(d,answer(i,at));at=Date.parse(d.reviewEvents.at(-1)!.nextDueAt)+(i===2?20*day:0);}
  expect(d.reviewEvents.map(e=>e.intervalDays)).toEqual([1,3,7,14,30,30]);
 });
 it('未到期答错重排十分钟，提前纠正不移走近期复习',()=>{
  let d=recordAnswer(study(),answer(1));d=recordAnswer(d,answer(2,start+1000,false));
  const wrong=d.reviewEvents.at(-1)!;expect(wrong).toMatchObject({intervalDays:0,nextDueAt:new Date(start+601000).toISOString()});
  d=recordAnswer(d,answer(3,start+2000));expect(d.reviewEvents.at(-1)).toEqual(wrong);expect(d.reviewEvents).toHaveLength(2);
  d=recordAnswer(d,answer(4,start+601000));expect(d.reviewEvents.at(-1)?.intervalDays).toBe(1);
 });
 it('同次作答四种手动评价均可覆盖默认计划，重复自动提交不覆盖自评',()=>{
  for(const [rating,days] of [['again',0],['hard',1],['good',1],['easy',3]] as [Rating,number][]){
   const a=answer(1),d=recordAnswer(study(),a),manual=createReview(d,q.id,rating,a.attemptId,a.answeredAt);
   const n=addReview(d,manual);expect(manual.intervalDays).toBe(days);expect(recordAnswer(n,a)).toEqual(n);
   const due=Date.parse(manual.nextDueAt);expect(dueQuestions(n,[q],due-1)).toEqual([]);expect(dueQuestions(n,[q],due)).toEqual([q]);
  }
 });
 it('同刻手动计划优先，即使导入后事件顺序为手动在前、自动在后',()=>{
  const a=answer(1,start,false),d=recordAnswer(study(),a),manual=createReview(d,q.id,'easy',a.attemptId,a.answeredAt);
  const n=parseImport(JSON.stringify({...d,reviewEvents:[manual,...d.reviewEvents]}),c);
  expect(dueQuestions(n,[q],start+600000)).toEqual([]);expect(dueQuestions(n,[q],start+3*day)).toEqual([q]);
  const continued=recordAnswer(n,answer(2,start+3*day));expect(continued.reviewEvents.at(-1)?.intervalDays).toBe(7);
 });
 it('未到期主动答对仍可手动调整；下一次自动进阶以手动间隔为准',()=>{
  let d=recordAnswer(study(),answer(1));const a=answer(2,start+1000);d=recordAnswer(d,a);expect(d.reviewEvents).toHaveLength(1);
  const manual=createReview(d,q.id,'easy',a.attemptId,a.answeredAt);d=addReview(d,manual);expect(manual.intervalDays).toBe(7);
  d=recordAnswer(d,answer(3,start+2000));expect(d.reviewEvents).toHaveLength(2);
  d=recordAnswer(d,answer(4,Date.parse(manual.nextDueAt)));expect(d.reviewEvents.at(-1)?.intervalDays).toBe(14);
 });
 it('旧 v1 三十天计划不改写，提前练习不延长；历史归档不进入当前复习',()=>{
  const old=recordAnswer(study(),answer(1));old.reviewEvents[0]={...old.reviewEvents[0],intervalDays:30,nextDueAt:new Date(start+30*day).toISOString()};
  const retired={...answer(9),questionId:'q.retired.rcc.boundary'};let backup=recordAttempt(old,retired);
  backup=addReview(backup,createReview(backup,retired.questionId,'again',retired.attemptId,retired.answeredAt));
  const imported=parseImport(JSON.stringify(backup),c),before=JSON.stringify(imported),preview=previewImport(imported,imported,c);
  expect(JSON.stringify(imported)).toBe(before);expect(preview.merged.reviewEvents).toEqual(imported.reviewEvents);expect(preview.duplicates).toBe(4);
  const d=recordAnswer(imported,answer(2,start+1000));expect(d.reviewEvents).toEqual(imported.reviewEvents);expect(imported.schemaVersion).toBe(1);
  expect(archiveDetails(d,c).attemptCount).toBe(1);expect(dueQuestions(d,[q],start+day)).toEqual([]);
  expect(recordAnswer(d,answer(3,start+30*day)).reviewEvents.at(-1)?.intervalDays).toBe(30);
 });
 it('旧 revision 的计划不控制新版首次正确，新旧事件 ID 均保留',()=>{
  const old=recordAnswer(study(),{...answer(1),questionRevision:q.revision+1});
  const imported=parseImport(JSON.stringify(old),c),d=recordAnswer(imported,answer(2,start+1000));
  expect(d.reviewEvents.slice(0,1)).toEqual(imported.reviewEvents);expect(d.reviewEvents.at(-1)?.intervalDays).toBe(1);
 });
 it('重复未到期提交不增加作答或复习，UTC 偏移与档案时区不改变到期规则',()=>{
  let d=recordAnswer(study(),answer(1));d.profile.timeZone='America/New_York';
  const a={...answer(2,start+day),answeredAt:'2026-10-15T08:00:00+08:00'};d=recordAnswer(d,a);
  expect(d.reviewEvents.at(-1)?.nextDueAt).toBe(new Date(start+4*day).toISOString());expect(recordAnswer(d,a)).toEqual(d);
  const early=answer(3,start+day+1000);d=recordAnswer(d,early);expect(recordAnswer(d,early)).toEqual(d);expect(d.reviewEvents).toHaveLength(2);
 });
 it('已存在的手动作答不被自动补写，首次答对无计划的旧历史只安排一天',()=>{
  const a=answer(1),manual=createReview(study(),q.id,'easy',a.attemptId,a.answeredAt);
  const d=addReview(recordAttempt(study(),a),manual);expect(recordAnswer(d,a)).toEqual(d);
  let history=study();for(let i=1;i<=5;i++)history=recordAttempt(history,answer(i,start+i*1000));
  expect(recordAnswer(history,answer(6,start+day)).reviewEvents[0].intervalDays).toBe(1);
 });
});
