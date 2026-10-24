import { useCallback, useEffect, useState } from 'react';
import { Activity, ArrowDownLeft, ArrowUpRight, Check, CircleHelp, Clock3, Leaf, LogOut, Menu, Plus, RefreshCw, ShieldCheck, Sprout, Truck, X } from 'lucide-react';
import { api } from './api.js';
import { useAuth } from './AuthContext.jsx';
import { useNavigate } from 'react-router-dom';

const fmtDate = d => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const todayLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase();
const categories = ['Produce','Prepared meals','Bakery','Dairy','Pantry','Other'];

export default function Dashboard() {
  const { user, logout } = useAuth(), navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null), [donations, setDonations] = useState([]), [loading, setLoading] = useState(true);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [modal, setModal] = useState(''), [selected, setSelected] = useState(null);
  const [audit, setAudit] = useState(null), [mobileNav, setMobileNav] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const [dash, list] = await Promise.all([api.dashboard(), api.donations()]); setDashboard(dash); setDonations(list); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const flash = msg => { setNotice(msg); setTimeout(() => setNotice(''), 3500); };
  const openDetail = donation => { setSelected(donation); setModal('detail'); };
  const createDonation = async body => { await api.create(body); setModal(''); flash('Donation posted. It is now visible to recipient partners.'); await load(); };
  const updateDonation = async body => { await api.update(selected._id, body); setModal(''); flash('Donation details updated.'); await load(); };
  const reserve = async (d, body) => { await api.reserve(d._id, body); setModal(''); flash('Reservation confirmed. Coordinate pickup with the donor.'); await load(); };
  const collect = async (d, r) => { await api.collect(d._id, r._id); flash('Collection marked complete.'); setModal(''); await load(); };
  const signOut = async () => { try { await logout(); navigate('/', { replace: true }); } catch (e) { flash(`Could not sign out: ${e.message}`); } };
  const checkAudit = async () => { try { setAudit(await api.verify()); } catch (e) { flash(e.message); } };

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
      <div className="brand"><div className="brand-mark"><Sprout size={20}/></div><span>veylora</span></div>
      <div className="workspace-label">WORKSPACE</div>
      <nav><button className="nav-item active" onClick={() => {window.scrollTo({top:0,behavior:'smooth'});setMobileNav(false)}}><Activity size={17}/> Overview</button><button className="nav-item" onClick={() => {document.getElementById('donations')?.scrollIntoView({behavior:'smooth'});setMobileNav(false)}}><ArrowDownLeft size={17}/> Donations <span className="nav-count">{donations.length}</span></button></nav>
      <div className="sidebar-bottom"><div className="impact-mini"><div className="mini-icon"><Leaf size={16}/></div><div><b>Small acts, real impact.</b><span>Every rescued kilo counts.</span></div></div><div className="profile"><div className="avatar">{user?.role === 'recipient' ? 'R' : 'D'}</div><div className="profile-copy"><b>{user?.organizationName}</b><span>{user?.name} · {user?.role}</span></div></div><button className="sidebar-logout" onClick={signOut}><LogOut size={15}/> Sign out</button></div>
    </aside>
    {mobileNav && <button className="scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)}/>}
    <main className="main">
      <header className="topbar"><button className="icon-button menu-button" onClick={() => setMobileNav(!mobileNav)} aria-label="Toggle menu"><Menu size={20}/></button><div className="breadcrumbs">Workspace <span>/</span> Overview</div><div className="top-actions"><span className="live-dot"></span><span className="live-label">{user?.organizationName}</span><span className="role-pill">{user?.role}</span></div></header>
      <div className="content">
        {notice && <div className="toast"><Check size={16}/>{notice}<button onClick={() => setNotice('')} aria-label="Dismiss"><X size={15}/></button></div>}
        {error && <div className="error-banner"><CircleHelp size={18}/><div><b>Can’t reach the Veylora API</b><span>{error}. Start MongoDB and the server, then retry.</span></div><button className="button secondary small" onClick={load}><RefreshCw size={14}/> Retry</button></div>}
        <div className="page-heading"><div><div className="eyebrow">{todayLabel} <span className="heading-dot">·</span> YOUR IMPACT, IN MOTION</div><h1>Good morning<span className="period">.</span></h1><p>Surplus becomes sustenance when we move together.</p></div>{user?.role==='donor'&&<button className="button primary" onClick={() => setModal('create')}><Plus size={17}/> Post a donation</button>}</div>
        <section className="metrics" aria-label="Impact overview">
          <Metric icon={<ArrowUpRight size={17}/>} label="Food recovered" value={loading ? '—' : `${dashboard?.collectedKg ?? 0} kg`} sub="Collected by recipient partners" accent="green" />
          <Metric icon={<Leaf size={17}/>} label="Estimated emissions avoided" value={loading ? '—' : `${dashboard?.impactEstimateKgCo2e ?? 0} kg`} sub="Estimate · based on recovered food" accent="sage" />
          <Metric icon={<Clock3 size={17}/>} label="Reserved for pickup" value={loading ? '—' : `${dashboard?.reservedKg ?? 0} kg`} sub="Awaiting collection" accent="sand" />
          <Metric icon={<Activity size={17}/>} label="Active listings" value={loading ? '—' : dashboard?.availableListings ?? 0} sub="Open to recipient partners" accent="charcoal" />
        </section>
        <section className="content-grid">
          <div className="panel donation-panel" id="donations"><div className="panel-head"><div><div className="eyebrow">THE COMMUNITY EXCHANGE</div><h2>Recent donations</h2></div><button className="text-button" onClick={load}>Refresh list <RefreshCw size={13}/></button></div>
            {loading ? <div className="state-box"><span className="spinner"/> Loading donations…</div> : donations.length === 0 ? <div className="empty-state"><div className="empty-icon"><Sprout size={23}/></div><b>{user?.role==='donor'?'Your first listing starts the loop.':'No open donations just yet.'}</b><span>{user?.role==='donor'?'Share safe surplus with community partners.':'Check back soon as local donors add available food.'}</span>{user?.role==='donor'&&<button className="button primary" onClick={() => setModal('create')}><Plus size={16}/> Post a donation</button>}</div> : <div className="table-wrap"><table><thead><tr><th>FOOD & DONOR</th><th>QUANTITY</th><th>PICKUP BY</th><th>STATUS</th><th></th></tr></thead><tbody>{donations.slice(0,8).map(d => <tr key={d._id} onClick={() => openDetail(d)} className="click-row"><td><div className="food-cell"><div className={`food-icon food-${d.category.toLowerCase().replace(' ','-')}`}><Sprout size={16}/></div><div><b>{d.foodName}</b><span>{d.donor} · {d.category}</span></div></div></td><td className="quantity">{d.quantityKg} <small>kg</small></td><td className="date-cell">{fmtDate(d.pickupDeadline)}</td><td><Status status={d.status}/></td><td><button className="row-arrow" aria-label={`View ${d.foodName}`}><ArrowUpRight size={16}/></button></td></tr>)}</tbody></table></div>}
            {!loading && donations.length > 0 && <div className="table-foot"><span>Showing {Math.min(donations.length,8)} of {donations.length} donations</span><span><span className="tiny-dot"/> Updated just now</span></div>}
          </div>
          <aside className="right-column">
            <div className="impact-card"><div className="impact-top"><div className="impact-icon"><Leaf size={20}/></div><span>IMPACT, ESTIMATED</span></div><div className="impact-number">{loading ? '—' : dashboard?.impactEstimateKgCo2e ?? 0}<span> kg CO₂e</span></div><p>Potential emissions avoided through food already collected by the network.</p><div className="impact-divider"/><div className="impact-method"><span>CALCULATION BASIS</span><p>Recovered food × {dashboard?.impactMethod?.factorKgCo2ePerKg ?? '—'} kg CO₂e per kg</p><button onClick={() => setAudit(audit ? null : {method:true})}>How we estimate <ArrowUpRight size={14}/></button></div>{audit?.method && <div className="method-note">{dashboard?.impactMethod?.basis} Completed rescues preserve the factor used. The result is an estimate, not a measured or independently verified outcome.</div>}</div>
            <div className="panel activity-panel"><div className="panel-head compact"><div><div className="eyebrow">KEEP THINGS MOVING</div><h2>Next steps</h2></div></div><div className="step-row"><div className="step-icon"><Truck size={17}/></div><div><b>Browse open donations</b><span>Reserve what your community needs.</span></div><button onClick={() => document.getElementById('donations')?.scrollIntoView({behavior:'smooth'})}><ArrowUpRight size={15}/></button></div><div className="step-row"><div className="step-icon"><ShieldCheck size={17}/></div><div><b>Audit trail integrity</b><span>{audit && !audit.method ? audit.valid ? `Verified · ${audit.checkedEntries} events` : `Chain issue at event ${audit.brokenAt}` : 'Verify the hash-linked event log.'}</span></div><button onClick={checkAudit} aria-label="Verify audit trail"><RefreshCw size={15}/></button></div></div>
            <div className="quote-card"><span className="quote-mark">“</span><p>Waste is a design flaw. Recovery is a choice we make together.</p><span className="quote-source">THE VEYLORA PRINCIPLE</span></div>
          </aside>
        </section>
        <footer className="footer"><span>© 2026 Veylora</span><span>Recover value. Reveal impact.</span><button onClick={checkAudit}><ShieldCheck size={14}/> Audit integrity</button></footer>
      </div>
    </main>
    {modal === 'create' && <DonationModal user={user} onClose={() => setModal('')} onSave={createDonation}/>}
    {modal === 'edit' && selected && <DonationModal user={user} donation={selected} onClose={() => setModal('detail')} onSave={updateDonation}/>}
    {modal === 'detail' && selected && <DetailModal donation={donations.find(d=>d._id===selected._id) || selected} user={user} onEdit={d=>{setSelected(d);setModal('edit')}} onClose={() => setModal('')} onReserve={reserve} onCollect={collect}/>}
  </div>;
}

