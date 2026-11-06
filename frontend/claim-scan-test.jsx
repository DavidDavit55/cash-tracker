import React from 'react';
import {createRoot} from 'react-dom/client';
import Scanner from './src/components/ClaimScanner';
createRoot(document.getElementById('root')).render(<Scanner client={{name:'לקוח סינתטי',operationalTasks:[]}} productId="test" onSave={tasks=>{window.saved=tasks;return true}}/>);
