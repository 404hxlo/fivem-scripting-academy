import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import {BrowserProfile} from './components/BrowserProfile';
import './styles.css';
import './learn-shell.css';
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{window.academy ? <App/> : <BrowserProfile><App/></BrowserProfile>}</React.StrictMode>
);
