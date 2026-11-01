import {aiChat,type AiMessage,type AiResult} from '@/lib/ai-gateway';

export const AI_SERVICE_NAMES=[
	'customer_support',
	'investment_research',
	'financial_document_analysis',
	'administrative_assistance',
	'market_information_summary',
	'notification_generation',
	'error_diagnosis',
	'api_configuration_assistance',
	'operational_recommendations',
	'platform_help',
] as const;

export type AiServiceName=(typeof AI_SERVICE_NAMES)[number];

const serviceRules:Record<AiServiceName,string>={
	customer_support:'Support guidance is generated analysis, not a verified account or payment result. Use only supplied, authorized facts.',
	investment_research:'This is educational, generated analysis, not personalized investment advice, a price prediction, or a guarantee.',
	financial_document_analysis:'Extract or summarize only what is visible in supplied material. Do not approve, verify, or make legal, tax, credit, or financial decisions.',
	administrative_assistance:'Provide drafts and explanations only. Never change a record, grant permissions, or approve an operational action.',
	market_information_summary:'Separate supplied provider facts from generated analysis. Never invent prices, events, sources, or market activity.',
	notification_generation:'Draft concise notification text only. Never claim an unrecorded balance, approval, fill, or external transfer.',
	error_diagnosis:'Diagnose only from supplied error evidence. Do not claim a fix was applied or disclose secrets.',
	api_configuration_assistance:'Use official provider documentation and supplied configuration facts only. Never invent credentials or claim connectivity without a successful test.',
	operational_recommendations:'Offer non-binding operational suggestions only. Do not modify financial records, execute trades, or bypass security controls.',
	platform_help:'Platform explanations are generated assistance, not verified external information or an account decision.',
};

export async function runAiService(service:AiServiceName,messages:AiMessage[],options:{actorId?:string;temperature?:number;maxTokens?:number}={}):Promise<AiResult>{
	const systemIndex=messages.findIndex(message=>message.role==='system');
	const guardedMessages=messages.map((message,index)=>index===systemIndex?{...message,content:`${message.content}\n\n${serviceRules[service]}`} :message);
	if(systemIndex<0)guardedMessages.unshift({role:'system',content:serviceRules[service]});
	return aiChat(guardedMessages,{...options,service});
}