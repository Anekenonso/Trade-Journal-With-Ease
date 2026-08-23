import { useEffect, useRef, useState } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { createWorker } from 'tesseract.js';
import type { SelectedImage, Trade } from './types/trade';
import { ACCEPTED_IMAGE_TYPES, APP_NAME, CREATOR_HANDLE, CREATOR_URL, MAX_IMAGES } from './config/app';
import { parseTrade } from './services/extraction/parser';
import { parseTrades } from './services/extraction/mt5';
import { exportWorkbook } from './services/excel/export';
import { resultFor, tradeSummary } from './utils/calculations';

type Step = 'home' | 'upload' | 'processing' | 'results' | 'review' | 'download';
const emptyConfidence = { instrument: 0, direction: 0, entryPrice: 0, stopLoss: 0, takeProfit: 0, exitPrice: 0, profitLoss: 0 };
const fields: { key: keyof Trade; label: string; type?: string }[] = [
  {key:'instrument',label:'Instrument'}, {key:'direction',label:'Direction'}, {key:'entryPrice',label:'Entry Price',type:'number'}, {key:'stopLoss',label:'Stop Loss',type:'number'}, {key:'takeProfit',label:'Take Profit',type:'number'}, {key:'exitPrice',label:'Exit Price',type:'number'}, {key:'positionSize',label:'Position Size',type:'number'}, {key:'profitLoss',label:'P&L',type:'number'}, {key:'date',label:'Date',type:'date'}, {key:'time',label:'Time',type:'time'}
];
export default function App() {
  const [step, setStep] = useState<Step>('home'); const [images, setImages] = useState<SelectedImage[]>([]); const [trades, setTrades] = useState<Trade[]>([]); const [active, setActive] = useState(0); const [notice, setNotice] = useState(''); const [processing, setProcessing] = useState(false); const [aiReviewStatus, setAiReviewStatus] = useState<'checking' | 'secure-ai' | 'local-only'>('checking'); const [aiReviewEnabled, setAiReviewEnabled] = useState(true); const input = useRef<HTMLInputElement>(null); const imagesRef = useRef<SelectedImage[]>([]);
  useEffect(() => { imagesRef.current = images; }, [images]);
  useEffect(() => {
    let active = true;
    fetch('/api/health')
      .then(response => response.json())
      .then(data => {
        if (!active) return;
        setAiReviewStatus(data?.aiReviewEnabled ? 'secure-ai' : 'local-only');
      })
      .catch(() => {
        if (!active) return;
        setAiReviewStatus('local-only');
      });
    return () => { active = false; };
  }, []);
  useEffect(() => () => imagesRef.current.forEach(i => URL.revokeObjectURL(i.url)), []);
  const selectFiles = (files: FileList | null) => { if (!files) return; const incoming = Array.from(files); const unsupported = incoming.filter(f => !ACCEPTED_IMAGE_TYPES.includes(f.type)); const allowed = incoming.filter(f => ACCEPTED_IMAGE_TYPES.includes(f.type)); const remaining = MAX_IMAGES - images.length;
    if (unsupported.length) setNotice('Some files were skipped because only JPG, PNG, and WEBP images are supported.');
    if (allowed.length > remaining) { setNotice(`You can upload a maximum of ${MAX_IMAGES} images per session.`); allowed.splice(remaining); }
    if (allowed.length) { setImages(prev => [...prev, ...allowed.map(file => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file), status: 'pending' as const }))]); setStep('upload'); }
    if (input.current) input.current.value = '';
  };
  const removeImage = (id: string) => setImages(prev => { const found = prev.find(x=>x.id===id); if (found) URL.revokeObjectURL(found.url); return prev.filter(x => x.id !== id); });
  const clearAll = () => { images.forEach(i=>URL.revokeObjectURL(i.url)); setImages([]); setTrades([]); setNotice(''); setStep('home'); };
  const process = async () => { setStep('processing'); setProcessing(true); setTrades([]); let worker: Awaited<ReturnType<typeof createWorker>> | undefined;
    try { worker = await createWorker('eng'); const output: Trade[] = []; for (let index=0; index<images.length; index++) { const image = images[index]; setImages(prev=>prev.map((x,i)=>i===index?{...x,status:'processing'}:x)); try { const { data } = await worker.recognize(image.file); const parsed = await parseTrades(data.text, image.file.name, image.url, { aiReviewEnabled: aiReviewEnabled && aiReviewStatus === 'secure-ai' }); output.push(...parsed); setImages(prev=>prev.map((x,i)=>i===index?{...x,status:'done'}:x)); } catch { setImages(prev=>prev.map((x,i)=>i===index?{...x,status:'failed',error:'Extraction failed'}:x)); output.push({id:crypto.randomUUID(),sourceFileName:image.file.name,sourceUrl:image.url,confidence:emptyConfidence,needsReview:true}); } } setTrades(output); setActive(0); setStep('results'); }
    catch { setNotice('OCR could not start in this browser. You can still add each trade manually in the review screen.'); const fallback = images.map(i=>({id:crypto.randomUUID(),sourceFileName:i.file.name,sourceUrl:i.url,confidence:emptyConfidence,needsReview:true})); setTrades(fallback); setStep('results'); }
    finally { if (worker) await worker.terminate(); setProcessing(false); }
  };
  const updateTrade = (key: keyof Trade, value: string) => setTrades(prev => prev.map((t,i) => i !== active ? t : {...t, [key]: ['entryPrice','stopLoss','takeProfit','exitPrice','positionSize','profitLoss'].includes(String(key)) ? (value === '' ? undefined : Number(value)) : value || undefined, needsReview: !t.instrument || !t.direction || t.entryPrice === undefined || t.profitLoss === undefined }));
  const deleteTrade = () => { setTrades(prev=>prev.filter((_,i)=>i!==active)); setActive(a=>Math.max(0,a-1)); setStep('results'); };
  const summary = tradeSummary(trades); const current = trades[active];
  return <div className="app"><header><a className="brand" href="#top" onClick={()=>setStep('home')}><span>▦</span>{APP_NAME}</a><nav><a href="#how">How it works</a><a href="#privacy">Privacy</a><a href="#about">About</a></nav></header>
    <input ref={input} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e=>selectFiles(e.target.files)} />
    {notice && <div className="notice"><span>{notice}</span><button onClick={()=>setNotice('')}>×</button></div>}
    <main id="top">
      <div className="status-strip" style={{display:'flex', justifyContent:'center', alignItems:'center', gap:'12px', margin:'12px 0 0', flexWrap:'wrap'}}>
        <span className="badge" style={{background: aiReviewStatus === 'secure-ai' ? '#dff9eb' : '#f6f3d8', color: '#1a1f22', border:'1px solid rgba(0,0,0,0.08)'}}>
          {aiReviewStatus === 'checking' ? 'Checking AI review status…' : aiReviewStatus === 'secure-ai' ? 'AI review: secure backend enabled' : 'Privacy mode: local-only'}
        </span>
        <button
          className="outline"
          onClick={() => setAiReviewEnabled(value => !value)}
          style={{padding:'8px 12px', fontSize:'0.8rem'}}
          type="button"
        >
          {aiReviewEnabled ? 'AI review: on' : 'AI review: off'}
        </button>
      </div>
      {(!aiReviewEnabled || aiReviewStatus !== 'secure-ai') && (
        <div className="notice" style={{marginTop:'12px'}}>
          <span>{!aiReviewEnabled ? 'AI review is disabled. The app is running in local extraction mode only.' : 'AI review is unavailable. Falling back to local extraction only.'}</span>
        </div>
      )}
      {step==='home' && <section className="hero"><div className="eyebrow">PRIVATE • BROWSER-ONLY • NO SIGN-UP</div><h1>Turn your trade screenshots into an Excel journal</h1><p>Upload up to 15 screenshots from MT4, MT5 or TradingView. We’ll extract the trade data and create an organized Excel file for you.</p><div className="actions"><button className="primary" onClick={()=>input.current?.click()}>Upload Trade Screenshots <b>→</b></button><span>JPG, PNG, WEBP · Up to 15 images</span></div><div className="privacy-card">🔒 <div><strong>Your data stays on your device.</strong><br/>We don’t store your screenshots or trading data.</div></div><div className="steps"><div><b>1</b><strong>Upload screenshots</strong><span>Select your MT4, MT5 or TradingView images.</span></div><div><b>2</b><strong>Review extracted data</strong><span>Correct anything that needs attention.</span></div><div><b>3</b><strong>Download your journal</strong><span>Get a clean Excel workbook instantly.</span></div></div></section>}
      {step==='upload' && <section className="panel"><div className="section-head"><div><p className="eyebrow">STEP 1 OF 3</p><h2>Selected images</h2><p>{images.length} of {MAX_IMAGES} images selected</p></div><button className="text-btn danger" onClick={clearAll}>Clear all</button></div><div className="preview-grid">{images.map(img=><article className="preview" key={img.id}><img src={img.url} alt="Selected trading screenshot"/><div><span title={img.file.name}>{img.file.name}</span><button aria-label={`Remove ${img.file.name}`} onClick={()=>removeImage(img.id)}>×</button></div></article>)}<button className="add-card" onClick={()=>input.current?.click()}>＋<span>Add images</span></button></div><div className="toolbar"><button className="outline" onClick={()=>input.current?.click()}>Add images</button><button className="primary" disabled={!images.length} onClick={process}>Process images →</button></div></section>}
      {step==='processing' && <section className="panel processing"><div className="spinner"/><p className="eyebrow">LOCAL PROCESSING</p><h2>Processing your screenshots…</h2><p>{images.filter(i=>i.status==='done'||i.status==='failed').length} / {images.length} completed</p><div className="progress"><i style={{width:`${(images.filter(i=>i.status==='done'||i.status==='failed').length / Math.max(images.length,1))*100}%`}}/></div><div className="status-list">{images.map(i=><div key={i.id}><span>{i.status==='done'?'✓':i.status==='failed'?'⚠':i.status==='processing'?'◌':'○'}</span><b>{i.file.name}</b><em>{i.status==='done'?'Extracted':i.status==='failed'?'Extraction failed':i.status==='processing'?'Processing':'Pending'}</em></div>)}</div><small>Please don’t close or refresh this page while processing.</small></section>}
      {step==='results' && <section className="panel"><div className="section-head"><div><p className="eyebrow">STEP 2 OF 3</p><h2>Extracted trade data</h2><p>{trades.length} trades extracted · <span className="success">{trades.filter(t=>!t.needsReview).length} ready</span> · <span className="warning">{trades.filter(t=>t.needsReview).length} need review</span></p></div><button className="outline" onClick={()=>setStep('upload')}>← Back to upload</button></div><div className="table-wrap"><table><thead><tr><th>#</th><th>Instrument</th><th>Direction</th><th>Entry</th><th>SL</th><th>TP</th><th>Exit</th><th>P&L</th><th>Status</th><th/></tr></thead><tbody>{trades.map((t,i)=><tr key={t.id}><td>{i+1}</td><td>{t.instrument||'—'}</td><td><span className={t.direction==='BUY'?'buy':'sell'}>{t.direction||'—'}</span></td><td>{t.entryPrice??'—'}</td><td>{t.stopLoss??'—'}</td><td>{t.takeProfit??'—'}</td><td>{t.exitPrice??'—'}</td><td className={(t.profitLoss??0)>0?'positive':(t.profitLoss??0)<0?'negative':''}>{t.profitLoss??'—'}</td><td><span className={t.needsReview?'badge warning-bg':'badge success-bg'}>{t.needsReview?'⚠ Needs review':'✓ Extracted'}</span></td><td><button className="text-btn" onClick={()=>{setActive(i);setStep('review')}}>Review</button></td></tr>)}</tbody></table></div><div className="toolbar"><button className="outline" onClick={()=>setStep('upload')}>Add more images</button><button className="primary" disabled={!trades.length} onClick={()=>setStep('review')}>Review trades →</button></div></section>}
      {step==='review' && current && <section className="review"><div className="review-head"><div><p className="eyebrow">STEP 2 OF 3 · TRADE {active+1} OF {trades.length}</p><h2>Review & edit trade</h2></div><button className="outline" onClick={()=>setStep('results')}>← Back to results</button></div><div className="review-grid"><div className="image-panel"><img src={current.sourceUrl} alt={current.sourceFileName}/><p>{current.sourceFileName}</p></div><div className="form-panel"><p className="hint">Fields with an amber marker need your review.</p><div className="fields">{fields.map(f=>{const low = f.key==='instrument'?current.confidence.instrument<.7:f.key==='direction'?current.confidence.direction<.7:['entryPrice','stopLoss','takeProfit','exitPrice','profitLoss'].includes(String(f.key)) && current.confidence[f.key as 'entryPrice']<.7; return <label key={String(f.key)}>{f.label}{low&&<span className="low">⚠</span>}{f.key==='direction'?<select value={current.direction??''} onChange={e=>updateTrade(f.key,e.target.value)}><option value="">Select direction</option><option>BUY</option><option>SELL</option></select>:<input type={f.type??'text'} value={(current[f.key] as string|number|undefined)??''} onChange={e=>updateTrade(f.key,e.target.value)}/>}</label>})}</div><label>Notes<textarea value={current.notes??''} onChange={e=>updateTrade('notes',e.target.value)} placeholder="Optional notes"/></label><div className="review-actions"><button className="danger outline" onClick={deleteTrade}>Delete trade</button><span/><button className="outline" disabled={active===0} onClick={()=>setActive(active-1)}>← Previous</button><button className="primary" onClick={()=>active<trades.length-1?setActive(active+1):setStep('results')}>{active<trades.length-1?'Save & next →':'Save changes'}</button></div></div></div></section>}
      {step==='download' && <section className="done"><div className="check">✓</div><p className="eyebrow">EXPORT COMPLETE</p><h1>All done!</h1><p>Your Excel file is ready to download.</p><div className="file">▦ <span>trade_journal_{new Date().toISOString().slice(0,10)}.xlsx</span></div><button className="primary" onClick={()=>exportWorkbook(trades)}>Download Excel file ↓</button><button className="text-btn" onClick={clearAll}>Start over</button></section>}
    </main>{step==='results'&&<aside className="summary"><b>Journal summary</b><span>Total P&L <strong className={summary.total>=0?'positive':'negative'}>{summary.total.toFixed(2)}</strong></span><span>Win rate <strong>{summary.winRate===undefined?'—':`${(summary.winRate*100).toFixed(0)}%`}</strong></span><button className="primary" onClick={()=>{exportWorkbook(trades);setStep('download')}}>Generate Excel →</button></aside>}<footer id="privacy"><span>🔒 Your screenshots and trade data never leave this browser.</span><span>Built with ♥ by <a href={CREATOR_URL} target="_blank" rel="noreferrer">{CREATOR_HANDLE}</a></span></footer><Analytics /></div>;
}
