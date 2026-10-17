import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
export function questionValidator(schema) {
 const ajv=new Ajv2020({allErrors:true,strict:false});addFormats(ajv);const validate=ajv.compile(schema);
 return (q,ids)=>{
  if(!validate(q))throw new Error(`${q.id}: ${ajv.errorsText(validate.errors)}`);
  if(!ids.chapters.has(q.chapterId)||q.knowledgePointIds.some(id=>!ids.points.has(id))||q.functionIds.some(id=>!ids.functions.has(id)))throw new Error(`${q.id}: 内容引用无效`);
  const options=q.payload.options;
  if(options){const optionIds=options.map(x=>x.id);if(new Set(optionIds).size!==options.length)throw new Error(`${q.id}: 选项 ID 重复`);const correct=q.answer.optionIds||[q.answer.optionId];if(correct.some(id=>!optionIds.includes(id)))throw new Error(`${q.id}: 答案引用无效`);for(const id of optionIds.filter(id=>!correct.includes(id)))if(!q.explanations.incorrect[id])throw new Error(`${q.id}: 干扰项解释缺失`);}
  const keys=['answer','reasoning','chipApplicability'];
  const official=keys.every(k=>q.verification[k]==='official_checked')&&q.sources.some(s=>s.status==='official_checked'&&new URL(s.url).hostname==='www.st.com');
  const match=/^q\.course(\d+)\.s(\d+)\./.exec(q.id),number=match?`${match[1]}.${match[2]}`:'';
  const course=!!match&&keys.every(k=>q.verification[k]==='source_checked')&&q.sources.some(s=>s.status==='source_checked'&&(s.sourceId===`src.course.${number}`&&s.url===`urn:stm32:course:${number}:pdf`||number==='9.10'&&s.sourceId==='src.course.original.9.10'&&s.url.startsWith('https://www.st.com/resource/en/reference_manual/rm0008-')));
  if(q.publicationStatus==='published'&&(!(official||course)||q.sources.some(s=>s.status==='conflict')||!['not_applicable','compiled','on_device'].includes(q.verification.code)))throw new Error(`${q.id}: 发布证据不足`);

  return true;
 };
}
