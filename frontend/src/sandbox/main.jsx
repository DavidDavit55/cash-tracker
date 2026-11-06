import { createRoot } from 'react-dom/client';
import SandboxApp from './SandboxApp';
import WorkflowApp from './WorkflowApp';

createRoot(document.getElementById('root')).render(new URLSearchParams(location.search).has('admin') || new URLSearchParams(location.search).has('register') ? <WorkflowApp /> : <SandboxApp />);
