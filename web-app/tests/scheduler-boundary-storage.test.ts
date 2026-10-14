import 'fake-indexeddb/auto';
import {legacyV1Fixture} from './fixtures/legacy-v1';
import {beforeEach,describe,it,expect,vi} from 'vitest';
import raw from '../src/generated/content.json';
import type {Attempt,Content,StudyData} from '../src/model';
import {addReview,createReview,dueQuestions,recordAnswer,recordAttempt} from '../src/domain';
import {parseImport,previewImport} from '../src/validation';
import {closeDatabase,database,DB_NAME,loadStudy,mutateStudy,latestBackup} from '../src/storage';

const c=raw as unknown as Content,q=c.questions.find(q=>q.type==='single_choice')!;
const start=Date.parse('2026-10-14T00:00:00Z'),day=86400000;
function answer(index:number,at=start):Attempt {
 return {attemptId:`att.20000000-0000-4000-8000-${String(index).padStart(12,'0')}`,questionId:q.id,questionRevision:q.revision,answeredAt:new Date(at).toISOString(),mode:'practice',response:{kind:'options',optionIds:[q.answer.optionId!]},grading:{kind:'objective',isCorrect:true},durationMs:50};
}
beforeEach(async()=>{vi.restoreAllMocks();closeDatabase();await new Promise<void>((resolve,reject)=>{const r=indexedDB.deleteDatabase(DB_NAME);r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error);});});
const failWrites=()=>vi.spyOn(IDBObjectStore.prototype,'put').mockImplementation(()=>{throw new DOMException('quota','QuotaExceededError');});

describe('到期边界的原子保存与 v1 兼容',()=>{
 it('到期进阶写入失败整笔回滚，同 ID 重试和重开只保留一个新计划',async()=>{
  await mutateStudy(c.version,d=>recordAnswer(d,answer(1)));const before=await loadStudy(c.version),a=answer(2,start+day);
  const put=failWrites();await expect(mutateStudy(c.version,d=>recordAnswer(d,a))).rejects.toThrow('quota');put.mockRestore();
  expect(await loadStudy(c.version)).toEqual(before);
  await mutateStudy(c.version,d=>recordAnswer(d,a));await mutateStudy(c.version,d=>recordAnswer(d,a));closeDatabase();
  const restored=await loadStudy(c.version);expect(restored.data.attempts).toHaveLength(2);expect(restored.data.reviewEvents.map(e=>e.intervalDays)).toEqual([1,3]);
 });
 it('未到期练习保存失败后重试，只增加作答，旧复习事件字节内容不变',async()=>{
  await mutateStudy(c.version,d=>recordAnswer(d,answer(1)));const before=await loadStudy(c.version),a=answer(2,start+1000);
  const put=failWrites();await expect(mutateStudy(c.version,d=>recordAnswer(d,a))).rejects.toThrow('quota');put.mockRestore();expect(await loadStudy(c.version)).toEqual(before);
  await mutateStudy(c.version,d=>recordAnswer(d,a));await mutateStudy(c.version,d=>recordAnswer(d,a));const restored=await loadStudy(c.version);
  expect(restored.data.attempts).toHaveLength(2);expect(restored.data.reviewEvents).toEqual(before.data.reviewEvents);
 });
 it('失败队列中的自动提交和同次手动评价原子重放，重复重试不覆盖用户选择',async()=>{
  const before=await loadStudy(c.version),a=answer(1),manual=createReview(recordAnswer(before.data,a),q.id,'easy',a.attemptId,a.answeredAt);
  const operations=[(d:StudyData)=>recordAnswer(d,a),(d:StudyData)=>addReview(recordAttempt(d,a),manual)];
  const retry=(d:StudyData)=>operations.reduce((n,op)=>op(n),d);
  const put=failWrites();await expect(mutateStudy(c.version,retry)).rejects.toThrow('quota');put.mockRestore();expect(await loadStudy(c.version)).toEqual(before);
  await mutateStudy(c.version,retry);await mutateStudy(c.version,retry);closeDatabase();const restored=await loadStudy(c.version);
  expect(restored.data.attempts).toHaveLength(1);expect(restored.data.reviewEvents).toHaveLength(2);expect(restored.data.reviewEvents.at(-1)).toEqual(manual);
  expect(dueQuestions(restored.data,[q],start+day)).toEqual([]);expect(dueQuestions(restored.data,[q],start+3*day)).toEqual([q]);
 });
 it('并行快速提交读取事务内的最新计划，不生成两份有效自动安排',async()=>{
  await Promise.all([mutateStudy(c.version,d=>recordAnswer(d,answer(1))),mutateStudy(c.version,d=>recordAnswer(d,answer(2,start+1000)))]);
  const d=(await loadStudy(c.version)).data;expect(d.attempts).toHaveLength(2);expect(d.reviewEvents).toHaveLength(1);expect(d.reviewEvents[0].intervalDays).toBe(1);
 });
 it('固定合成 Phase 2 v1 备份可预览取消、确认替换、往返导出并去重，不补写旧计划',async()=>{
  const legacy=parseImport(JSON.stringify(legacyV1Fixture(c)),c);
  await mutateStudy(c.version,d=>recordAnswer(d,answer(1)));const before=await loadStudy(c.version),preview=previewImport(before.data,legacy,c);
  expect(preview.replacement.attempts).toBe(1);expect(await loadStudy(c.version)).toEqual(before); // 仅预览/取消不调用写入。
  await mutateStudy(c.version,()=>legacy,{backup:true,expectedRevision:before.revision});closeDatabase();const restored=await loadStudy(c.version);
  expect(restored.data).toEqual(legacy);expect(restored.data.schemaVersion).toBe(1);expect((await database()).version).toBe(1);expect(await latestBackup()).toEqual(before.data);
  const incoming=parseImport(JSON.stringify(restored.data),c),p=previewImport(restored.data,incoming,c);
  expect(p.merged.attempts).toEqual(restored.data.attempts);expect(p.merged.reviewEvents).toEqual(restored.data.reviewEvents);
  expect(restored.data.attempts).toHaveLength(3);expect(restored.data.reviewEvents).toHaveLength(2);
 });
});
