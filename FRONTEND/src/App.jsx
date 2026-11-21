import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8080'
const STAKES = [300, 800, 2000]
const gameNames = { COIN: 'Moneda y probabilidad', PUZZLE: 'Carrera de rompecabezas', WORD: 'Palabra o acertijo' }

async function request(path, { token, ...options } = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options?.headers },
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.message || `Error ${response.status}`)
  }
  if (response.status === 204) return null
  return response.json()
}

const formatTime = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

async function pollVoiceSignals(id, authToken, voiceRef) {
  const signals = await request(`/api/challenges/${id}/voice-signals?after=${encodeURIComponent(voiceRef.current.last)}`, { token: authToken })
  for (const signal of signals) {
    voiceRef.current.last = signal.createdAt
    const pc = voiceRef.current.pc
    if (!pc) return
    const data = JSON.parse(signal.payload)
    if (signal.kind === 'OFFER') {
      await pc.setRemoteDescription(data)
      const answer = await pc.createAnswer(); await pc.setLocalDescription(answer)
      await request(`/api/challenges/${id}/voice-signals`, { token: authToken, method: 'POST', body: JSON.stringify({ kind: 'ANSWER', payload: JSON.stringify(answer) }) })
    } else if (signal.kind === 'ANSWER') await pc.setRemoteDescription(data)
    else if (signal.kind === 'ICE' && data) {
      if (pc.remoteDescription) await pc.addIceCandidate(data)
      else voiceRef.current.pendingCandidates.push(data)
    }
    if ((signal.kind === 'OFFER' || signal.kind === 'ANSWER') && voiceRef.current.pendingCandidates.length) {
      const pending = voiceRef.current.pendingCandidates.splice(0)
      for (const candidate of pending) await pc.addIceCandidate(candidate)
    }
  }
}

