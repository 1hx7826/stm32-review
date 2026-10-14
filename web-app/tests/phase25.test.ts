import {afterEach,describe,it,expect,vi} from 'vitest';
import raw from '../src/generated/content.json';
import {emptyStudy,uid,type Attempt,type Content} from '../src/model';
import {addReview,createReview,dueQuestions,recordAnswer,recordAttempt,stats} from '../src/domain';
import {parseImport,previewImport} from '../src/validation';
import {archiveDetails} from '../src/history';
const c=raw as unknown as Content,q=c.questions.find(q=>q.type==='single_choice')!;
const nativeCrypto=globalThis.crypto;
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
const study=()=>emptyStudy(c.version);
function answer(correct:boolean,index=1,at='2026-10-14T00:00:00.000Z'):Attempt {
 return {attemptId:`att.00000000-0000-4000-8000-${String(index).padStart(12,'0')}`,questionId:q.id,questionRevision:q.revision,answeredAt:at,mode:'practice',response:{kind:'options',optionIds:[correct?q.answer.optionId!:q.payload.options!.find(o=>o.id!==q.answer.optionId)!.id]},grading:{kind:'objective',isCorrect:correct},durationMs:50};
}
describe('A：兼容安全随机数与旧 ID 格式',()=>{
 it('优先使用可用 randomUUID，保持现有前缀',()=>{const randomUUID=vi.fn(()=> '12345678-1234-4123-8123-123456789abc'),getRandomValues=vi.fn();expect(uid('att',{randomUUID,getRandomValues})).toBe('att.12345678-1234-4123-8123-123456789abc');expect(getRandomValues).not.toHaveBeenCalled();});
 it('randomUUID 不存在时使用安全随机数生成 UUID v4',()=>{const getRandomValues=vi.fn((b:Uint8Array)=>{b.fill(255);return b;});expect(uid('rev',{getRandomValues})).toBe('rev.ffffffff-ffff-4fff-bfff-ffffffffffff');expect(getRandomValues).toHaveBeenCalledOnce();});
 it('暴露但无法调用的 randomUUID 也回退到安全随机数',()=>expect(uid('del',{randomUUID:()=>{throw new Error('unavailable');},getRandomValues:b=>{b.fill(0);return b;}})).toBe('del.00000000-0000-4000-8000-000000000000'));
 it('必要随机数 API 缺失明确抛错，不生成弱 ID',()=>{expect(()=>uid('att',{})).toThrow('安全随机数');vi.stubGlobal('crypto',undefined);expect(()=>emptyStudy(c.version)).toThrow('安全随机数');});
 it('随机数接口调用失败明确报错',()=>expect(()=>uid('att',{getRandomValues:()=>{throw new Error('denied');}})).toThrow('调用失败'));
 it('HTTP 兼容分支生成的档案/事件符合原 v1 Schema 并可导入',()=>{vi.stubGlobal('crypto',{getRandomValues:nativeCrypto.getRandomValues.bind(nativeCrypto)});const d=study();const a={...answer(true),attemptId:uid('att')};const n=recordAnswer(d,a);expect(parseImport(JSON.stringify(n),c).attempts).toHaveLength(1);expect(n.reviewEvents[0].reviewEventId).toMatch(/^rev\.[a-f0-9-]{36}$/);});
 it('安全随机分支不使用 Math.random 或单独时间戳，样本 ID 均独立',()=>{vi.spyOn(Math,'random').mockImplementation(()=>{throw new Error('weak random');});const source={getRandomValues:nativeCrypto.getRandomValues.bind(nativeCrypto)};const ids=Array.from({length:200},()=>uid('att',source));expect(new Set(ids).size).toBe(200);expect(ids.every(id=>/^att\.[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id))).toBe(true);});
});
describe('B：正式提交自动复习与自评调整',()=>{
 it('首次正确自动安排 1 天，未自评也有计划',()=>{const d=recordAnswer(study(),answer(true));expect(d.attempts).toHaveLength(1);expect(d.reviewEvents[0]).toMatchObject({intervalDays:1,nextDueAt:'2026-10-15T00:00:00.000Z'});expect(dueQuestions(d,[q],Date.parse('2026-10-15T00:00:00Z'))).toHaveLength(1);});
 it('首次错误优先在 10 分钟复习',()=>{const d=recordAnswer(study(),answer(false));expect(d.reviewEvents[0]).toMatchObject({intervalDays:0,nextDueAt:'2026-10-14T00:10:00.000Z'});expect(d.wrongQuestionStates[0].state).toBe('open');});
 it('连续到期正确以 1/3/7/14/30 天逐步延长并封顶',()=>{let d=study(),at='2026-10-14T00:00:00Z';for(let i=1;i<=6;i++){d=recordAnswer(d,answer(true,i,at));at=d.reviewEvents.at(-1)!.nextDueAt;}expect(d.reviewEvents.map(e=>e.intervalDays)).toEqual([1,3,7,14,30,30]);expect(d.chapterStates).toEqual([]);expect(d.questionStates).toEqual([]);});
 it('连续错误不延长间隔，之后到期正确重置为 1 天',()=>{let d=recordAnswer(study(),answer(false,1));d=recordAnswer(d,answer(false,2,'2026-10-14T00:01:00Z'));d=recordAnswer(d,answer(true,3,'2026-10-14T00:11:00Z'));expect(d.reviewEvents.map(e=>e.intervalDays)).toEqual([0,0,1]);});
 it('每个题目独立安排，不改变历史 ID',()=>{const a=answer(true),b={...answer(false,2,'2026-10-14T00:01:00Z'),questionId:c.questions.find(x=>x.type==='true_false')!.id};const d=recordAnswer(recordAnswer(study(),a),b);expect(d.attempts.map(a=>a.attemptId)).toEqual([a.attemptId,b.attemptId]);expect(d.reviewEvents.map(e=>e.questionId)).toEqual([a.questionId,b.questionId]);});
 it('手动再学/困难/掌握/熟练可调整同次默认计划',()=>{const a=answer(true),d=recordAnswer(study(),a);expect(['again','hard','good','easy'].map(r=>createReview(d,q.id,r as 'again'|'hard'|'good'|'easy',a.attemptId,'2026-10-14T00:01:00Z').intervalDays)).toEqual([0,1,1,3]);});
 it('重复提交及失败后的同 ID 重试不重复生成事件',()=>{const a=answer(true),d=recordAnswer(study(),a);expect(recordAnswer(d,a)).toEqual(d);expect(d.reviewEvents[0].reviewEventId).toBe(a.attemptId.replace(/^att\./,'rev.'));});
 it('手动调整优先于同一时刻默认计划，不提前重复到期',()=>{const a=answer(false),d=recordAnswer(study(),a),manual=createReview(d,q.id,'easy',a.attemptId,a.answeredAt);const n=addReview(d,manual);expect(dueQuestions(n,[q],Date.parse('2026-10-14T00:11:00Z'))).toEqual([]);});
 it('ISO 时间按毫秒计算，修改时区不改变到期时间',()=>{const d=recordAnswer(study(),answer(true));d.profile.timeZone='America/New_York';expect(d.reviewEvents[0].nextDueAt).toBe('2026-10-15T00:00:00.000Z');expect(dueQuestions(d,[q],Date.parse('2026-10-14T23:59:59Z'))).toEqual([]);});
 it('翻卡自评不伪造客观默认计划',()=>{const a={...answer(true),grading:{kind:'self_rated' as const,isCorrect:null}};expect(recordAnswer(study(),a).reviewEvents).toEqual([]);});
});
describe('C：历史归档与严格合法性校验',()=>{
 const retired='q.retired.gpio.original';
 const backup=()=>recordAttempt(study(),{...answer(false),questionId:retired});
 it('Phase 2 格式 v1 的有效备份仍可读取',()=>{const d=recordAttempt(study(),answer(true));expect(parseImport(JSON.stringify(d),c)).toMatchObject({schemaVersion:1,contentVersion:'0.2.0'});});
 it('结构合法的未知/退役记录及错题状态保留为未评分归档',()=>{const d=parseImport(JSON.stringify(backup()),c);expect(d.attempts[0].questionId).toBe(retired);expect(d.attempts[0].grading).toEqual({kind:'ungraded',isCorrect:null});expect(d.wrongQuestionStates).toHaveLength(1);expect(archiveDetails(d,c).attemptCount).toBe(1);expect(stats(d,c.questions).total).toBe(0);expect(dueQuestions(d,c.questions)).toEqual([]);});
 it('归档复习事件、题目熟悉度及稳定 ID 不丢失',()=>{const d=backup();d.reviewEvents=[createReview(d,retired,'good',d.attempts[0].attemptId,'2026-10-14T00:01:00Z')];d.questionStates=[{questionId:retired,familiarity:'familiar',updatedAt:'2026-10-14T00:01:00Z',origin:'user',bookmarked:true}];const n=parseImport(JSON.stringify(d),c);expect(n.reviewEvents[0].reviewEventId).toBe(d.reviewEvents[0].reviewEventId);expect(n.questionStates).toEqual(d.questionStates);expect(archiveDetails(n,c).reviewCount).toBe(1);});
 it('只有状态没有作答的合法历史条目也不静默删除',()=>{const d=study();d.wrongQuestionStates=backup().wrongQuestionStates;const n=parseImport(JSON.stringify(d),c);expect(n.wrongQuestionStates).toHaveLength(1);expect(archiveDetails(n,c).questionIds).toEqual([retired]);});
 it('当前题旧 revision 归档，旧事件不触发当前正式练习',()=>{const d=recordAnswer(study(),{...answer(false),questionRevision:99});const n=parseImport(JSON.stringify(d),c);expect(n.attempts[0].grading.kind).toBe('ungraded');expect(dueQuestions(n,[q],Date.parse('2026-11-01T00:00:00Z'))).toEqual([]);});
 it('归档后再次导出导入恢复同样事件与原答案响应',()=>{const d=parseImport(JSON.stringify(backup()),c),n=parseImport(JSON.stringify(d),c);expect(n).toEqual(d);});
 it('损坏 JSON、非法 Schema 版本、危险字段继续拒绝',()=>{expect(()=>parseImport('{bad',c)).toThrow();expect(()=>parseImport(JSON.stringify({...backup(),schemaVersion:2}),c)).toThrow('格式');expect(()=>parseImport('{"constructor":{}}',c)).toThrow('不允许');});
 it('归档也拒绝重复事件/状态 ID，不能降低校验',()=>{const d=backup();d.attempts.push({...d.attempts[0]});expect(()=>parseImport(JSON.stringify(d),c)).toThrow('重复');});
 it('未知题记录的非法事件前缀、异常答案 token 和无效引用仍拒绝',()=>{const d=backup();d.attempts[0].attemptId=d.attempts[0].attemptId.replace(/^att\./,'rev.');expect(()=>parseImport(JSON.stringify(d),c)).toThrow('前缀');d.attempts[0]= {...answer(false),questionId:retired,response:{kind:'options',optionIds:['<script>']}};expect(()=>parseImport(JSON.stringify(d),c)).toThrow('格式无效');d.attempts[0]={...answer(false),questionId:retired};d.reviewEvents=[createReview(d,retired,'good','att.00000000-0000-4000-8000-000000000009','2026-10-14T00:01:00Z')];expect(()=>parseImport(JSON.stringify(d),c)).toThrow('引用');});
 it('合法未知匹配/排序响应只能归档，重复匹配引用拒绝',()=>{const d=backup();d.attempts[0].response={kind:'matching',pairs:[{leftId:'a',rightId:'1'},{leftId:'b',rightId:'2'}]};expect(parseImport(JSON.stringify(d),c).attempts[0].grading.kind).toBe('ungraded');d.attempts[0].response.pairs[1].leftId='a';expect(()=>parseImport(JSON.stringify(d),c)).toThrow('重复');});
 it('预览揭示归档、冲突和替换范围，而且不修改输入',()=>{const current=recordAttempt(study(),answer(true)),incoming=parseImport(JSON.stringify(backup()),c),before=JSON.stringify(current),p=previewImport(current,incoming,c);expect(p.archived.questionIds).toEqual([retired]);expect(p.archived.attemptCount).toBe(1);expect(p.conflicts).toBeGreaterThan(0);expect(p.replacement.attempts).toBe(1);expect(JSON.stringify(current)).toBe(before);});
 it('合并重复归档事件去重并保留历史错题状态',()=>{const d=parseImport(JSON.stringify(backup()),c),p=previewImport(d,d,c);expect(p.duplicates).toBe(1);expect(p.merged.attempts).toHaveLength(1);expect(p.merged.wrongQuestionStates).toHaveLength(1);});
 it('当前未知章节/知识点不因历史兼容而放宽',()=>{const d=backup();d.chapterStates=[{chapterId:'ch.unknown',status:'learned',updatedAt:'2026-10-14T00:01:00Z',origin:'user'}];expect(()=>parseImport(JSON.stringify(d),c)).toThrow('未知章节');});
});
