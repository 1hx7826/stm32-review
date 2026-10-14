import 'fake-indexeddb/auto';
import {beforeEach,describe,it,expect,vi} from 'vitest';
import raw from '../src/generated/content.json';
import type {Attempt,Content} from '../src/model';
import {recordAnswer} from '../src/domain';
import {parseImport} from '../src/validation';
import {closeDatabase,DB_NAME,loadStudy,mutateStudy,latestBackup} from '../src/storage';
const c=raw as unknown as Content,q=c.questions.find(q=>q.type==='single_choice')!;
const a:Attempt={attemptId:'att.00000000-0000-4000-8000-000000000001',questionId:q.id,questionRevision:q.revision,answeredAt:'2026-10-14T00:00:00Z',mode:'practice',response:{kind:'options',optionIds:[q.answer.optionId!]},grading:{kind:'objective',isCorrect:true},durationMs:50};
beforeEach(async()=>{vi.restoreAllMocks();closeDatabase();await new Promise<void>((resolve,reject)=>{const r=indexedDB.deleteDatabase(DB_NAME);r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error);});});
describe('Phase 2.5 原数据库事务回归',()=>{
 it('旧数据直接读取，不升级数据库或篡改历史事件',async()=>{await loadStudy(c.version);await mutateStudy(c.version,d=>({...d,attempts:[a]}));closeDatabase();const loaded=await loadStudy(c.version);expect(loaded.data.schemaVersion).toBe(1);expect(loaded.data.attempts).toEqual([a]);expect(loaded.data.reviewEvents).toEqual([]);});
 it('保存失败时作答和计划都回滚；同一操作重试后只保存一次',async()=>{const before=await loadStudy(c.version);const put=vi.spyOn(IDBObjectStore.prototype,'put').mockImplementation(()=>{throw new DOMException('quota','QuotaExceededError');});await expect(mutateStudy(c.version,d=>recordAnswer(d,a))).rejects.toThrow('quota');put.mockRestore();expect(await loadStudy(c.version)).toEqual(before);await mutateStudy(c.version,d=>recordAnswer(d,a));await mutateStudy(c.version,d=>recordAnswer(d,a));const n=await loadStudy(c.version);expect(n.data.attempts).toHaveLength(1);expect(n.data.reviewEvents).toHaveLength(1);closeDatabase();expect((await loadStudy(c.version)).data.reviewEvents).toEqual(n.data.reviewEvents);});
 it('归档确认替换与备份同事务，失败不破坏原数据，成功后可导出恢复',async()=>{const original=await loadStudy(c.version);await mutateStudy(c.version,d=>recordAnswer(d,a));const d={...original.data,attempts:[{...a,questionId:'q.retired.usart.original'}]};const incoming=parseImport(JSON.stringify(d),c),before=await loadStudy(c.version);await expect(mutateStudy(c.version,()=>{throw new Error('archive import failed');},{backup:true,expectedRevision:before.revision})).rejects.toThrow('failed');expect(await loadStudy(c.version)).toEqual(before);expect(await latestBackup()).toBeNull();await mutateStudy(c.version,()=>incoming,{backup:true,expectedRevision:before.revision});expect(await latestBackup()).toEqual(before.data);const n=(await loadStudy(c.version)).data;expect(parseImport(JSON.stringify(n),c)).toEqual(n);});
});
