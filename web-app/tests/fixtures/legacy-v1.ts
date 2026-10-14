import type {Content,StudyData} from '../../src/model';

// 固定合成夹具：模拟旧 v1 的 3 次作答/2 次手动复习，不读取或复制任何用户导出。
export function legacyV1Fixture(c:Content):StudyData {
 const single=c.questions.find(q=>q.type==='single_choice')!,boolean=c.questions.find(q=>q.type==='true_false')!,card=c.questions.find(q=>q.type==='flashcard')!;
 const at='2026-10-14T00:00:00.000Z',due='2026-10-15T00:00:00.000Z';
 const id=(prefix:string,n:number)=>`${prefix}.30000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 return {
  format:'stm32-review-study',schemaVersion:1,appId:'stm32f103c8t6-spl-review',chip:'STM32F103C8T6',contentVersion:'0.2.0',exportedAt:due,
  profile:{profileId:id('profile',1),timeZone:'Asia/Shanghai',schedulerVersion:'simple-spaced-v1'},
  chapterStates:[{chapterId:'ch.rcc',status:'in_progress',updatedAt:at,origin:'user'}],
  knowledgeStates:[],questionStates:[],wrongQuestionStates:[],tombstones:[],
  attempts:[
   {attemptId:id('att',1),questionId:single.id,questionRevision:single.revision,answeredAt:at,mode:'practice',response:{kind:'options',optionIds:[single.answer.optionId!]},grading:{kind:'objective',isCorrect:true},durationMs:50},
   {attemptId:id('att',2),questionId:boolean.id,questionRevision:boolean.revision,answeredAt:at,mode:'practice',response:{kind:'boolean',value:boolean.answer.value!},grading:{kind:'objective',isCorrect:true},durationMs:50},
   {attemptId:id('att',3),questionId:card.id,questionRevision:card.revision,answeredAt:at,mode:'card',response:{kind:'self_rating',rating:'good'},grading:{kind:'self_rated',isCorrect:null},durationMs:50}
  ],
  reviewEvents:[
   {reviewEventId:id('rev',4),questionId:single.id,reviewedAt:at,rating:'good',attemptId:id('att',1),schedulerVersion:'simple-spaced-v1',intervalDays:1,nextDueAt:due},
   {reviewEventId:id('rev',5),questionId:card.id,reviewedAt:at,rating:'good',attemptId:id('att',3),schedulerVersion:'simple-spaced-v1',intervalDays:1,nextDueAt:due}
  ]
 };
}
