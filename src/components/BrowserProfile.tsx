import {useEffect, useState, type ReactNode} from 'react';
import {download, MAX_BACKUP_BYTES, parseBackup, saveBrowserProfile} from '../lib/state';

export function BrowserRecovery({error}: {error: string}) {
  const [message, setMessage] = useState('');
  function downloadOriginal() {
    const text = localStorage.getItem('academy-state');
    if (text === null) throw new Error('There is no stored browser profile.');
    download('brick-by-script-learn-recovery.json', text);
  }
  async function restore(file?: File) {
    if (!file) return;
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error('Backup file exceeds the 48 MB limit.');
      const state = parseBackup(await file.text());
      if (!window.confirm('Replace this browser profile with the selected backup? A copy of the current data will download first.')) return;
      downloadOriginal();
      saveBrowserProfile(state);
      location.reload();
    } catch (cause) { setMessage(String(cause)); }
  }
  return <div className="fatal">
    <h1>Your browser profile could not be opened</h1><p>{error}</p>
    <p>Download your original data for repair, or choose a working Brick by Script Learn backup to restore it.</p>
    <button onClick={() => {try {downloadOriginal();} catch (cause) {setMessage(String(cause));}}}>Download original data</button>
    <label>Restore from backup <input type="file" accept=".json" onChange={e => {
      const file = e.target.files?.[0]; e.target.value = ''; void restore(file);
    }}/></label>
    <button onClick={() => location.reload()}>Retry loading</button>{message && <p role="alert">{message}</p>}
  </div>;
}

// The browser preview saves one complete profile per origin. Keep that profile
// under a single writer, just as the desktop app allows one window per database.
export function BrowserProfile({children}: {children: ReactNode}) {
  const [status, setStatus] = useState<'opening'|'waiting'|'ready'|'unavailable'>('opening');
  useEffect(() => {
    const pending = new AbortController();
    let release!: () => void;
    const untilClosed = new Promise<void>(resolve => { release = resolve; });
    async function open() {
      const locks = navigator.locks;
      const lockName = 'fivem-academy-profile';
      async function useProfile() {
        if (pending.signal.aborted) return;
        setStatus('ready');
        await untilClosed;
      }
      const acquired = await locks.request(lockName, {ifAvailable: true}, async lock => {
        if (!lock) return false;
        await useProfile();
        return true;
      });
      if (acquired || pending.signal.aborted) return;
      setStatus('waiting');
      await locks.request(lockName, {signal: pending.signal}, useProfile);
    }
    void open().catch(() => { if (!pending.signal.aborted) setStatus('unavailable'); });
    return () => { pending.abort(); release(); };
  }, []);
  if (status === 'ready') return children;
  if (status === 'waiting') return <div className="loading-screen" role="status"><h1>Brick by Script Learn is open in another tab</h1><p>Close the other learning tab to continue here with your latest work.</p></div>;
  if (status === 'unavailable') return <div className="fatal" role="alert"><h1>The browser profile could not open</h1><p>Open the preview in a current browser on localhost or HTTPS.</p></div>;
  return <div className="loading-screen" role="status">Opening Brick by Script Learn…</div>;
}
