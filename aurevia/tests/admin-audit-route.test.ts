import {beforeEach,describe,expect,it,vi} from 'vitest';

const mocks=vi.hoisted(()=>({
	requireAdmin:vi.fn(),
	auditFindMany:vi.fn(),
	auditCreate:vi.fn(),
	notificationFindMany:vi.fn(),
	transaction:vi.fn(),
}));

vi.mock('@/lib/auth',()=>({requireAdmin:mocks.requireAdmin}));
vi.mock('@/lib/db',()=>({db:{auditLog:{findMany:mocks.auditFindMany},notification:{findMany:mocks.notificationFindMany},$transaction:mocks.transaction}}));
vi.mock('@/lib/serializers',()=>({jsonSafe:(value:unknown)=>value}));
vi.mock('@/lib/display-copy',()=>({removeSimulatedLabels:(value:string)=>value}));

import {GET} from '../app/api/admin/audit/route';

describe('admin audit login history',()=>{
	beforeEach(()=>{
		vi.clearAllMocks();
		mocks.requireAdmin.mockResolvedValue({id:'admin-1'});
		mocks.auditFindMany.mockResolvedValue([]);
		mocks.auditCreate.mockResolvedValue({});
		mocks.notificationFindMany.mockResolvedValue([]);
		mocks.transaction.mockImplementation(async callback=>callback({auditLog:{findMany:mocks.auditFindMany,create:mocks.auditCreate}}));
	});

	it('audits every targeted login-history read',async()=>{
		const response=await GET(new Request('https://aurevia.test/api/admin/audit?loginUserId=user-1'));

		expect(response.status).toBe(200);
		expect(mocks.auditFindMany).toHaveBeenCalledWith(expect.objectContaining({where:{entity:'LOGIN',actorId:'user-1'}}));
		expect(mocks.auditCreate).toHaveBeenCalledWith({data:{actorId:'admin-1',action:'ADMIN_LOGIN_HISTORY_VIEWED',entity:'LOGIN_HISTORY',entityId:'user-1',metadata:{recordCount:0}}});
	});

	it('excludes sensitive login metadata from the general audit feed',async()=>{
		const response=await GET(new Request('https://aurevia.test/api/admin/audit'));

		expect(response.status).toBe(200);
		expect(mocks.auditFindMany).toHaveBeenCalledWith({where:{entity:{not:'LOGIN'}},orderBy:{createdAt:'desc'},take:200});
		expect(mocks.auditCreate).not.toHaveBeenCalled();
	});

	it('rejects oversized login-history identifiers before querying',async()=>{
		const response=await GET(new Request(`https://aurevia.test/api/admin/audit?loginUserId=${'x'.repeat(129)}`));

		expect(response.status).toBe(400);
		expect(mocks.auditFindMany).not.toHaveBeenCalled();
		expect(mocks.auditCreate).not.toHaveBeenCalled();
	});
});