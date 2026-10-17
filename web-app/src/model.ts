export type ChapterStatus = 'not_started'|'in_progress'|'learned';
export type Familiarity = 'new'|'learning'|'familiar'|'mastered';
export type Rating = 'again'|'hard'|'good'|'easy';
export type Response = {kind:'options';optionIds:string[]}|{kind:'boolean';value:boolean}|{kind:'self_rating';rating:Rating}|{kind:'matching';pairs:{leftId:string;rightId:string}[]}|{kind:'ordering';orderedItemIds:string[]};
export interface Source {sourceId?:string;url:string;section:string;status:string;revision?:string;chip?:string}
export interface Question {
 id:string;revision:number;chapterId:string;knowledgePointIds:string[];type:string;level:string;difficulty:number;stem:string;
 payload:{options?:{id:string;text:string}[];front?:string;back?:string;code?:string;assumptions?:string[]};
 answer:{optionId?:string;optionIds?:string[];value?:boolean;expectedRecall?:string;grading?:string};
 explanations:{correct:string;incorrect:Record<string,string>};functionIds:string[];sources:Source[];
 verification:{answer:string;reasoning:string;chipApplicability:string;code:string;reviewedOn:string|null;notes:string};publicationStatus:string;
}
export interface Attempt {attemptId:string;questionId:string;questionRevision:number;answeredAt:string;mode:'daily_review'|'practice'|'wrong_book'|'card';response:Response;grading:{kind:'objective'|'self_rated'|'ungraded';isCorrect:boolean|null};durationMs:number}
export interface ReviewEvent {reviewEventId:string;questionId:string;reviewedAt:string;rating:Rating;attemptId:string|null;schedulerVersion:'simple-spaced-v1';intervalDays:number;nextDueAt:string}
export interface StudyData {
 format:'stm32-review-study';schemaVersion:1;appId:'stm32f103c8t6-spl-review';chip:'STM32F103C8T6';contentVersion:string;exportedAt:string;
 profile:{profileId:string;timeZone:string;schedulerVersion:'simple-spaced-v1'};
 chapterStates:{chapterId:string;status:ChapterStatus;updatedAt:string;origin:'user'}[];
 knowledgeStates:{knowledgePointId:string;familiarity:Familiarity;updatedAt:string;origin:'user'}[];
 questionStates:{questionId:string;familiarity:Familiarity;updatedAt:string;origin:'user';bookmarked:boolean}[];
 attempts:Attempt[];wrongQuestionStates:{questionId:string;state:'open'|'resolved';updatedAt:string;resolvedAt:string|null;note:string}[];
 reviewEvents:ReviewEvent[];tombstones:{deletionId:string;targetKind:'attempt'|'review_event';targetId:string;deletedAt:string}[];
}
export interface KnowledgePoint {number?:string;id:string;title:string;learningGoal:string;functionIds:string[];exerciseIds:string[]}
export interface Chapter {description?:string;id:string;title:string;order:number;knowledgePoints:KnowledgePoint[]}
export interface FunctionEntry {id:string;name:string;peripheral:string;prototype:string;purpose:string;parameters:{name:string;type:string;meaning:string;structureType?:string}[];returnValue:{type:string;meaning:string};flowPosition:string;example:{code:string;context:string;verificationStatus:string};prerequisitesAndCommonErrors:string[];knowledgePointIds:string[];sources:Source[];verification:{officialPackage:string;declaration:string;hardwareDetails:string;exampleCompilation:string};applicability:{scope:string}}
export interface Lesson {number:string;originalSupplement?:boolean;sourceIssue?:string;diagram:{kind:string;caption:string};steps:{title:string;action:string;why:string;expect:string;functionIds:string[]}[];knowledgePointId:string;title:string;lead:string;minutes:number;conceptVerification:string;functionIds:string[];sections:{title:string;paragraphs:string[]}[];flow:string[];example:{code:string;assumptions:string[];status:string;publicationStatus:string};troubleshooting:{symptom:string;checks:string}[];sources:Source[];reviewedOn:string}
export interface Content {legacyChapterIds?:string[];legacyKnowledgePointIds?:string[];version:string;chapters:Chapter[];functions:FunctionEntry[];lessons:Lesson[];questions:Question[];historyQuestions:Question[];structures?:Record<string,{members:{name:string;type:string;meaning:string}[]}>}
export const now=()=>new Date().toISOString();
export interface RandomSource {randomUUID?:()=>string;getRandomValues?:(bytes:Uint8Array<ArrayBuffer>)=>unknown}
export function uid(prefix:string,source:RandomSource|undefined=globalThis.crypto):string {
 if(typeof source?.randomUUID==='function'){try{return `${prefix}.${source.randomUUID()}`;}catch{/* 某些浏览器暴露接口但不允许调用；继续使用安全随机数。 */}}
 if(typeof source?.getRandomValues!=='function')throw new Error('浏览器不支持安全随机数，无法可靠生成学习记录 ID。请使用支持 Web Crypto 的浏览器。');
 const bytes=new Uint8Array(16);
 try{source.getRandomValues(bytes);}catch{throw new Error('浏览器安全随机数调用失败，未生成学习记录 ID。');}
 bytes[6]=(bytes[6]&0x0f)|0x40;bytes[8]=(bytes[8]&0x3f)|0x80;
 const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
 return `${prefix}.${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
export function emptyStudy(version:string):StudyData {return {format:'stm32-review-study',schemaVersion:1,appId:'stm32f103c8t6-spl-review',chip:'STM32F103C8T6',contentVersion:version,exportedAt:now(),profile:{profileId:uid('profile'),timeZone:'Asia/Shanghai',schedulerVersion:'simple-spaced-v1'},chapterStates:[],knowledgeStates:[],questionStates:[],attempts:[],wrongQuestionStates:[],reviewEvents:[],tombstones:[]};}
