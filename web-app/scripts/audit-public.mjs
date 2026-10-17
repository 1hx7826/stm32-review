import {readdir,readFile,copyFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../../',import.meta.url));
const allowed=new Set([".github/workflows/deploy.yml", ".gitignore", ".node-version", "NOTICE.md", "README.md", "THIRD_PARTY_NOTICES.txt", "content/course/README.md", "content/course/catalog.json", "content/course/functions.json", "content/course/legacy-ids.json", "content/course/lessons.json", "content/course/questions.json", "content/course/source-register.json", "content/schemas/question.schema.json", "content/schemas/study-export.schema.json", "web-app/.npmrc", "web-app/index.html", "web-app/package-lock.json", "web-app/package.json", "web-app/scripts/audit-dist.mjs", "web-app/scripts/audit-public.mjs", "web-app/scripts/content-validation.mjs", "web-app/scripts/prepare-content.mjs", "web-app/src/App.tsx", "web-app/src/CourseViews.tsx", "web-app/src/Diagrams.tsx", "web-app/src/domain.ts", "web-app/src/history.ts", "web-app/src/main.tsx", "web-app/src/model.ts", "web-app/src/storage.ts", "web-app/src/styles.css", "web-app/src/useStudy.ts", "web-app/src/validation.ts", "web-app/tests/content.test.mjs", "web-app/tests/course.test.ts", "web-app/tests/domain.test.ts", "web-app/tests/fixtures/legacy-v1.ts", "web-app/tests/phase25-storage.test.ts", "web-app/tests/phase25.test.ts", "web-app/tests/scheduler-boundary-storage.test.ts", "web-app/tests/scheduler-boundary.test.ts", "web-app/tests/storage.test.ts", "web-app/tsconfig.json", "web-app/vite.config.ts"]);
const generated=new Set(['web-app/src/generated/content.json','web-app/src/generated/study-schema.json']);
const ignored=new Set(['node_modules','dist','.git','.npm-cache','.vite','.playwright']);
const bad=[
 /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
 /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|npm_[A-Za-z0-9]{20,}|AKIA[A-Z0-9]{16})\b/,
 /https?:\/\/[^\s\/@:]+:[^\s\/@]+@/,
 /(^|[\s"'=(])(?:[A-Za-z]:[\\/]|\/Users\/|\/home\/)[^\r\n]*/m
];
function inspect(rel,text){if(bad.some(r=>r.test(text)))throw new Error('公开内容敏感规则命中：'+rel);if(rel.endsWith('.json')){const data=JSON.parse(text);if(data?.format==='stm32-review-study')throw new Error('不能公开学习备份：'+rel);}}
let sourceCount=0;
async function walk(dir,prefix=''){
 for(const entry of await readdir(dir,{withFileTypes:true})){
  const rel=prefix+entry.name;
  if(entry.isSymbolicLink())throw new Error('禁止公开符号链接：'+rel);
  if(entry.isDirectory()){if(ignored.has(entry.name))continue;await walk(path.join(dir,entry.name),rel+'/');}
  else {if(entry.name.endsWith('.tsbuildinfo'))continue;if(!allowed.has(rel)&&!generated.has(rel))throw new Error('不在公开白名单：'+rel);inspect(rel,await readFile(path.join(dir,entry.name),'utf8'));if(allowed.has(rel))sourceCount++;}
 }
}
await walk(root);
if(sourceCount!==allowed.size)throw new Error('公开文件缺失');
const dist=path.join(root,'web-app/dist');
if(process.argv.includes('--finalize'))await copyFile(path.join(root,'THIRD_PARTY_NOTICES.txt'),path.join(dist,'THIRD_PARTY_NOTICES.txt'));
let distCount=0;
async function auditDist(dir,prefix=''){
 for(const entry of await readdir(dir,{withFileTypes:true})){
  const rel=prefix+entry.name;if(entry.isSymbolicLink())throw new Error('静态产物符号链接');
  if(entry.isDirectory()){await auditDist(path.join(dir,entry.name),rel+'/');continue;}
  if(!/\.(html|js|css)$/.test(rel)&&rel!=='THIRD_PARTY_NOTICES.txt')throw new Error('静态产物额外文件：'+rel);
  const text=await readFile(path.join(dir,entry.name),'utf8');inspect(rel,text);
  if(/scheduler-boundary-checks|phase25-file-manifest|study-roundtrip\.json/.test(text))throw new Error('静态产物含内部资料：'+rel);
  distCount++;
 }
}
await auditDist(dist);
console.log('公开白名单审计通过：'+sourceCount+' 个仓库文件，'+distCount+' 个静态产物；无学习备份、凭据或本机路径。');
