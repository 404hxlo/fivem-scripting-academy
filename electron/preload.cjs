'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('academy', Object.freeze({
  load: () => ipcRenderer.invoke('academy:load'),
  save: state => ipcRenderer.invoke('academy:save', state),
  saveBeforeClose: state => ipcRenderer.sendSync('academy:save-before-close', state),
  exportResource: (project, format) => ipcRenderer.invoke('academy:export-resource', project, format),
  exportBackup: state => ipcRenderer.invoke('academy:export-backup', state),
  importBackup: () => ipcRenderer.invoke('academy:import-backup'),
  openExternal: url => ipcRenderer.invoke('academy:open-external', url),
  openVSCode: project => ipcRenderer.invoke('academy:open-vscode', project),
  refreshSource: url => ipcRenderer.invoke('academy:refresh-source', url),
  chooseServer: () => ipcRenderer.invoke('academy:choose-server'),
}));
