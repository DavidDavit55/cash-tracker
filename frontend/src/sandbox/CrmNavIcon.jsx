import {CalendarDays, ChartNoAxesCombined, Inbox, ListTodo, UsersRound} from 'lucide-react';

const icons={'היום שלי':ListTodo,'לקוחות':UsersRound,'יומן עסקי':CalendarDays,'תיבת עדכונים':Inbox,'תמונת העסק':ChartNoAxesCombined};
export default function CrmNavIcon({name}) {
 const Icon=icons[name]||ListTodo;
 return <Icon size={19} strokeWidth={1.7} aria-hidden="true"/>;
}