function Metric({icon,label,value,sub,accent}) { return <div className="metric-card"><div className={`metric-icon ${accent}`}>{icon}</div><div className="metric-label">{label}</div><div className="metric-value">{value}</div><div className="metric-sub">{sub}</div></div>; }
function Status({status}) { const labels={available:'Available',reserved:'Reserved',collected:'Collected',expired:'Expired'};return <span className={`status status-${status}`}><i/>{labels[status]||status}</span>; }

function DonationModal({user,donation,onClose,onSave}) {
  const [form,setForm]=useState(()=>donation?{foodName:donation.foodName,category:donation.category,quantityKg:donation.quantityKg,donor:donation.donor,pickupLocation:donation.pickupLocation,pickupDeadline:new Date(new Date(donation.pickupDeadline).getTime()-new Date(donation.pickupDeadline).getTimezoneOffset()*60000).toISOString().slice(0,16),handlingNotes:donation.handlingNotes||'',allergens:donation.allergens||''}:{foodName:'',category:'Produce',quantityKg:'',donor:user?.organizationName||'',pickupLocation:'',pickupDeadline:'',handlingNotes:'',allergens:''}),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const change=e=>setForm({...form,[e.target.name]:e.target.value});
  const submit=async e=>{e.preventDefault();setBusy(true);setError('');try{await onSave({...form,quantityKg:Number(form.quantityKg),pickupDeadline:new Date(form.pickupDeadline).toISOString()});}catch(err){setError(err.message);}finally{setBusy(false);}};
  return <Modal title={donation?'Edit donation':'Post a donation'} subtitle={donation?'Keep pickup details accurate for recipient partners.':'Share good food with a nearby community.'} onClose={onClose}><form className="form" onSubmit={submit}><div className="form-grid"><Field label="Food name" required><input name="foodName" value={form.foodName} onChange={change} placeholder="e.g. Seasonal vegetable boxes" maxLength="100" required/></Field><Field label="Category" required><select name="category" value={form.category} onChange={change}>{categories.map(c=><option key={c}>{c}</option>)}</select></Field><Field label="Quantity" required><div className="input-unit"><input type="number" name="quantityKg" min={donation ? donation.reservedKg || 0.1 : 0.1} step="0.1" value={form.quantityKg} onChange={change} placeholder="0.0" required/><span>kg</span></div></Field><Field label="Donor / organization" required><input name="donor" value={form.donor} readOnly maxLength="100" required/></Field><Field label="Pickup location" required wide><input name="pickupLocation" value={form.pickupLocation} onChange={change} placeholder="Address or pickup instructions" maxLength="200" required/></Field><Field label="Pickup deadline" required><input type="datetime-local" name="pickupDeadline" min={new Date(Date.now()+60000).toISOString().slice(0,16)} value={form.pickupDeadline} onChange={change} required/></Field><Field label="Allergens"><input name="allergens" value={form.allergens} onChange={change} placeholder="e.g. Contains dairy, wheat" maxLength="500"/></Field><Field label="Storage & handling notes" wide><textarea name="handlingNotes" value={form.handlingNotes} onChange={change} rows="2" placeholder="Keep refrigerated; bring clean containers…" maxLength="1000"/></Field></div>{error&&<div className="form-error">{error}</div>}<div className="form-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={busy}>{busy?(donation?'Saving…':'Posting…'):donation?'Save changes':<><Plus size={16}/> Post donation</>}</button></div></form></Modal>;
}

