import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { db, getMeta } from '../db'
import { Icon } from '../components/Icon'
import { Sheet } from '../components/Sheet'
import { applyTheme, getThemePref, type ThemePref } from '../lib/theme'
import { exportBackup, importBackup, parseBackup, wipeAll, type BackupFile } from '../lib/backup'
import { daysSince } from '../lib/format'

function fmtBytes(n: number) {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))}KB`
  return `${(n / 1024 / 1024).toFixed(1)}MB`
}

export function SettingsPage() {
  const [theme, setTheme] = useState<ThemePref>(getThemePref)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState<BackupFile | null>(null)
  const [wipeOpen, setWipeOpen] = useState(false)
  const [usage, setUsage] = useState<string>()
  const [persisted, setPersisted] = useState<boolean>()
  const fileRef = useRef<HTMLInputElement>(null)
  const lastBackupAt = useLiveQuery(() => getMeta<number>('lastBackupAt'), [])
  const counts = useLiveQuery(async () => ({ d: await db.destinations.count(), w: await db.wishes.count(), s: await db.savings.count() }), [])
  const canShare = typeof navigator !== 'undefined' && !!navigator.share

  useEffect(() => {
    navigator.storage?.estimate?.().then((e) => e.usage !== undefined && setUsage(fmtBytes(e.usage)))
    navigator.storage?.persisted?.().then(setPersisted)
  }, [counts])

  const pickTheme = (t: ThemePref) => {
    setTheme(t)
    applyTheme(t)
  }

  const doExport = async (share: boolean) => {
    setBusy(true)
    setMessage('')
    try {
      const r = await exportBackup(share)
      if (r === 'shared') setMessage('백업 파일을 보냈어요.')
      if (r === 'downloaded') setMessage('백업 파일을 내려받았어요. (다운로드 폴더)')
    } catch {
      setMessage('백업 파일을 만들지 못했어요.')
    } finally {
      setBusy(false)
    }
  }

  const onFile = async (f: File | undefined) => {
    if (!f) return
    setMessage('')
    try {
      setPending(parseBackup(await f.text()))
    } catch (e) {
      setMessage((e as Error).message)
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const doImport = async (mode: 'merge' | 'replace') => {
    if (!pending) return
    setBusy(true)
    try {
      const r = await importBackup(pending, mode)
      setMessage(
        `가져오기 완료 — 여행지 ${r.destinations}곳, 하고 싶은 일 ${r.wishes}개, 일정 장소 ${r.stops}곳` +
          (r.savings ? `, 저축 기록 ${r.savings}건` : ''),
      )
    } catch {
      setMessage('가져오는 중에 문제가 생겼어요. 파일이 손상되지 않았는지 확인해 주세요.')
    } finally {
      setBusy(false)
      setPending(null)
    }
  }

  const age = daysSince(lastBackupAt)

  return (
    <div className="page settings">
      <header className="masthead">
        <div>
          <p className="eyebrow">Settings</p>
          <h1 className="display">설정</h1>
        </div>
      </header>

      <section className="card">
        <h2 className="card-title">화면</h2>
        <div className="seg">
          {(['system', 'light', 'dark'] as ThemePref[]).map((t) => (
            <button key={t} className={theme === t ? 'on' : ''} onClick={() => pickTheme(t)}>
              {t === 'system' ? '기기 설정' : t === 'light' ? '밝게' : '어둡게'}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">백업 · 기기 옮기기</h2>
        <p className="muted small">
          데이터는 이 기기 브라우저에만 저장돼요. 브라우저 기록을 지우면 함께 사라지니, 가끔 백업 파일을 MYBOX나 구글 드라이브에 보관해 두세요.
        </p>
        <p className="backup-status">
          {age === undefined ? '아직 백업한 적이 없어요' : age === 0 ? '오늘 백업했어요' : `마지막 백업: ${age}일 전`}
        </p>
        <div className="stack-sm">
          {canShare && (
            <button className="btn btn-primary btn-block" disabled={busy} onClick={() => doExport(true)}>
              <Icon name="share" size={18} /> 백업 파일 보내기 (MYBOX·드라이브·카톡)
            </button>
          )}
          <button className={`btn btn-block ${canShare ? 'btn-ghost' : 'btn-primary'}`} disabled={busy} onClick={() => doExport(false)}>
            <Icon name="download" size={18} /> 백업 파일 내려받기
          </button>
          <button className="btn btn-ghost btn-block" disabled={busy} onClick={() => fileRef.current?.click()}>
            <Icon name="upload" size={18} /> 백업 파일 가져오기
          </button>
          <input ref={fileRef} type="file" accept=".json,.txt,application/json,text/plain" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        </div>
        {message && (
          <p className="form-msg" role="status">
            {message}
          </p>
        )}
      </section>

      <section className="card">
        <h2 className="card-title">공유 컴퓨터에서 쓸 때</h2>
        <ol className="tips">
          <li>
            크롬에서 <strong>Ctrl + Shift + N</strong>으로 시크릿 창을 열어요.
          </li>
          <li>이 앱 주소로 들어가서 ‘백업 파일 가져오기’를 눌러요.</li>
          <li>다 쓰면 고친 내용을 백업한 뒤 창을 닫아요. 이 컴퓨터엔 아무것도 남지 않아요.</li>
        </ol>
      </section>

      <section className="card">
        <h2 className="card-title">이 기기의 저장 공간</h2>
        <dl className="kv">
          <div>
            <dt>담긴 것</dt>
            <dd>{counts ? `여행지 ${counts.d} · 할 일 ${counts.w} · 저축 ${counts.s}` : '…'}</dd>
          </div>
          {usage && (
            <div>
              <dt>사용 중</dt>
              <dd>{usage}</dd>
            </div>
          )}
          {persisted !== undefined && (
            <div>
              <dt>자동 삭제 보호</dt>
              <dd>{persisted ? '켜짐' : '꺼짐 (여행지를 담으면 요청해요)'}</dd>
            </div>
          )}
        </dl>
        <button className="btn btn-danger-text btn-block" onClick={() => setWipeOpen(true)}>
          <Icon name="trash" size={18} /> 이 기기에서 모든 데이터 지우기
        </button>
      </section>

      <section className="card">
        <h2 className="card-title">다른 사람과 나누기</h2>
        <p className="muted small">
          여행지 화면 오른쪽 위 <Icon name="share" size={14} /> 버튼을 누르면 그 여행지(하고 싶은 일·일정·사진)를 파일로 보낼 수 있어요. 받은 사람은
          이 앱의 ‘백업 파일 가져오기’로 열면 돼요. 내 저축 기록은 보내지 않아요.
        </p>
      </section>

      <p className="muted center small app-version">
        Wander Jar · 2단계 v{__APP_VERSION__}
        <br />
        지도 © OpenFreeMap · OpenMapTiles · OpenStreetMap 기여자
      </p>

      {pending && (
        <Sheet title={pending.kind === 'single' ? '여행지 받기' : '백업 가져오기'} onClose={() => setPending(null)}>
          {pending.kind === 'single' ? (
            <p>
              <strong>‘{pending.destinations[0]?.city || pending.destinations[0]?.country}’</strong> 여행지 파일이에요. 하고 싶은 일과 일정이 함께
              들어 있어요. 내 보관함에 더할까요?
            </p>
          ) : (
            <p>
              백업 파일 ({new Date(pending.exportedAt).toLocaleString('ko-KR')})에 여행지 <strong>{pending.destinations.length}곳</strong>이
              있어요.
            </p>
          )}
          <div className="stack-sm">
            <button className="btn btn-primary btn-block" disabled={busy} onClick={() => doImport('merge')}>
              합치기 — 지금 데이터는 두고, 백업 내용을 더하기
            </button>
            {pending.kind !== 'single' && (
              <button
                className="btn btn-ghost btn-block"
                disabled={busy}
                onClick={() => confirm('이 기기 데이터를 모두 지우고 백업으로 바꿀까요?') && doImport('replace')}
              >
                바꾸기 — 이 기기 데이터를 백업으로 교체
              </button>
            )}
          </div>
        </Sheet>
      )}

      {wipeOpen && <WipeSheet onClose={() => setWipeOpen(false)} />}
    </div>
  )
}

function WipeSheet({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState('')
  const ok = text.trim() === '지우기'
  return (
    <Sheet
      title="모든 데이터 지우기"
      onClose={onClose}
      footer={
        <button
          className="btn btn-danger btn-block"
          disabled={!ok}
          onClick={async () => {
            await wipeAll()
            onClose()
          }}
        >
          모두 지우기
        </button>
      }
    >
      <p>이 기기에 저장된 여행지, 사진, 할 일, 저축 기록이 모두 지워지고 되돌릴 수 없어요. 먼저 백업했는지 확인해 주세요.</p>
      <p className="muted small">계속하려면 아래에 ‘지우기’라고 적어 주세요.</p>
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder="지우기" />
    </Sheet>
  )
}
