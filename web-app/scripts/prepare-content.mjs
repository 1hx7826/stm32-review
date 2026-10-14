import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {questionValidator} from './content-validation.mjs';
const root=new URL('../../',import.meta.url);
const read=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
const catalog=await read('content/knowledge-catalog.json'),index=await read('content/function-index.json'),lessons=await read('content/phase2/lessons.json'),questions=await read('content/phase2/questions.json'),history=await read('content/examples/questions.example.json'),qSchema=await read('content/schemas/question.schema.json'),studySchema=await read('content/schemas/study-export.schema.json');
const ids={chapters:new Set(catalog.chapters.map(x=>x.id)),points:new Set(catalog.chapters.flatMap(x=>x.knowledgePoints.map(p=>p.id))),functions:new Set(index.functions.map(x=>x.id))};
if(ids.chapters.size!==11||ids.points.size!==88||ids.functions.size!==124)throw new Error('第一阶段目录数量或 ID 被意外改变');
const validate=questionValidator(qSchema);const seen=new Set();for(const q of [...questions,...history]){if(seen.has(q.id))throw new Error('题目 ID 重复');seen.add(q.id);validate(q,ids);}
const seenLessons=new Set();for(const l of lessons){if(!ids.points.has(l.knowledgePointId)||seenLessons.has(l.knowledgePointId))throw new Error('讲解 ID 无效');seenLessons.add(l.knowledgePointId);if(l.conceptVerification!=='official_checked'||!l.sources.some(s=>s.status==='official_checked'))throw new Error('原理讲解未核验');if(l.functionIds.some(id=>!ids.functions.has(id)))throw new Error('函数引用无效');if(l.example.status==='pending'&&l.example.publicationStatus!=='draft')throw new Error('未核验代码被错误发布');}
const publicFunctions=index.functions.map(f=>({id:f.id,name:f.name,peripheral:f.peripheral,prototype:f.prototype,purpose:f.purpose,parameters:f.parameters,returnValue:f.returnValue,flowPosition:f.flowPosition,example:f.example,prerequisitesAndCommonErrors:f.prerequisitesAndCommonErrors,knowledgePointIds:f.knowledgePointIds,applicability:{scope:f.applicability.scope},verification:{declaration:f.verification.declaration,officialPackage:f.verification.officialPackage,hardwareDetails:f.verification.hardwareDetails,exampleCompilation:f.verification.exampleCompilation},sources:f.sources.map(s=>({url:s.url,section:s.section,status:s.status}))}));
const chapters=catalog.chapters.map(c=>({id:c.id,title:c.title,order:c.order,knowledgePoints:c.knowledgePoints.map(p=>({id:p.id,title:p.title,learningGoal:p.learningGoal,functionIds:p.functionIds,exerciseIds:questions.filter(q=>q.knowledgePointIds.includes(p.id)).map(q=>q.id)}))}));
const output=new URL('../src/generated/',import.meta.url);await mkdir(output,{recursive:true});
await writeFile(new URL('content.json',output),JSON.stringify({version:'0.2.0',chapters,functions:publicFunctions,structures:index.structures,lessons,questions,historyQuestions:history}));
await writeFile(new URL('study-schema.json',output),JSON.stringify(studySchema));
console.log(`内容校验通过：${chapters.length} 章 / 88 知识点 / ${lessons.length} 原理讲解 / ${publicFunctions.length} 函数索引 / ${questions.filter(x=>x.type!=='flashcard').length} 题 / ${questions.filter(x=>x.type==='flashcard').length} 卡。`);