function App() {
  const [token, setToken] = useState(sessionStorage.getItem('sim-token') || '')
  const [account, setAccount] = useState(null)
  const [games, setGames] = useState([])
  const [challenges, setChallenges] = useState([])
  const [match, setMatch] = useState(null)
  const [authMode, setAuthMode] = useState('login')
  const [tab, setTab] = useState('games')
  const [selectedGame, setSelectedGame] = useState('COIN')
  const [stake, setStake] = useState(300)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [chatMessages, setChatMessages] = useState([])
  const [message, setMessage] = useState('')
  const [muted, setMuted] = useState(false)
  const [chatMuted, setChatMuted] = useState(false)
  const [videoComplete, setVideoComplete] = useState(false)
  const [restUntil, setRestUntil] = useState(0)
  const [now, setNow] = useState(Date.now())
  const [wordAnswer, setWordAnswer] = useState('')
  const [puzzle, setPuzzle] = useState([])
  const [draggedIndex, setDraggedIndex] = useState(null)
  const [triggerOpen, setTriggerOpen] = useState(false)
  const [adminReports, setAdminReports] = useState([])
  const [voiceOn, setVoiceOn] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [backendStatus, setBackendStatus] = useState('checking')
  const [backendRetry, setBackendRetry] = useState(0)
  const [backendWaitSeconds, setBackendWaitSeconds] = useState(0)
  const backendWaitStarted = useRef(Date.now())
  const voiceRef = useRef({ pc: null, stream: null, last: new Date(0).toISOString(), pendingCandidates: [] })
  const refreshRef = useRef(null)
  const chatCursor = useRef(null)
  const puzzleServerState = useRef('')

  useEffect(() => {
    if (token) return undefined
    setBackendWaitSeconds(Math.floor((Date.now() - backendWaitStarted.current) / 1000))
    setBackendStatus('checking')
    let cancelled = false
    let timeoutId
    let retryTimer
    let connected = false

    const timer = window.setInterval(() => {
      setBackendWaitSeconds(Math.floor((Date.now() - backendWaitStarted.current) / 1000))
    }, 1000)

    async function checkBackend() {
      setBackendStatus('checking')
      const controller = new AbortController()
      timeoutId = window.setTimeout(() => controller.abort(), 15000)
      try {
        const response = await fetch(`${API}/api/games`, { signal: controller.signal })
        if (!response.ok) throw new Error(`El servidor respondió ${response.status}`)
        const catalog = await response.json()
        if (!cancelled) {
          setGames(catalog)
          setBackendStatus('ready')
          connected = true
        }
      } catch {
        if (!cancelled) setBackendStatus('waiting')
      } finally {
        window.clearTimeout(timeoutId)
        if (!cancelled && !connected) {
          // Retry after a short pause; the elapsed timer reflects actual wait time.
          retryTimer = window.setTimeout(() => { if (!cancelled) void checkBackend() }, 3000)
        }
      }
    }

    void checkBackend()
    return () => {
      cancelled = true
      window.clearInterval(timer)
      window.clearTimeout(timeoutId)
      window.clearTimeout(retryTimer)
    }
  }, [token, backendRetry])

  const run = useCallback(async (fn) => {
    setError('')
    try { return await fn() } catch (err) { setError(err.message); return null }
  }, [])

  const loadAccount = useCallback(async (authToken = token) => {
    if (!authToken) return
    const data = await request('/api/auth/me', { token: authToken })
    setAccount(data)
  }, [token])

  const loadGames = useCallback(async () => setGames(await request('/api/games')), [])

  const loadLobby = useCallback(async () => {
    if (!token || match) return
    const data = await request('/api/challenges/waiting', { token })
    setChallenges(data)
  }, [token, match])

  useEffect(() => {
    if (!token) return
    const timer = window.setTimeout(() => run(async () => { await loadAccount(token); await loadGames() }), 0)
    return () => window.clearTimeout(timer)
  }, [token, loadAccount, loadGames, run])

  useEffect(() => {
    if (!token || match) return
    const first = window.setTimeout(() => run(loadLobby), 0)
    const timer = window.setInterval(() => run(loadLobby), 2500)
    return () => { window.clearTimeout(first); window.clearInterval(timer) }
  }, [token, match, loadLobby, run])

  useEffect(() => {
    if (!token) return
    const timer = window.setInterval(() => run(() => loadAccount()), 5000)
    return () => window.clearInterval(timer)
  }, [token, loadAccount, run])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!token || !match?.id || !['ACTIVE', 'WAITING'].includes(match.status)) return
    let alive = true
    const refresh = async () => {
      try {
        const updated = await request(`/api/challenges/${match.id}`, { token })
        if (!alive) return
        setMatch(updated)
        if (updated.status !== 'ACTIVE') return
        const boardState = JSON.stringify(updated.myPuzzleBoard || [])
        if (boardState !== puzzleServerState.current) {
          puzzleServerState.current = boardState
          setPuzzle(updated.myPuzzleBoard || [])
        }
        const after = chatCursor.current
        const chat = await request(`/api/challenges/${match.id}/messages${after ? `?after=${encodeURIComponent(after)}` : ''}`, { token })
        if (alive && chat.length) { setChatMessages((items) => [...items, ...chat.filter((m) => !items.some((old) => old.id === m.id))]); chatCursor.current = chat.at(-1).createdAt }
        if (voiceRef.current.pc) await pollVoiceSignals(match.id, token, voiceRef)
        await loadAccount(token)
      } catch (err) { if (alive) setError(err.message) }
    }
    refresh()
    refreshRef.current = window.setInterval(refresh, 1200)
    return () => { alive = false; window.clearInterval(refreshRef.current) }
  }, [token, match?.id, match?.status, loadAccount])

  useEffect(() => {
    if (match?.status === 'FINISHED') {
      const timer = window.setTimeout(() => {
        setRestUntil(Date.now() + 5 * 60_000)
        setVideoComplete(false)
        setVoiceOn(false)
        stopVoice()
        run(() => loadAccount())
      }, 0)
      return () => window.clearTimeout(timer)
    }
  }, [match?.status, loadAccount, run])

  useEffect(() => () => stopVoice(), [])

  useEffect(() => {
    if (!token || !match?.id || match.status !== 'ACTIVE') return
    const forfeiture = () => {
      fetch(`${API}/api/challenges/${match.id}/forfeit`, {
        method: 'POST', keepalive: true,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      }).catch(() => {})
    }
    window.addEventListener('pagehide', forfeiture)
    return () => window.removeEventListener('pagehide', forfeiture)
  }, [token, match?.id, match?.status])

  async function authenticate(event) {
    event.preventDefault()
    if (backendStatus !== 'ready') return
    setBusy(true)
    const form = new FormData(event.currentTarget)
    const body = Object.fromEntries(form.entries())
    const result = await run(() => request(`/api/auth/${authMode === 'login' ? 'login' : 'register'}`, { method: 'POST', body: JSON.stringify(body) }))
    if (result) { sessionStorage.setItem('sim-token', result.token); setAccount(result.player); setToken(result.token); setNotice('Sesión iniciada. Tu saldo usa créditos ficticios.'); }
    setBusy(false)
  }

  async function createChallenge() {
    setBusy(true)
    setBlocked(false)
    chatCursor.current = null
    puzzleServerState.current = ''
    const created = await run(() => request('/api/challenges', { token, method: 'POST', body: JSON.stringify({ gameType: selectedGame, stake }) }))
    if (created) { setMatch(created); setNotice('Reto publicado. Se descontarán los créditos cuando se una otra persona y comience la partida.'); }
    setBusy(false)
  }

  async function enterChallenge(challenge) {
    setBusy(true)
    setBlocked(false)
    chatCursor.current = null
    puzzleServerState.current = ''
    const joined = await run(() => request(`/api/challenges/${challenge.id}/join`, { token, method: 'POST', body: JSON.stringify({ stake: challenge.stake }) }))
    if (joined) { setMatch(joined); setChatMessages([]); }
    setBusy(false)
  }

  async function cancelChallenge() {
    if (!match) return
    await run(() => request(`/api/challenges/${match.id}`, { token, method: 'DELETE' }))
    setMatch(null); setNotice('Reto cancelado. Aún no se había descontado la apuesta.')
  }

  async function updateMatch(path, body) {
    const result = await run(() => request(`/api/challenges/${match.id}/${path}`, { token, method: 'POST', body: JSON.stringify(body) }))
    if (result) setMatch(result)
  }

  async function submitPuzzle() { const result = await run(() => request(`/api/challenges/${match.id}/puzzle`, { token, method: 'PUT', body: JSON.stringify({ pieces: puzzle }) })); if (result) setMatch(result) }

  async function submitWord(event) {
    event.preventDefault()
    const result = await run(() => request(`/api/challenges/${match.id}/word-answer`, { token, method: 'POST', body: JSON.stringify({ round: match.wordRound, answer: wordAnswer }) }))
    if (result) { setMatch(result.challenge); setWordAnswer(''); if (result.roundExpired) setNotice('Se agotaron los 35 segundos. Comienza el siguiente reto.'); else if (!result.correct) setNotice('Esa respuesta no es correcta. Puedes volver a intentarlo mientras corre el tiempo.'); }
  }

  async function sendMessage(event) {
    event.preventDefault(); if (!message.trim()) return
    const sent = await run(() => request(`/api/challenges/${match.id}/messages`, { token, method: 'POST', body: JSON.stringify({ body: message }) }))
    if (sent) { setChatMessages((all) => [...all, sent]); setMessage('') }
  }

  async function blockOpponent() {
    const opponentId = match.creatorId === account.id ? match.opponentId : match.creatorId
    if (!opponentId) return
    if (await run(() => request('/api/players/block', { token, method: 'POST', body: JSON.stringify({ playerId: opponentId }) }))) { setBlocked(true); setVoiceOn(false); stopVoice(); setNotice('Jugador bloqueado para el chat y la voz. La partida continúa.') }
  }

  async function report(channel) {
    const result = await run(() => request(`/api/challenges/${match.id}/reports`, { token, method: 'POST', body: JSON.stringify({ channel }) }))
    if (result) setNotice(`Reporte de ${channel === 'VOICE' ? 'voz' : 'texto'} enviado al administrador.`)
  }

  async function saveTrigger(event) {
    event.preventDefault()
    const body = Object.fromEntries(new FormData(event.currentTarget).entries())
    const saved = await run(() => request('/api/trigger-logs', { token, method: 'POST', body: JSON.stringify(body) }))
    if (saved) { setTriggerOpen(false); setNotice('Tu registro voluntario quedó guardado.') }
  }

  async function completeRest() {
    setVideoComplete(true)
    setRestUntil(0)
    const updated = await run(() => request('/api/auth/rest/complete', { token, method: 'POST' }))
    if (updated) setAccount(updated)
  }

  async function showReports() {
    const reports = await run(() => request('/api/admin/reports', { token }))
    if (reports) { setAdminReports(reports); setTab('reports') }
  }

  async function leaveMatch() {
    if (match?.status === 'ACTIVE') {
      const result = await run(() => request(`/api/challenges/${match.id}/forfeit`, { token, method: 'POST' }))
      if (result) setMatch(result)
    } else if (match?.status === 'WAITING') await cancelChallenge()
  }

  function movePiece(index) {
    const columns = match?.puzzleColumns || 1
    const target = index % columns < columns - 1 ? index + 1 : index - 1
    if (target < 0 || target >= puzzle.length) return
    const copy = [...puzzle]
    ;[copy[index], copy[target]] = [copy[target], copy[index]]
    setPuzzle(copy)
  }

  async function signOut() {
    if (match?.status === 'ACTIVE') {
      await run(() => request(`/api/challenges/${match.id}/forfeit`, { token, method: 'POST' }))
    } else if (match?.status === 'WAITING') {
      await cancelChallenge()
    }
    stopVoice()
    sessionStorage.removeItem('sim-token')
    setToken('')
    setAccount(null)
    setMatch(null)
    backendWaitStarted.current = Date.now()
    setBackendWaitSeconds(0)
  }

  function startVoice() {
    setVoiceOn(true); setError('')
    connectVoice().catch((err) => { setVoiceOn(false); setError(err.message || 'No fue posible iniciar la voz.') })
  }

  async function connectVoice() {
    const iceServers = JSON.parse(import.meta.env.VITE_WEBRTC_ICE_SERVERS || '[]')
    const pc = new RTCPeerConnection({ iceServers })
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach((track) => pc.addTrack(track, stream))
    pc.ontrack = (event) => { const audio = document.getElementById('remote-audio'); if (audio) audio.srcObject = event.streams[0] }
    pc.onicecandidate = ({ candidate }) => { if (candidate) postSignal(match.id, 'ICE', candidate.toJSON()) }
    voiceRef.current = { pc, stream, last: new Date(0).toISOString(), pendingCandidates: [] }
    const otherId = match.creatorId === account.id ? match.opponentId : match.creatorId
    if (account.id.localeCompare(otherId) < 0) {
      const offer = await pc.createOffer(); await pc.setLocalDescription(offer); await postSignal(match.id, 'OFFER', offer)
    }
  }

  async function postSignal(id, kind, payload) {
    await request(`/api/challenges/${id}/voice-signals`, { token, method: 'POST', body: JSON.stringify({ kind, payload: JSON.stringify(payload) }) })
  }

  function stopVoice() {
    voiceRef.current.pc?.close(); voiceRef.current.stream?.getTracks().forEach((track) => track.stop())
    voiceRef.current = { pc: null, stream: null, last: new Date(0).toISOString(), pendingCandidates: [] }
  }

  const secondsLeft = restUntil ? Math.max(0, Math.ceil((restUntil - now) / 1000)) : 0
  const videoUrl = import.meta.env.VITE_INFORMATIVE_VIDEO_URL
  const activeSeconds = account?.activePlaySeconds || 0
  const restSeconds = account?.restUntil ? Math.max(0, Math.ceil((new Date(account.restUntil).getTime() - now) / 1000)) : 0

  if (!token) return (
    <main className="auth-shell">
      <section className="auth-brand"><div className="brand-mark">◎</div><span className="eyebrow">SIMULADOR CON CRÉDITOS FICTICIOS</span><h1>Juegos con<br />créditos ficticios.</h1><p>Juegos entre personas con créditos ficticios. Sin dinero real.</p><div className="auth-note">Este espacio no sustituye ayuda profesional. Tú decides cuándo participar.</div></section>
      <form className="auth-card" onSubmit={authenticate}>
        <div className={`backend-status ${backendStatus === 'ready' ? 'is-ready' : ''}`} role="status" aria-live="polite">
          {backendStatus === 'ready' ? <span className="backend-status-icon">✓</span> : <span className="backend-spinner" aria-hidden="true" />}
          <div><strong>{backendStatus === 'ready' ? 'Servidor listo' : 'Esperando a que el servidor despierte…'}</strong><span>{backendStatus === 'ready' ? 'Ya puedes ingresar o crear tu cuenta.' : `Conectando · ${formatTime(backendWaitSeconds)}`}</span></div>
          {backendStatus !== 'ready' && <button type="button" className="backend-retry" onClick={() => setBackendRetry((value) => value + 1)}>Reintentar</button>}
        </div>
        <span className="eyebrow">{authMode === 'login' ? 'QUÉ BUENO VERTE' : 'EMPECEMOS'}</span><h2>{authMode === 'login' ? 'Ingresa a tu cuenta' : 'Crea tu cuenta'}</h2><p className="muted">{authMode === 'login' ? 'Continúa desde donde lo dejaste.' : 'Al registrarte recibes 10.000 créditos ficticios.'}</p>
        {authMode === 'register' && <label>Nombre<input name="name" required maxLength="80" disabled={backendStatus !== 'ready'} /></label>}
        <label>Gmail<input name="email" type="email" required autoComplete="email" disabled={backendStatus !== 'ready'} /></label><label>Contraseña<input name="password" type="password" required minLength="8" autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} disabled={backendStatus !== 'ready'} /></label>
        {authMode === 'register' && <label>¿Cómo conociste el juego?<input name="howKnown" required maxLength="300" disabled={backendStatus !== 'ready'} /></label>}
        {error && <p className="error">{error}</p>}<button className="primary wide" disabled={busy || backendStatus !== 'ready'}>{busy ? 'Un momento…' : authMode === 'login' ? 'Ingresar' : 'Crear cuenta'}</button><button className="link-button" type="button" disabled={backendStatus !== 'ready'} onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setError('') }}>{authMode === 'login' ? 'Crear una cuenta' : 'Ya tengo cuenta'}</button>
      </form>
    </main>
  )

  return (
    <div className="app-shell">
      <header className="topbar"><a className="brand" href="#inicio" onClick={(event) => { event.preventDefault(); if (match?.status === 'ACTIVE') void leaveMatch(); else { setMatch(null); setTab('games') } }}><span className="brand-mark small">◎</span><span>SIMULADOR<br /><small>créditos ficticios</small></span></a><div className="top-meta"><div className="balance"><span>CRÉDITOS FICTICIOS</span><strong>{(account?.credits || 0).toLocaleString('es-CO')}</strong></div><div className="time-chip"><span>TIEMPO ACTIVO HOY</span><strong>{formatTime(Math.max(0, 5400 - activeSeconds))} restante</strong></div><button className="avatar" title="Cerrar sesión" onClick={signOut}>{account?.name?.slice(0, 1).toUpperCase()}</button></div></header>
      <main className="page">
        {error && <div className="alert error-alert" role="alert">{error}<button onClick={() => setError('')}>×</button></div>}{notice && <div className="alert notice-alert">{notice}<button onClick={() => setNotice('')}>×</button></div>}{activeSeconds >= 5400 && <div className="alert notice-alert" role="status">Terminó tu tiempo de juego por este periodo de 24 horas. No puedes iniciar nuevas partidas.</div>}
        {match ? <section className="match-layout">
          <div className="match-main"><div className="section-heading"><button className="back-button" onClick={leaveMatch}>← Salir de partida</button><span className={`status-pill ${match.status.toLowerCase()}`}>{match.status === 'WAITING' ? 'Esperando rival' : match.status === 'ACTIVE' ? 'Partida activa' : 'Partida terminada'}</span></div><h1>{gameNames[match.gameType]}</h1><p className="muted">Apuesta por jugador: <strong>{match.stake.toLocaleString('es-CO')} créditos</strong></p>
            {match.status === 'WAITING' && <div className="waiting-card"><div className="pulse-dot"/><h2>Tu reto está en la fila</h2><p>Cuando alguien lo acepte con la misma apuesta, comenzará la partida y se descontarán los créditos.</p><button className="secondary" onClick={cancelChallenge}>Cancelar reto</button></div>}
            {match.status === 'ACTIVE' && <><div className="versus"><div><span>TÚ</span><strong>{account?.name}</strong></div><span className="versus-mark">VS</span><div><span>CONTRINCANTE</span><strong>{match.creatorId === account.id ? match.opponentName : match.creatorName}</strong></div></div>
              {match.gameType === 'COIN' && <div className="game-panel"><div className="coin-icon">◉</div><h2>Elige cara o sello</h2><p>Cada resultado tiene 50 % de probabilidad. El primer lado elegido corresponde a quien lo elige.</p><div className="choice-row"><button className="choice" onClick={() => updateMatch('coin', { side: 'CARA' })}>Cara</button><button className="choice" onClick={() => updateMatch('coin', { side: 'SELLO' })}>Sello</button></div></div>}
              {match.gameType === 'PUZZLE' && <div className="game-panel"><h2>{match.puzzleTitle || 'Rompecabezas'}</h2><p>Arrastra las piezas de tu tablero para ordenarlas. El otro tablero muestra el avance del contrincante.</p><div className="race-boards"><div><h3>Tu tablero</h3><div className="puzzle-grid" style={{ '--cols': match.puzzleColumns }}>{puzzle.map((piece,index) => <button draggable key={`${piece}-${index}`} aria-label={`Pieza ${piece}`} style={{ backgroundImage: match.puzzleImageUrl ? `url(${match.puzzleImageUrl})` : 'none', backgroundSize: `${match.puzzleColumns * 100}% ${match.puzzleRows * 100}%`, backgroundPosition: `${((match.puzzlePieceSourceIndices?.[piece] % match.puzzleColumns) / (match.puzzleColumns - 1)) * 100}% ${Math.floor(match.puzzlePieceSourceIndices?.[piece] / match.puzzleColumns) / (match.puzzleRows - 1) * 100}%` }} onClick={() => movePiece(index)} onDragStart={() => setDraggedIndex(index)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (draggedIndex !== null && draggedIndex !== index) { const copy=[...puzzle]; [copy[draggedIndex],copy[index]]=[copy[index],copy[draggedIndex]]; setPuzzle(copy) } setDraggedIndex(null) }}><span className="sr-only">{piece}</span></button>)}</div><button className="primary" onClick={submitPuzzle}>Enviar mi tablero</button></div><div><h3>Tablero del contrincante</h3><div className="puzzle-grid opponent-grid" style={{ '--cols': match.puzzleColumns }}>{(match.opponentPuzzleBoard || []).map((piece,index) => <div key={`${piece}-${index}`} aria-label={`Pieza ${piece}`} style={{ backgroundImage: match.puzzleImageUrl ? `url(${match.puzzleImageUrl})` : "none", backgroundSize: `${match.puzzleColumns * 100}% ${match.puzzleRows * 100}%`, backgroundPosition: `${((match.puzzlePieceSourceIndices?.[piece] % match.puzzleColumns) / (match.puzzleColumns - 1)) * 100}% ${Math.floor(match.puzzlePieceSourceIndices?.[piece] / match.puzzleColumns) / (match.puzzleRows - 1) * 100}%` }}><span className="sr-only">{piece}</span></div>)}</div></div></div></div>}
              {match.gameType === 'WORD' && <div className="game-panel"><span className="eyebrow">RETO {match.wordRound}</span><h2>{match.wordPrompt}</h2><p>Tiempo para responder: {Math.max(0,Math.ceil((new Date(match.wordDeadline).getTime()-now)/1000))} segundos</p><form className="answer-form" onSubmit={submitWord}><input value={wordAnswer} onChange={(event) => setWordAnswer(event.target.value)} placeholder="Escribe tu respuesta" maxLength="200" required /><button className="primary">Responder</button></form><p className="small-note">Si nadie acierta, aparece otro reto y la partida continúa.</p></div>}
            </>}
            {match.status === 'FINISHED' && <div className="result-card"><span className="eyebrow">RESULTADO</span><h2>{match.winnerId === account.id ? 'Ganaste la partida' : 'La partida terminó'}</h2><p>{match.gameType === 'COIN' ? `Salió ${match.coinResult?.toLowerCase()}. ` : ''}El saldo ficticio refleja el resultado de la partida.</p><div className="post-game"><div className="video-box">{videoUrl ? <video controls onEnded={completeRest} src={videoUrl} /> : <div><span>VIDEO INFORMATIVO</span><p>Falta agregar la URL del video.</p></div>}</div><div className="rest-box"><span className="eyebrow">PAUSA DE CINCO MINUTOS</span><strong>{videoComplete ? 'Pausa cancelada' : secondsLeft ? formatTime(secondsLeft) : '5:00'}</strong><p>{videoComplete ? 'Puedes continuar.' : 'Al terminar el video, la espera se cancela.'}</p><button className="primary" disabled={!videoComplete && secondsLeft > 0} onClick={() => { setMatch(null); setRestUntil(0); setChatMessages([]) }}>{!videoComplete && secondsLeft > 0 ? 'Descanso en curso' : 'Continuar'}</button></div></div></div>}
          </div>
          {match.status === 'ACTIVE' && <aside className="match-side"><div className="chat-card"><div className="card-heading"><div><span className="eyebrow">DURANTE LA PARTIDA</span><h2>Chat</h2></div></div><div className="chat-messages">{chatMessages.map((item) => <div className={`chat-message ${item.senderId === account.id ? 'mine' : ''}`} key={item.id}><span>{item.senderId === account.id ? 'Tú' : 'Contrincante'}</span><p>{chatMuted && item.senderId !== account.id ? 'Mensaje silenciado' : item.body}</p></div>)}{chatMessages.length === 0 && <p className="empty-chat">Los mensajes de esta partida aparecerán aquí.</p>}</div><form className="chat-form" onSubmit={sendMessage}><input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Escribe un mensaje" maxLength="1000" /><button aria-label="Enviar mensaje">↑</button></form><div className="chat-actions"><button onClick={() => setChatMuted(!chatMuted)}>{chatMuted ? 'Mostrar texto' : 'Silenciar texto'}</button><button onClick={blocked ? undefined : blockOpponent}>{blocked ? 'Jugador bloqueado' : 'Bloquear'}</button><button onClick={() => report('TEXT')}>Reportar texto</button></div><div className="voice-row"><button disabled={blocked} className={voiceOn ? 'voice-active' : ''} onClick={() => voiceOn ? (stopVoice(),setVoiceOn(false)) : startVoice()}>{voiceOn ? 'Desactivar voz' : 'Activar voz'}</button><button onClick={() => setMuted(!muted)}>{muted ? 'Activar audio' : 'Silenciar audio'}</button><button onClick={() => report('VOICE')}>Reportar voz</button><audio id="remote-audio" autoPlay muted={muted} /></div>{voiceOn && <p className="small-note">La voz requiere permiso de micrófono y configuración ICE para conectar redes.</p>}</div></aside>}
        </section> : tab === 'reports' ? <section className="dashboard"><div className="section-heading"><div><span className="eyebrow">ADMINISTRACIÓN</span><h1>Reportes recibidos</h1></div><button className="secondary" onClick={() => setTab('games')}>Volver</button></div><div className="report-list">{adminReports.map((report) => <article className="report-row" key={report.id}><strong>{report.channel}</strong><span>Partida: {report.challengeId}</span><span>Reportado: {report.reportedPlayerId}</span><time>{new Date(report.createdAt).toLocaleString()}</time></article>)}{adminReports.length === 0 && <p className="empty-state">Todavía no hay reportes.</p>}</div></section> : <section className="dashboard"><div className="welcome-row"><div><span className="eyebrow">ESPACIO DE JUEGO</span><h1>Hola, {account?.name?.split(' ')[0]}.</h1><p>Elige una actividad y una apuesta en créditos ficticios.</p></div><div className="credit-card"><span>SALDO</span><strong>{(account?.credits || 0).toLocaleString('es-CO')}</strong><small>créditos ficticios</small></div></div><div className="limit-banner"><span>◷</span><p><strong>Hasta 90 minutos de partidas activas por cada periodo de 24 horas.</strong><br />Tiempo disponible: {formatTime(Math.max(0,5400-activeSeconds))}</p><button onClick={() => setTriggerOpen(true)}>Registrar desencadenante</button></div>{account?.restUntil && <div className="post-game"><div className="waiting-card rest-banner"><span className="eyebrow">DESCANSO DESPUÉS DE LA PARTIDA</span><h2>{restSeconds ? `Espera ${formatTime(restSeconds)}` : 'Puedes continuar'}</h2>{videoUrl && <video controls onEnded={completeRest} src={videoUrl} />}<p>{restSeconds ? 'Puedes ver el video informativo; si lo terminas, el descanso se cancela.' : 'El descanso terminó.'}</p><button className="primary" disabled={restSeconds > 0} onClick={() => setAccount({ ...account, restUntil: null })}>Continuar</button></div></div>}<div className="section-heading"><div><span className="eyebrow">ELIGE UNA ACTIVIDAD</span><h2>Juegos disponibles</h2></div>{account?.role === 'ADMIN' && <button className="secondary" onClick={showReports}>Ver reportes</button>}</div><div className="game-cards">{games.map((game,index) => <button className={`game-card game-${index}`} key={game.id} disabled={!game.available} onClick={() => setSelectedGame(game.id)}><span className="game-symbol">{['◉','▧','Aa'][index]}</span><span className="game-number">0{index+1}</span><h3>{game.name}</h3><p>{game.id === 'COIN' ? 'Elige cara o sello con igual probabilidad.' : game.id === 'PUZZLE' ? 'Resuelve la misma imagen que el contrincante.' : 'Responde antes que la otra persona.'}</p><span className="availability">{game.available ? 'Disponible' : 'Contenido por cargar'}</span></button>)}</div><div className="lobby-section"><div className="section-heading"><div><span className="eyebrow">RETO PÚBLICO</span><h2>Unirse a otra persona</h2></div><button className="text-button" onClick={() => run(loadLobby)}>Actualizar lista ↻</button></div><div className="lobby-list">{challenges.map((challenge) => <article className="lobby-row" key={challenge.id}><div className="game-symbol mini">{challenge.gameType === 'COIN' ? '◉' : challenge.gameType === 'PUZZLE' ? '▧' : 'Aa'}</div><div className="lobby-info"><strong>{challenge.creatorName}</strong><span>{gameNames[challenge.gameType]}</span></div><div className="lobby-stake"><span>APUESTA</span><strong>{challenge.stake.toLocaleString('es-CO')}</strong></div><button className="primary" disabled={busy} onClick={() => enterChallenge(challenge)}>Unirme</button></article>)}{challenges.length === 0 && <p className="empty-state">No hay retos esperando. Publica uno para que alguien pueda unirse.</p>}</div></div><div className="create-panel"><div><span className="eyebrow">PUBLICA UN RETO</span><h2>¿Qué quieres jugar?</h2><p className="muted">La apuesta se descuenta al comenzar.</p></div><div className="create-controls"><select value={selectedGame} onChange={(event) => setSelectedGame(event.target.value)}>{games.map((game) => <option key={game.id} value={game.id} disabled={!game.available}>{game.name}{!game.available ? ' — contenido pendiente' : ''}</option>)}</select><div className="stake-buttons">{STAKES.map((amount) => <button type="button" key={amount} className={stake === amount ? 'selected' : ''} onClick={() => setStake(amount)}>{amount.toLocaleString('es-CO')}</button>)}</div><button className="primary" disabled={busy || !games.find((game) => game.id === selectedGame)?.available || account?.credits < stake || activeSeconds >= 5400 || restSeconds > 0} onClick={createChallenge}>Publicar reto</button></div></div></section>}
      </main>
      {triggerOpen && <div className="modal-backdrop" role="presentation"><form className="trigger-modal" onSubmit={saveTrigger}><button className="close-button" type="button" onClick={() => setTriggerOpen(false)}>×</button><span className="eyebrow">REGISTRO VOLUNTARIO</span><h2>¿Qué estaba pasando?</h2><p>Comparte solo lo que quieras. Puedes dejar preguntas en blanco.</p><label>¿Qué estaba pasando justo antes de que sintieras ganas de jugar?<textarea name="situationBefore" rows="2" /></label><label>¿Qué sentías o pensabas?<textarea name="thoughtsOrFeelings" rows="2" /></label><label>¿Qué tan fuerte era el impulso?<input name="urgeIntensity" maxLength="100" placeholder="Descríbelo con tus palabras" /></label><label>¿Qué hiciste después?<textarea name="actionAfter" rows="2" /></label><label>¿Algo te ayudó?<textarea name="helpfulness" rows="2" /></label><label>¿Sientes que este juego te ayuda?<textarea name="perceivedHelpfulnessOfGame" rows="2" /></label><button className="primary wide">Guardar registro</button></form></div>}
    </div>
  )
}
export default App
