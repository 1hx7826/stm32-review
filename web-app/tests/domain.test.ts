import {describe,it,expect} from 'vitest';
import raw from '../src/generated/content.json';
import {emptyStudy,type Attempt,type Content,type Question,type StudyData} from '../src/model';
import {addReview,createReview,dueQuestions,grade,isPublished,recordAttempt,stats} from '../src/domain';
import {parseImport,previewImport} from '../src/validation';
const c=raw as unknown as Content;
const q=c.questions.find(x=>x.type==='single_choice')!;
function attempt(correct=true):Attempt{return {attemptId:'att.00000000-0000-4000-8000-000000000001',questionId:q.id,questionRevision:1,answeredAt:'2026-10-14T00:00:00.000Z',mode:'practice',response:{kind:'options',optionIds:[correct?q.answer.optionId!:q.payload.options!.find(o=>o.id!==q.answer.optionId)!.id]},grading:{kind:'objective',isCorrect:correct},durationMs:50};}
function study(){return emptyStudy(c.version);}
describe('稳定 ID 与真实统计',()=>{
 it('按选项 ID 评分，打乱展示顺序不改变结果',()=>{const reordered={...q,payload:{options:[...q.payload.options!].reverse()}};expect(grade(reordered,{kind:'options',optionIds:[q.answer.optionId!]}).isCorrect).toBe(true);});
 it('答错开启错题，答对保留错误历史',()=>{let d=recordAttempt(study(),attempt(false));d=recordAttempt(d,{...attempt(),attemptId:'att.00000000-0000-4000-8000-000000000002'});expect(d.wrongQuestionStates[0].state).toBe('open');expect(stats(d)).toMatchObject({total:2,correct:1,accuracy:50});});
 it('相同提交 ID 重试不重复计数',()=>{const d=recordAttempt(recordAttempt(study(),attempt()),attempt());expect(d.attempts).toHaveLength(1);});
 it('非法选项 ID 拒绝评分',()=>expect(()=>grade(q,{kind:'options',optionIds:['missing']})).toThrow('选项'));
 it('判断题正确与错误均能评分',()=>{const t=c.questions.find(x=>x.type==='true_false')!;expect(grade(t,{kind:'boolean',value:t.answer.value!}).isCorrect).toBe(true);expect(grade(t,{kind:'boolean',value:!t.answer.value}).isCorrect).toBe(false);});
 it('记忆卡不进入客观正确率',()=>{const card=c.questions.find(x=>x.type==='flashcard')!;const a={...attempt(),questionId:card.id,response:{kind:'self_rating' as const,rating:'good' as const},grading:grade(card,{kind:'self_rating',rating:'good'})};expect(stats(recordAttempt(study(),a))).toMatchObject({total:0,accuracy:null,cards:1});});
 it('空记录不虚构已学习章节或成绩',()=>{expect(study().chapterStates).toEqual([]);expect(stats(study()).accuracy).toBeNull();});
});
describe('复习发布门槛',()=>{
 it('未发布的设计示例与待核验题不会进入每日复习',()=>{const draft={...q,publicationStatus:'design_example'},pending={...q,verification:{...q.verification,answer:'pending'}};expect(isPublished(draft)).toBe(false);expect(isPublished(pending)).toBe(false);const d=study();d.wrongQuestionStates=[{questionId:draft.id,state:'open',updatedAt:'2026-10-14T00:00:00Z',resolvedAt:null,note:''}];expect(dueQuestions(d,[draft,pending])).toEqual([]);});
 it('复习从真实记录安排，again 为 10 分钟',()=>{const d=study();const e=createReview(d,q.id,'again',null,'2026-10-14T00:00:00Z');expect(e.nextDueAt).toBe('2026-10-14T00:10:00.000Z');expect(dueQuestions(addReview(d,e),[q],Date.parse('2026-10-14T00:09:00Z'))).toEqual([]);expect(dueQuestions(addReview(d,e),[q],Date.parse(e.nextDueAt))).toHaveLength(1);});
 it('复习事件相同 ID 仅保存一次',()=>{const e=createReview(study(),q.id,'good',null);expect(addReview(addReview(study(),e),e).reviewEvents).toHaveLength(1);});
});
describe('导入校验、预览与冲突',()=>{
 it('导出后导入保留有效记录',()=>{const d=recordAttempt(study(),attempt());expect(parseImport(JSON.stringify(d),c).attempts[0].response).toEqual(d.attempts[0].response);});
 it('不信任导入的正确性标记，会重新评分',()=>{const d=recordAttempt(study(),attempt(false));d.attempts[0].grading.isCorrect=true;expect(parseImport(JSON.stringify(d),c).attempts[0].grading.isCorrect).toBe(false);});
 it('错误 JSON、未来格式与非法题目 ID 均拒绝',()=>{expect(()=>parseImport('{oops',c)).toThrow('JSON');expect(()=>parseImport(JSON.stringify({...study(),schemaVersion:99}),c)).toThrow('格式');const d=recordAttempt(study(),{...attempt(),questionId:'q.UNKNOWN.invalid'});expect(()=>parseImport(JSON.stringify(d),c)).toThrow('格式');});
 it('未知知识点、章节、非法时区均拒绝',()=>{const d=study();d.knowledgeStates=[{knowledgePointId:'kp.unknown.example',familiarity:'new',origin:'user',updatedAt:'2026-10-14T00:00:00Z'}];expect(()=>parseImport(JSON.stringify(d),c)).toThrow('未知知识点');d.knowledgeStates=[];d.chapterStates=[{chapterId:'ch.missing',status:'learned',origin:'user',updatedAt:'2026-10-14T00:00:00Z'}];expect(()=>parseImport(JSON.stringify(d),c)).toThrow('未知章节');d.chapterStates=[];d.profile.timeZone='Moon/Crater';expect(()=>parseImport(JSON.stringify(d),c)).toThrow('时区');});
 it('拒绝危险键和重复事件 ID',()=>{const d=recordAttempt(study(),attempt());d.attempts.push(attempt());expect(()=>parseImport(JSON.stringify(d),c)).toThrow('重复');expect(()=>parseImport('{"__proto__":{}}',c)).toThrow('不允许');});
 it('拒绝无效选项、事件前缀及复习引用',()=>{let d=recordAttempt(study(),{...attempt(),response:{kind:'options',optionIds:['bogus']}});expect(()=>parseImport(JSON.stringify(d),c)).toThrow('选项');d=recordAttempt(study(),{...attempt(),attemptId:'rev.00000000-0000-4000-8000-000000000001'});expect(()=>parseImport(JSON.stringify(d),c)).toThrow('前缀');d=study();d.reviewEvents=[createReview(d,q.id,'good','att.00000000-0000-4000-8000-000000000001')];expect(()=>parseImport(JSON.stringify(d),c)).toThrow('引用');});
 it('未知历史 revision 保留但不计正确率',()=>{const d=recordAttempt(study(),{...attempt(),questionRevision:99});expect(parseImport(JSON.stringify(d),c).attempts[0].grading.kind).toBe('ungraded');});
 it('重复导入按事件 ID 去重，预览不修改原数据',()=>{const d=recordAttempt(study(),attempt());const before=JSON.stringify(d);const preview=previewImport(d,d,c);expect(preview.duplicates).toBe(1);expect(preview.merged.attempts).toHaveLength(1);expect(JSON.stringify(d)).toBe(before);});
 it('相同事件 ID 不同内容保留现有，并显示冲突',()=>{const current=recordAttempt(study(),attempt()),incoming=recordAttempt(study(),attempt(false));const p=previewImport(current,incoming,c);expect(p.conflicts).toBeGreaterThan(0);expect(p.merged.attempts[0].grading.isCorrect).toBe(true);});
 it('导入缺少错题派生状态时仍恢复真实错误',()=>{const d=recordAttempt(study(),attempt(false));d.wrongQuestionStates=[];expect(parseImport(JSON.stringify(d),c).wrongQuestionStates).toHaveLength(1);});
 it('删除标记在替换前同样生效，不能复活已删事件',()=>{const d=recordAttempt(study(),attempt(false));d.tombstones=[{deletionId:'del.00000000-0000-4000-8000-000000000003',targetKind:'attempt',targetId:d.attempts[0].attemptId,deletedAt:'2026-10-14T01:00:00Z'}];const n=parseImport(JSON.stringify(d),c);expect(n.attempts).toEqual([]);expect(n.wrongQuestionStates).toEqual([]);});
});
