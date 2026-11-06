import assert from 'node:assert/strict';
import {test} from 'node:test';
import {retryDelay,retryableCalendarError,pendingCalendar} from '../frontend/src/lib/calendarRetry.js';
test('bounded retry delays and transient errors only',()=>{
 assert.deepEqual([0,1,2,3,4].map(retryDelay),[2000,5000,15000,null,null]);
 for(const status of [408,429,500,502,503,504])assert.equal(retryableCalendarError({response:{status}}),true);
 for(const status of [401,403,409])assert.equal(retryableCalendarError({response:{status}}),false);
 assert.equal(retryableCalendarError({}),true);
 assert.equal(retryableCalendarError({response:{status:400,data:{error:'מועד הפגישה לא תקין'}}}),false);
});
test('pending IDs survive component reload until confirmed',()=>{
 const data=new Map();globalThis.sessionStorage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
 pendingCalendar('client:appointment',true);assert.equal(pendingCalendar('client:appointment'),true);
 pendingCalendar('client:appointment',false);assert.equal(pendingCalendar('client:appointment'),false);
 delete globalThis.sessionStorage;
});
