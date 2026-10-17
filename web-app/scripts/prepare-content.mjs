import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {questionValidator} from './content-validation.mjs';
const root=new URL('../../',import.meta.url);
const read=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
const [catalog,index,lessons,questions,legacy,sources,qSchema,studySchema]=await Promise.all(['catalog','functions','lessons','questions','legacy-ids','source-register'].map(p=>read('content/course/'+p+'.json')).concat([read('content/schemas/question.schema.json'),read('content/schemas/study-export.schema.json')]));
const chapters=catalog.chapters;
const ids={chapters:new Set(chapters.map(x=>x.id)),points:new Set(chapters.flatMap(x=>x.knowledgePoints.map(p=>p.id))),functions:new Set(index.functions.map(x=>x.id))};
if(chapters.length!==10||ids.chapters.size!==10||ids.points.size!==54)throw new Error('课程章节数量或ID不完整');
const expected=[3,5,7,8,8,3,2,2,10,6].flatMap((count,i)=>Array.from({length:count},(_,j)=>`${i+1}.${j+1}`));
if(JSON.stringify(chapters.flatMap(c=>c.knowledgePoints.map(p=>p.number)))!==JSON.stringify(expected))throw new Error('课程数字顺序错误');
const validate=questionValidator(qSchema),seen=new Set();
for(const q of questions){if(seen.has(q.id))throw new Error('题目ID重复');seen.add(q.id);validate(q,ids);}
const lessonIds=new Set();
for(const l of lessons){
 if(!ids.points.has(l.knowledgePointId)||lessonIds.has(l.knowledgePointId))throw new Error('讲解ID无效');lessonIds.add(l.knowledgePointId);
 if(l.conceptVerification!=='source_checked'||!l.sources.some(s=>s.status==='source_checked'))throw new Error('课程来源缺失');
 if(!l.steps.length||!l.sections.length||l.steps.some(s=>!s.action||!s.why||!s.expect))throw new Error('逐步解释缺失');
 for(const id of [...l.functionIds,...l.steps.flatMap(s=>s.functionIds),...l.sections.flatMap(s=>s.functionIds)])if(!ids.functions.has(id))throw new Error('函数引用无效');
 if(l.example.status==='pending'&&l.example.publicationStatus!=='draft')throw new Error('待验证代码误发布');
 if(!sources.lessons.some(s=>s.number===l.number))throw new Error('来源清单缺失');
}
if(lessonIds.size!==54||questions.length!==108)throw new Error('课程/题卡不完整');
for(const f of index.functions)if(!f.prototype.includes(f.name+'(')||f.verification.officialPackage!=='pending'||f.knowledgePointIds.some(p=>!ids.points.has(p)))throw new Error('函数声明或关联错误');
const output=new URL('../src/generated/',import.meta.url);await mkdir(output,{recursive:true});
await writeFile(new URL('content.json',output),JSON.stringify({version:catalog.version,chapters,functions:index.functions,structures:index.structures,lessons,questions,historyQuestions:[],legacyChapterIds:legacy.chapterIds,legacyKnowledgePointIds:legacy.knowledgePointIds,courseSources:sources.lessons}));
await writeFile(new URL('study-schema.json',output),JSON.stringify(studySchema));
console.log(`课程校验通过：10章 / 54节 / ${index.functions.length}函数 / 54检查题 / 54记忆卡；原题库未载入。`);
