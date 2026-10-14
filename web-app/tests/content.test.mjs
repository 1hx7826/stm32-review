import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {questionValidator} from '../scripts/content-validation.mjs';
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
const schema=read('../../content/schemas/question.schema.json'),content=read('../src/generated/content.json');
const ids={chapters:new Set(content.chapters.map(c=>c.id)),points:new Set(content.chapters.flatMap(c=>c.knowledgePoints.map(p=>p.id))),functions:new Set(content.functions.map(f=>f.id))};
const validate=questionValidator(schema),q=content.questions.find(q=>q.type==='single_choice');
describe('Schema 外的发布审查',()=>{
 it('32 题/卡均符合原 Schema，历史设计示例保持未发布',()=>{for(const x of [...content.questions,...content.historyQuestions])expect(validate(x,ids)).toBe(true);expect(content.historyQuestions.every(q=>q.publicationStatus==='design_example')).toBe(true);});
 it('Schema 之外拒绝选项 ID 重复',()=>{const x=structuredClone(q);x.payload.options[1].id=x.payload.options[0].id;expect(()=>validate(x,ids)).toThrow('选项 ID 重复');});
 it('Schema 之外拒绝不存在的答案引用',()=>{const x=structuredClone(q);x.answer.optionId='missing';expect(()=>validate(x,ids)).toThrow('答案引用');});
 it('未经核验的题目无法发布',()=>{const x=structuredClone(q);x.verification.answer='pending';expect(()=>validate(x,ids)).toThrow();});
 it('已核查原理与待核验代码分别标记',()=>{expect(content.lessons).toHaveLength(16);for(const l of content.lessons){expect(l.conceptVerification).toBe('official_checked');expect(l.example.status).toBe('pending');expect(l.example.publicationStatus).toBe('draft');}expect(content.functions.every(f=>f.verification.officialPackage==='pending')).toBe(true);});
});
