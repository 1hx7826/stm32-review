import {readdir,stat} from 'node:fs/promises';
const root=new URL('../dist/',import.meta.url);let count=0,total=0;
async function walk(path){for(const name of await readdir(path)){const target=new URL(name,path),s=await stat(target);if(/references|phase1|phase2-baseline|review-log|\.pdf$|\.md$/i.test(name))throw new Error(`禁止打包内部文件：${name}`);if(s.isDirectory())await walk(new URL(name+'/',path));else{if(name!=='THIRD_PARTY_NOTICES.txt'&&!/\.(html|js|css|svg|woff2)$/.test(name))throw new Error(`未审核构建文件类型：${name}`);count++;total+=s.size;}}}
await walk(root);console.log(`构建审计通过：${count} 个公开静态文件，${Math.round(total/1024)} KiB；无 PDF、审查文件或第三方素材。`);
