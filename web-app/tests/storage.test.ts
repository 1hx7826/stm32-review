import 'fake-indexeddb/auto';
import {beforeEach,describe,it,expect} from 'vitest';
import {closeDatabase,DB_NAME,loadStudy,mutateStudy,latestBackup} from '../src/storage';
beforeEach(async()=>{closeDatabase();await new Promise<void>((resolve,reject)=>{const r=indexedDB.deleteDatabase(DB_NAME);r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error);});});
describe('IndexedDB 持久化与事务',()=>{
 it('关闭连接重新打开仍保留手动章节状态',async()=>{await loadStudy('0.2.0');await mutateStudy('0.2.0',d=>({...d,chapterStates:[{chapterId:'ch.gpio',status:'in_progress',updatedAt:'2026-10-14T00:00:00Z',origin:'user'}]}));closeDatabase();expect((await loadStudy('0.2.0')).data.chapterStates[0].status).toBe('in_progress');});
 it('并发读改写事务不会丢掉另一个更新',async()=>{await loadStudy('0.2.0');await Promise.all(['ch.rcc','ch.gpio'].map(chapterId=>mutateStudy('0.2.0',d=>({...d,chapterStates:[...d.chapterStates,{chapterId,status:'learned',updatedAt:'2026-10-14T00:00:00Z',origin:'user'}]}))));expect((await loadStudy('0.2.0')).data.chapterStates).toHaveLength(2);});
 it('替换与原数据备份同一事务提交',async()=>{const old=await loadStudy('0.2.0');await mutateStudy('0.2.0',d=>({...d,chapterStates:[{chapterId:'ch.rcc',status:'learned',updatedAt:'2026-10-14T00:00:00Z',origin:'user'}]}),{backup:true,expectedRevision:old.revision});expect((await latestBackup())?.chapterStates).toEqual([]);});
 it('导入预览过期时拒绝且不覆盖新记录',async()=>{const old=await loadStudy('0.2.0');await mutateStudy('0.2.0',d=>({...d,contentVersion:'changed'}));await expect(mutateStudy('0.2.0',()=>old.data,{backup:true,expectedRevision:old.revision})).rejects.toThrow('已变化');expect((await loadStudy('0.2.0')).data.contentVersion).toBe('changed');});
 it('变换失败使整个写入事务回滚',async()=>{const old=await loadStudy('0.2.0');await expect(mutateStudy('0.2.0',()=>{throw new Error('模拟导入故障');},{backup:true})).rejects.toThrow('模拟');expect(await loadStudy('0.2.0')).toEqual(old);expect(await latestBackup()).toBeNull();});
});
