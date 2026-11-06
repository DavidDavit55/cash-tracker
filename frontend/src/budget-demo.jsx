import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import axios from 'axios';
import BudgetWorkspace from './pages/BudgetWorkspace';
import './budget-demo.css';
import BrandLogo from './sandbox/BrandLogo';
const api=axios.create({baseURL:'/api'});
createRoot(document.getElementById('root')).render(<BrowserRouter><div className="budget-demo"><div className="demo-note">תצוגה מקומית · עותק של הנתונים שלך · שינויים נשמרים מקומית בלבד, ולא בחשבון החי</div><header className="demo-brand"><BrandLogo/><span>דוד · התקציב האישי</span></header><main><BudgetWorkspace apiClient={api} initialPeriod="2026-09" showLegacyLinks={false}/></main></div></BrowserRouter>);

