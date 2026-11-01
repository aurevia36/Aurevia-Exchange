'use client';

import {useEffect,useState} from 'react';
import {useLocale} from '@/lib/i18n-context';
import {MARKET_UI_REFRESH_INTERVAL_MS} from '@/lib/live-market';

type TickerItem={id:string;symbol:string;price:number;change?:number};

type LiveQuotePayload={asset:{id:string;name:string};price:number;changePercent:number};

export default function HomeMarketTicker(){
  const {translate}=useLocale();
  const [items,setItems]=useState<TickerItem[]>([]);
  const [status,setStatus]=useState<'loading'|'ready'|'unavailable'>('loading');

  useEffect(()=>{
    let active=true;
    async function refresh(){
      try{
        const symbols=['DJI','SPX','NASDAQ','BTC','AAPL','MSFT','NVDA','AMZN','GOOGL','TSLA','EURGBP'].join(',');
        const response=await fetch(`/api/live-markets?symbols=${encodeURIComponent(symbols)}`,{cache:'no-store'});
        const payload=await response.json() as {quotes?:LiveQuotePayload[]};
        const quotes=(payload.quotes??[]).filter((item):item is LiveQuotePayload=>Boolean(item)&&typeof item.price==='number'&&typeof item.asset?.id==='string');
        if(!response.ok||!quotes.length)throw new Error('Market feed unavailable');
        if(!active)return;
        setItems(quotes.slice(0,8).map(item=>({id:item.asset.id,symbol:item.asset.id,price:Number(item.price),change:Number(item.changePercent)/100})));
        setStatus('ready');
      }catch{if(active)setStatus(current=>current==='ready'?current:'unavailable')}
    }
    void refresh();
    const timer=window.setInterval(()=>void refresh(),MARKET_UI_REFRESH_INTERVAL_MS);
    return()=>{active=false;window.clearInterval(timer)};
  },[]);

  const row=items.map(item=>(
    <div className="ticker-item" key={item.id}>
      <span>{item.symbol}</span>
      <b>{item.price.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:item.price<10?4:2})}</b>
      <i className={item.change===undefined?'':item.change>=0?'ticker-positive':'ticker-negative'}>
        {item.change===undefined?'—':`${item.change>=0?'+':''}${(item.change*100).toFixed(2)}%`}
      </i>
    </div>
  ));

  return <div className="ticker-scroll is-live" aria-live="polite">
    <div className="ticker-track">
      <div className="ticker-items">{row}{!items.length&&<span className="ticker-empty">{status==='loading'?translate('loadingDemoInstruments'):status==='unavailable'?translate('demoMarketFeedUnavailable'):translate('noDemoInstrumentsConfigured')}</span>}</div>
      {items.length>0&&<div className="ticker-items" aria-hidden="true">{row}</div>}
    </div>
  </div>;
}
