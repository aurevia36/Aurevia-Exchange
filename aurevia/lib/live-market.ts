import {getFinnhubHistory,getFinnhubQuote} from './providers/finnhub-market-data';
import {AlpacaStockMarketDataProvider,type AlpacaStockDataOptions} from './providers/alpaca-stock-market-data';
import {AlpacaCryptoMarketDataProvider} from './providers/alpaca-crypto.market-data';
import {getInternalMarketHistory,getInternalMarketQuote} from '@/lib/internal-market-data';

export type MarketAssetType = 'INDEX' | 'STOCK' | 'FOREX' | 'CRYPTO';

export type LiveMarketAsset = {
  id: string;
  ticker: string;
  name: string;
  type: MarketAssetType;
  currency: string;
};

export type MarketQuote = {
  asset: LiveMarketAsset;
  price: number;
  bid?:number|null;
  ask?:number|null;
  change: number;
  changePercent: number;
  marketStatus?:'OPEN'|'CLOSED'|'PREMARKET'|'AFTER_HOURS'|'UNKNOWN';
  previousClose: number | null;
  open: number | null;
  volume: number | null;
  dayLow: number | null;
  dayHigh: number | null;
  fiftyTwoWeekLow: number | null;
  fiftyTwoWeekHigh: number | null;
  updatedAt: string;
  isStale?: boolean;
  staleReason?: string;
  sparkline: number[];
  source: string;
};

export type MarketCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
};

export const MARKET_ASSETS: LiveMarketAsset[] = [
  {id:'DJI',ticker:'^DJI',name:'Dow Jones Industrial Average',type:'INDEX',currency:'USD'},
  {id:'SPX',ticker:'^GSPC',name:'S&P 500',type:'INDEX',currency:'USD'},
  {id:'NASDAQ',ticker:'^IXIC',name:'NASDAQ Composite',type:'INDEX',currency:'USD'},
  {id:'SP100',ticker:'^OEX',name:'S&P 100',type:'INDEX',currency:'USD'},
  {id:'NDX',ticker:'^NDX',name:'NASDAQ 100',type:'INDEX',currency:'USD'},
  {id:'DAX',ticker:'^GDAXI',name:'DAX Performance Index',type:'INDEX',currency:'EUR'},
  {id:'IBEX',ticker:'^IBEX',name:'IBEX 35',type:'INDEX',currency:'EUR'},
  {id:'NIKKEI',ticker:'^N225',name:'Nikkei 225',type:'INDEX',currency:'JPY'},
  {id:'MERV',ticker:'^MERV',name:'S&P Merval',type:'INDEX',currency:'ARS'},
  {id:'EURGBP',ticker:'EURGBP=X',name:'Euro / British Pound',type:'FOREX',currency:'GBP'},
  {id:'BTC',ticker:'BTC-USD',name:'Bitcoin USD',type:'CRYPTO',currency:'USD'},
  {id:'AAPL',ticker:'AAPL',name:'Apple Inc.',type:'STOCK',currency:'USD'},
  {id:'MSFT',ticker:'MSFT',name:'Microsoft Corporation',type:'STOCK',currency:'USD'},
  {id:'NVDA',ticker:'NVDA',name:'NVIDIA Corporation',type:'STOCK',currency:'USD'},
  {id:'AMZN',ticker:'AMZN',name:'Amazon.com, Inc.',type:'STOCK',currency:'USD'},
  {id:'GOOGL',ticker:'GOOGL',name:'Alphabet Inc.',type:'STOCK',currency:'USD'},
  {id:'TSLA',ticker:'TSLA',name:'Tesla, Inc.',type:'STOCK',currency:'USD'},
];

export const DEFAULT_WATCHLIST = ['DJI','SPX','NASDAQ','DAX','NIKKEI','BTC','EURGBP','IBEX','MERV'];
export const COMPARISON_SYMBOLS = ['SPX','NASDAQ','SP100','NDX'];

