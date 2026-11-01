import {NextResponse} from 'next/server';import {requireAdmin} from '@/lib/auth';import {db} from '@/lib/db';import {jsonSafe} from '@/lib/serializers';
import {removeSimulatedLabels} from '@/lib/display-copy';
export async function GET(request:Request){
	try{
		const admin=await requireAdmin();
		const loginUserId=new URL(request.url).searchParams.get('loginUserId');
		if(loginUserId){
			if(loginUserId.length>128)return NextResponse.json({error:'Invalid user identifier.'},{status:400});
			const events=await db.$transaction(async tx=>{
				const records=await tx.auditLog.findMany({where:{entity:'LOGIN',actorId:loginUserId},select:{id:true,actorId:true,action:true,entity:true,metadata:true,createdAt:true},orderBy:{createdAt:'desc'},take:100});
				await tx.auditLog.create({data:{actorId:admin.id,action:'ADMIN_LOGIN_HISTORY_VIEWED',entity:'LOGIN_HISTORY',entityId:loginUserId,metadata:{recordCount:records.length}}});
				return records;
			});
			return NextResponse.json(jsonSafe(events.map(event=>({...event,action:removeSimulatedLabels(event.action)}))),{headers:{'Cache-Control':'private, no-store'}});
		}
		const [audit,notifications]=await Promise.all([db.auditLog.findMany({where:{entity:{not:'LOGIN'}},orderBy:{createdAt:'desc'},take:200}),db.notification.findMany({select:{id:true,type:true,title:true,createdAt:true},orderBy:{createdAt:'desc'},take:200})]);
		const events=[...audit.map(event=>({...event,action:removeSimulatedLabels(event.action),summary:null})),...notifications.map(event=>({id:`notification:${event.id}`,createdAt:event.createdAt,action:`NOTIFICATION_${event.type}`,entity:'NOTIFICATION',entityId:event.id,summary:removeSimulatedLabels(event.title)}))].sort((a,b)=>b.createdAt.getTime()-a.createdAt.getTime()).slice(0,200);
		return NextResponse.json(jsonSafe(events),{headers:{'Cache-Control':'private, no-store'}});
	}catch{return NextResponse.json({error:'Forbidden'},{status:403})}
}
