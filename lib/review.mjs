export const DAY=86400000;
export const REVIEW_DAYS=[1,3,7,14,30];
export const MASTERY_LEVEL=6;
const day=t=>Math.floor(t/DAY);
export function scheduleReview(previous,{correct,passed=false,now}){
 const p=previous??{attempts:0,successes:0,lapses:0,level:0,last_success_at:null,due_at:null};
 const next={...p,attempts:p.attempts+1,last_at:now,mastered:0,passed:0};
 if(passed)return {...next,mastered:1,passed:1,due_at:null};
 if(!correct)return {...next,lapses:p.lapses+1,level:0,due_at:now+10*60000};
 next.successes=p.successes+1;
 // Extra warm-ups on the same day do not accelerate mastery or postpone a due review.
 if(!previous||p.due_at<=now&&(p.level===0||p.last_success_at===null||day(now)>day(p.last_success_at))){next.level=p.level+1;next.last_success_at=now;}
 if(next.level>=MASTERY_LEVEL)return {...next,mastered:1,due_at:null};
 if(next.level!==p.level||p.due_at===null)next.due_at=now+REVIEW_DAYS[next.level-1]*DAY;
 return next;
}