export const TIMEFRAMES = [
  {id:'1d',label:'1d',range:'1d',interval:'1m'},
  {id:'5d',label:'5d',range:'5d',interval:'5m'},
  {id:'1m',label:'1m',range:'1mo',interval:'30m'},
  {id:'3m',label:'3M',range:'3mo',interval:'1d'},
  {id:'ytd',label:'YTD',range:'ytd',interval:'1d'},
  {id:'1y',label:'1Y',range:'1y',interval:'1d'},
  {id:'3y',label:'3Y',range:'5y',interval:'1wk'},
  {id:'5y',label:'5Y',range:'5y',interval:'1wk'},
  {id:'max',label:'MAX',range:'max',interval:'1mo'},
] as const;

export type TimeframeId = (typeof TIMEFRAMES)[number]['id'];
export const MARKET_UI_REFRESH_INTERVAL_MS=1_000;

type Cached<T> = {expiresAt:number;promise:Promise<T>};
const quoteCache = new Map<string,Cached<MarketQuote>>();
const lastKnownQuoteCache = new Map<string,MarketQuote>();
const staleQuoteAgeMs=5*60_000;

export class MarketDataError extends Error {
  constructor(message:string,readonly status=502){super(message);this.name='MarketDataError';}
}

export function getMarketAsset(id:string){return MARKET_ASSETS.find(asset=>asset.id===id.toUpperCase());}

export function getMarketAssetForTradingSymbol(symbol:string){
  const normalized=symbol.toUpperCase().replace(/[^A-Z0-9]/g,'');
  return MARKET_ASSETS.find(asset=>[asset.id,asset.ticker].some(value=>value.toUpperCase().replace(/[^A-Z0-9]/g,'')===normalized));
}

export function isExternalMarketDataSource(source:string){
  return source==='Finnhub'||source.startsWith('Alpaca');
}

export function filterSupportedMarketAssets<T extends {symbol:string}>(assets:T[]):T[]{
  return assets.filter(asset=>!!getMarketAsset(asset.symbol));
}

function getCached<T>(cache:Map<string,Cached<T>>,key:string,ttl:number,loader:()=>Promise<T>):Promise<T>{
  const current=cache.get(key);
  if(current&&current.expiresAt>Date.now())return current.promise;
  const promise=loader().catch(error=>{cache.delete(key);throw error});
  cache.set(key,{expiresAt:Date.now()+ttl,promise});
  return promise;
}

function alpacaProvider(options?:AlpacaStockDataOptions){return options?.apiKey&&options.apiSecret?new AlpacaStockMarketDataProvider(options):null}
function alpacaCryptoProvider(options?:AlpacaStockDataOptions){return options?.apiKey?new AlpacaCryptoMarketDataProvider({baseUrl:'https://data.alpaca.markets',apiKey:options.apiKey,fetcher:options.fetcher}):null}

function quoteFromAlpaca(asset:LiveMarketAsset,snapshot:Awaited<ReturnType<AlpacaStockMarketDataProvider['getQuote']>>):MarketQuote{
  if(snapshot.previousClose===null||snapshot.previousClose<=0)throw new MarketDataError(`Daily change data is unavailable for ${asset.id}.`,404);
  const change=snapshot.price-snapshot.previousClose;
  return {asset,price:snapshot.price,bid:snapshot.bid,ask:snapshot.ask,change,changePercent:Number((change/snapshot.previousClose*100).toFixed(6)),marketStatus:'UNKNOWN',previousClose:snapshot.previousClose,open:snapshot.open,volume:snapshot.volume,dayLow:snapshot.low,dayHigh:snapshot.high,fiftyTwoWeekLow:null,fiftyTwoWeekHigh:null,updatedAt:snapshot.updatedAt,sparkline:[],source:'Alpaca'};
}

