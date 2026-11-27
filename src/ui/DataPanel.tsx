import { useRef, useState } from 'react'
import { exportBackup, importBackup, readBackup } from '../state/backup.ts'

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`

/** "keyflow-backup-2026-11-27.json", in local time. */
function fileName() {
  const d = new Date()
  const two = (n: number) => String(n).padStart(2, '0')
  return `keyflow-backup-${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}.json`
}

/** Export all user data to one file, or replace it all from one (P2-T8). */
export function DataPanel() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function onExport() {
    setBusy(true)
    setMessage(null)
    try {
      const url = URL.createObjectURL(await exportBackup())
      const a = document.createElement('a')
      a.href = url
      a.download = fileName()
      a.click()
      // After the click has started the download.
      setTimeout(() => URL.revokeObjectURL(url), 0)
    } catch {
      setMessage('Your data couldn’t be read from the browser, so there’s nothing to export.')
    } finally {
      setBusy(false)
    }
  }

  async function onImport(file: File) {
    setBusy(true)
    setMessage(null)
    try {
      const data = await readBackup(file)
      if (typeof data === 'string') {
        setMessage(data)
        return
      }
      const what = `${plural(data.items.length, 'practice item')}, ${plural(data.reviewLogs.length, 'logged attempt')} and ${plural(data.takes.length, 'take')}`
      if (
        !window.confirm(
          `Replace everything Keyflow keeps in this browser with this backup (${what}, and its settings)? What’s here now is lost unless you export it first.`,
        )
      )
        return
      await importBackup(data) // reloads the page
    } catch {
      setMessage('The import couldn’t be saved in the browser, so your data is as it was.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card" aria-labelledby="data-tab" data-testid="data">
      <h2 className="tab" id="data-tab">
        Your data
      </h2>
      <p className="blurb">
        Your settings, takes and practice history live only in this browser. Export them to a file
        to keep a copy or move to another browser; importing a file replaces what’s here.
      </p>
      <div className="actions">
        <button type="button" disabled={busy} onClick={() => void onExport()}>
          Export backup
        </button>
        <button type="button" disabled={busy} onClick={() => fileRef.current?.click()}>
          Import backup
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          hidden
          aria-label="Backup file to import"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = '' // so picking the same file again still fires
            if (file) void onImport(file)
          }}
        />
      </div>
      {message && (
        <p className="hint" role="status">
          {message}
        </p>
      )}
    </section>
  )
}
