import React from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import axios from 'axios';
import api from './api/client';
import OperationalCrm from './pages/OperationalCrm.jsx';
import PreviewBudgetWorkspace from './pages/PreviewBudgetWorkspace.jsx';
import {previewBudgetApi} from './admin-preview-budget-api.js';

// This entry is local-review only, never referenced by the production entry.
// Imported legacy integrations must fail closed rather than contact staging.
api.defaults.adapter=async()=>{throw Error('החיבור החיצוני חסום בבדיקה המקומית');};
const reviewApi=axios.create({baseURL:'/api',timeout:15000});
async function start(){
 await reviewApi.post('/review-session');
 createRoot(document.getElementById('root')).render(<BrowserRouter><OperationalCrm apiClient={reviewApi}
  banner="בדיקה מקומית בלבד · מעקב נשמר במסד מבודד · ללא שליחה או שינוי בסטייג׳ינג ובלייב"
  budgetContent={<><p className="existing-preview-banner">התקציב נשאר במערכת. כאן נתוני המחשה בלבד, שאינם נשמרים ברענון; התקציב החי לא משתנה.</p><PreviewBudgetWorkspace apiClient={previewBudgetApi} initialPeriod="2026-10" showLegacyLinks={false}/></>}/></BrowserRouter>);
}
start().catch(()=>{document.getElementById('root').textContent='לא ניתן לפתוח את סביבת הבדיקה המקומית. לא נטענו נתונים חלופיים.';});