async function quoteFromAlpacaCrypto(asset:LiveMarketAsset,provider:AlpacaCryptoMarketDataProvider):Promise<MarketQuote>{
  const symbol=asset.ticker.replace('-','/');
  const end=new Date();
  const start=new Date(end.getTime()-3*86_400_000);
  const [snapshot,trade,bars]=await Promise.all([
    provider.getQuote(symbol),
    provider.getLatestTrade(symbol),
    provider.getBars(symbol,start.toISOString(),end.toISOString(),'1Day'),
  ]);
  const latest=bars.at(-1);
  const previous=bars.length>1?bars.at(-2):undefined;
  const previousClose=previous?.close??null;
  if(previousClose===null||previousClose<=0)throw new MarketDataError(`Daily change data is unavailable for ${asset.id}.`,404);
  const change=trade.price-previousClose;
  return {
    asset,price:trade.price,bid:snapshot.bid,ask:snapshot.ask,change,marketStatus:'OPEN',
    changePercent:Number((change/previousClose*100).toFixed(6)),previousClose,
    open:latest?.open??null,volume:latest?.volume??null,dayLow:latest?.low??null,dayHigh:latest?.high??null,
    fiftyTwoWeekLow:null,fiftyTwoWeekHigh:null,updatedAt:trade.asOf,sparkline:[],source:'Alpaca Crypto',
  };
}

export async function getMarketQuote(asset:LiveMarketAsset,apiKey='',alpacaData?:AlpacaStockDataOptions):Promise<MarketQuote>{
  const provider=alpacaProvider(alpacaData);
  const cryptoProvider=alpacaCryptoProvider(alpacaData);
  const getInternalFallback=async()=>{
    const internalQuote=await getInternalMarketQuote(asset);
    lastKnownQuoteCache.set(asset.id,internalQuote);
    return internalQuote;
  };
  const internalFallbackOrThrow=async(providerError:unknown)=>{
    try{return await getInternalFallback();}
    catch{throw providerError;}
  };

  try{
    const quote=await getCached(quoteCache,`${provider&&asset.type==='STOCK'?'alpaca-stock':cryptoProvider&&asset.type==='CRYPTO'?'alpaca-crypto':apiKey?'finnhub':'unconfigured'}:${asset.id}`,5_000,async()=>{
      if(provider&&asset.type==='STOCK'){
        try{return quoteFromAlpaca(asset,await provider.getQuote(asset.ticker));}
        catch(error){
          if(!apiKey && !cryptoProvider){
            return internalFallbackOrThrow(error);
          }
          if(!apiKey){
            throw error;
          }
        }
      }
      if(cryptoProvider&&asset.type==='CRYPTO'){
        try{return await quoteFromAlpacaCrypto(asset,cryptoProvider);}
        catch(error){
          if(!apiKey && !provider){
            return internalFallbackOrThrow(error);
          }
          if(!apiKey){
            throw error;
          }
        }
      }
      if(apiKey){
        try{return await getFinnhubQuote(asset,apiKey);}catch(error){
          if(!provider && !cryptoProvider){
            return internalFallbackOrThrow(error);
          }
          throw error;
        }
      }
      return getInternalFallback();
    });
    const age=Date.now()-Date.parse(quote.updatedAt);
    const staleReason=age>staleQuoteAgeMs?'Provider quote timestamp is older than five minutes.':age< -5_000?'Provider quote timestamp is in the future.':undefined;
    const timestamped={...quote,isStale:!!staleReason,...(staleReason?{staleReason}:{})};
    lastKnownQuoteCache.set(asset.id,timestamped);
    return timestamped;
  }catch(error){
    const lastKnown=lastKnownQuoteCache.get(asset.id);
    try{
      return await getInternalFallback();
    }catch{
      if(!lastKnown)throw error;
    }
    if(lastKnown){
      return {...lastKnown,isStale:true,staleReason:error instanceof Error?error.message:'Market data is temporarily unavailable.'};
    }
    throw error;
  }
}

