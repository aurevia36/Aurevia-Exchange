'use client';

import {FormEvent,useEffect,useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {ShieldCheck} from 'lucide-react';
import Nav from '@/components/Nav';

export default function VerifyEmailPage(){
	const router=useRouter();
	const [email,setEmail]=useState('');
	const [deliveryStatus,setDeliveryStatus]=useState<'sent'|'retry'>('sent');
	const [code,setCode]=useState('');
	const [message,setMessage]=useState('');
	const [error,setError]=useState('');
	const [busy,setBusy]=useState(false);

	useEffect(()=>{
		const params=new URLSearchParams(window.location.search);
		setEmail(params.get('email')||'');
		if(params.get('delivery')==='retry')setDeliveryStatus('retry');
	},[]);

	async function verify(event:FormEvent<HTMLFormElement>){
		event.preventDefault();
		if(busy)return;
		setBusy(true);setError('');setMessage('');
		try{
			const response=await fetch('/api/register/verify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,code})});
			const result=await response.json();
			if(!response.ok)throw new Error(result.error||'Unable to verify this email address.');
			router.replace('/login?verified=1');
			router.refresh();
		}catch(exception){
			setError(exception instanceof Error?exception.message:'Unable to verify this email address.');
		}finally{
			setBusy(false);
		}
	}

	async function resend(){
		if(busy||!email)return;
		setBusy(true);setError('');setMessage('');
		try{
			const response=await fetch('/api/register/resend',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email})});
			const result=await response.json();
			if(!response.ok)throw new Error(result.error||'Unable to request a new verification code.');
			setMessage(result.message||'If the account is eligible, a replacement code was requested. Check your email shortly.');
		}catch(exception){
			setError(exception instanceof Error?exception.message:'Unable to request a new verification code.');
		}finally{
			setBusy(false);
		}
	}

	return <><Nav/><main className="auth-scene"><section className="auth-card" aria-labelledby="verify-email-title">
		<div className="flex items-center gap-2 gold"><ShieldCheck size={20} aria-hidden="true"/><span className="text-sm font-semibold">Email verification</span></div>
		<h1 id="verify-email-title" className="auth-heading mt-3">Verify your email address</h1>
		<p className="mt-2 text-sm leading-6 muted">{deliveryStatus==='retry'?'Your account was created, but we could not send the first email. You can sign in without a verification code.':'Email verification is no longer required to register or sign in. Existing verification links can still be used if you requested one.'}</p>
		<form onSubmit={verify} className="mt-5 space-y-4">
			<label className="auth-field-label">Email address<input className="auth-input" type="email" autoComplete="email" value={email} onChange={event=>setEmail(event.target.value)} required maxLength={254}/></label>
			<label className="auth-field-label">Six-digit verification code<input className="auth-input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event=>setCode(event.target.value.replace(/\D/g,'').slice(0,6))} required/></label>
			{error&&<p className="auth-error" role="alert">{error}</p>}
			{message&&<p className="text-sm text-profit" role="status">{message}</p>}
			<button className="auth-submit w-full" type="submit" disabled={busy}>{busy?'Verifying…':'Verify email'}</button>
		</form>
		<button className="mt-4 text-link" type="button" disabled={busy||!email} onClick={()=>void resend()}>Resend verification code</button>
		<p className="auth-footer mt-5">Ready to continue? <Link href="/login" className="auth-link">Sign in</Link></p>
	</section></main></>;
}
