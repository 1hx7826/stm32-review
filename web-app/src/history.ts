import type {Content,StudyData} from './model';
import {isPublished} from './domain';

/** 归档是根据当前题库计算的视图，不改写 v1 备份或把未知来源当作已验证。 */
export function archiveDetails(d:StudyData,c:Content) {
 const current=new Map(c.questions.filter(isPublished).map(q=>[q.id,q]));
 const archivedAttempts=d.attempts.filter(a=>{const q=current.get(a.questionId);return !q||q.revision!==a.questionRevision;});
 const ids=new Set([...d.questionStates,...d.attempts,...d.reviewEvents,...d.wrongQuestionStates].filter(x=>!current.has(x.questionId)).map(x=>x.questionId));
 for(const a of archivedAttempts)ids.add(a.questionId);
 const attemptIds=new Set(archivedAttempts.map(a=>a.attemptId));
 return {questionIds:[...ids].sort(),attemptCount:archivedAttempts.length,reviewCount:d.reviewEvents.filter(r=>!current.has(r.questionId)||!!r.attemptId&&attemptIds.has(r.attemptId)).length,wrongStateCount:d.wrongQuestionStates.filter(w=>ids.has(w.questionId)).length};
}