export async function getMarketHistory(asset:LiveMarketAsset,timeframe:TimeframeId,apiKey='',alpacaData?:AlpacaStockDataOptions){
  const selection=TIMEFRAMES.find(item=>item.id===timeframe)||TIMEFRAMES[0];
  const provider=alpacaProvider(alpacaData);
  const cryptoProvider=alpacaCryptoProvider(alpacaData);
  const getInternalFallback=async()=>await getInternalMarketHistory(asset,timeframe);
  if(provider&&asset.type==='STOCK'){
    try{
      const end=new Date();
      const start=new Date(end);
      const days:Record<TimeframeId,number>={ '1d':1,'5d':5,'1m':31,'3m':92,'ytd':Math.ceil((end.getTime()-Date.UTC(end.getUTCFullYear(),0,1))/86_400_000),'1y':366,'3y':1097,'5y':1827,'max':3650 };
      start.setUTCDate(start.getUTCDate()-days[timeframe]);
      const intervals:Record<string,string>={'1m':'1Min','5m':'5Min','30m':'30Min','1d':'1Day','1wk':'1Week','1mo':'1Month'};
      const candles=await provider.getBars(asset.ticker,start.toISOString(),end.toISOString(),intervals[selection.interval]||'1Min');
      if(!candles.length)throw new MarketDataError(`No historical data is available for ${asset.id}.`,404);
      const quote=await getMarketQuote(asset,apiKey,alpacaData);
      return {quote,candles:candles.map(candle=>({...candle,time:Date.parse(candle.time)/1000})),timeframe,interval:selection.interval,source:'Alpaca'};
    }catch(error){
      if(!apiKey && !cryptoProvider){
        return getInternalFallback();
      }
      if(!apiKey){
        throw error;
      }
    }
  }
  if(cryptoProvider&&asset.type==='CRYPTO'){
    try{
      const end=new Date();
      const days:Record<TimeframeId,number>={ '1d':1,'5d':5,'1m':31,'3m':92,'ytd':Math.ceil((end.getTime()-Date.UTC(end.getUTCFullYear(),0,1))/86_400_000),'1y':366,'3y':1097,'5y':1827,'max':3650 };
      const start=new Date(end.getTime()-days[timeframe]*86_400_000);
      const intervals:Record<string,string>={'1m':'1Min','5m':'5Min','30m':'15Min','1d':'1Day','1wk':'1Day','1mo':'1Day'};
      const candles=await cryptoProvider.getBars(asset.ticker.replace('-','/'),start.toISOString(),end.toISOString(),intervals[selection.interval]||'1Day');
      if(!candles.length)throw new MarketDataError(`No historical data is available for ${asset.id}.`,404);
      const quote=await getMarketQuote(asset,apiKey,alpacaData);
      return {quote,candles:candles.map(candle=>({...candle,time:Date.parse(candle.time)/1000})),timeframe,interval:selection.interval,source:'Alpaca Crypto'};
    }catch(error){
      if(!apiKey && !provider){
        return getInternalFallback();
      }
      if(!apiKey){
        throw error;
      }
    }
  }
  if(apiKey){
    try{return {...await getFinnhubHistory(asset,selection.range,selection.interval,apiKey),timeframe,interval:selection.interval};}
    catch(error){
      if(!provider && !cryptoProvider){
        return getInternalFallback();
      }
      throw error;
    }
  }
  return getInternalFallback();
}

export async function getLiveMarketProviderStatus(apiKey='',alpacaData?:AlpacaStockDataOptions){
  const asset=getMarketAsset('AAPL')!;
  const provider=alpacaProvider(alpacaData);
  let alpacaStatus:'NOT_CONFIGURED'|'HEALTHY'|'AUTHENTICATION_FAILED'|'UNAVAILABLE'=provider?'UNAVAILABLE':'NOT_CONFIGURED';
  if(provider){
    try{await provider.healthCheck();alpacaStatus='HEALTHY';return {status:'AVAILABLE' as const,provider:'Alpaca',finnhubStatus:apiKey?'CONFIGURED' as const:'NOT_CONFIGURED' as const,fallbackProvider:'Aurevia Internal',alpacaStatus};}
    catch(error){alpacaStatus=error instanceof Error&&/:(401|403)$/.test(error.message)?'AUTHENTICATION_FAILED':'UNAVAILABLE';}
  }
  if(apiKey){
    try{await getFinnhubQuote(asset,apiKey);return {status:'AVAILABLE' as const,provider:'Finnhub',finnhubStatus:'AVAILABLE' as const,fallbackProvider:'Aurevia Internal',alpacaStatus};}
    catch{
      return {status:'AVAILABLE' as const,provider:'Aurevia Internal',finnhubStatus:'ERROR' as const,fallbackProvider:'Aurevia Internal',alpacaStatus};
    }
  }
  return {status:'AVAILABLE' as const,provider:'Aurevia Internal',finnhubStatus:'NOT_CONFIGURED' as const,fallbackProvider:'Aurevia Internal',alpacaStatus};
}