function DetailModal({donation:d,user,onClose,onEdit,onReserve,onCollect}) {
  const [quantity,setQuantity]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const reserved=Number(d.reservedKg ?? (d.reservations||[]).reduce((n,r)=>n+r.quantityKg,0)), remaining=Math.max(0,d.quantityKg-reserved);
  const submit=async e=>{e.preventDefault();setBusy(true);setError('');try{await onReserve(d,{quantityKg:Number(quantity)});}catch(err){setError(err.message);}finally{setBusy(false);}};
  return <Modal title={d.foodName} subtitle={`${d.donor} · ${d.category}`} onClose={onClose}><div className="detail-grid"><div><span className="detail-label">AVAILABLE QUANTITY</span><div className="detail-number">{remaining.toFixed(1)} <small>of {d.quantityKg} kg</small></div></div><div><span className="detail-label">PICKUP DEADLINE</span><div className="detail-value">{fmtDate(d.pickupDeadline)}</div></div><div className="detail-wide"><span className="detail-label">PICKUP LOCATION</span><div className="detail-value">{d.pickupLocation}</div></div><div><span className="detail-label">ALLERGENS</span><div className="detail-value">{d.allergens||'Not specified'}</div></div><div><span className="detail-label">HANDLING</span><div className="detail-value">{d.handlingNotes||'No special instructions'}</div></div><div className="detail-wide"><span className="detail-label">STATUS</span><Status status={d.status}/></div></div>
    {user?.role==='donor'&&d.status!=='collected'&&d.status!=='expired'&&<div className="edit-action"><button className="button secondary" onClick={()=>onEdit(d)}>Edit donation details</button></div>}
    {(d.reservations||[]).length>0&&<div className="reservations"><b>Your reservations</b>{d.reservations.map(r=><div className="reservation-line" key={r._id}><span>{r.recipient} · {r.quantityKg} kg</span><span><Status status={r.status}/>{user?.role==='recipient'&&r.status==='reserved'&&<button className="collect-button" onClick={()=>onCollect(d,r)}>Mark collected</button>}</span></div>)}</div>}
    {user?.role==='recipient'&&remaining>0&&d.status!=='collected'&&<form className="reserve-form" onSubmit={submit}><div className="eyebrow">RESERVE FOR {user.organizationName.toUpperCase()}</div><div className="reserve-inputs"><div className="reserve-org-name">{user.organizationName}</div><div className="input-unit"><input type="number" min="0.1" max={remaining} step="0.1" value={quantity} onChange={e=>setQuantity(e.target.value)} placeholder={`Up to ${remaining.toFixed(1)}`} required/><span>kg</span></div><button className="button primary" disabled={busy}>{busy?'…':'Reserve'}</button></div>{error&&<div className="form-error">{error}</div>}<p>Reservations are linked to your signed-in organization.</p></form>}
  </Modal>;
}

function Field({label,required,wide,children}){return <label className={`field ${wide?'wide':''}`}><span>{label}{required&&<i> *</i>}</span>{children}</label>;}
function Modal({title,subtitle,onClose,children}){return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className="modal"><div className="modal-head"><div><h2>{title}</h2><p>{subtitle}</p></div><button className="icon-button close-button" onClick={onClose} aria-label="Close"><X size={18}/></button></div>{children}</section></div>;}
