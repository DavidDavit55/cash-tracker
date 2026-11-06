export const retryDelay = attempt => attempt < 3 ? [2000, 5000, 15000][attempt] : null;
export function retryableCalendarError(error) {
 const status=error.response?.status;
 return !status || [408,429,500,502,503,504].includes(status) ||
  (status===400 && error.response?.data?.error?.startsWith('פעולת היומן לא הושלמה'));
}
const storageKey='networth-calendar-pending';
export function pendingCalendar(key, value) {
 try {
  const keys=new Set(JSON.parse(sessionStorage.getItem(storageKey)||'[]'));
  if(value===undefined)return keys.has(key);
  if(value)keys.add(key);else keys.delete(key);
  sessionStorage.setItem(storageKey,JSON.stringify([...keys]));
 }catch{return false;}
}
