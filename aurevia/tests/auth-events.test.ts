import {beforeEach,describe,expect,it,vi} from 'vitest';

const mocks=vi.hoisted(()=>({updateMany:vi.fn(),auditCreate:vi.fn()}));

vi.mock('next-auth/providers/credentials',()=>({default:vi.fn(configuration=>configuration)}));
vi.mock('@/lib/db',()=>({db:{user:{updateMany:mocks.updateMany},auditLog:{create:mocks.auditCreate}}}));
vi.mock('@/lib/notifications',()=>({createNotification:vi.fn()}));

import {authOptions} from '../lib/auth-options';

describe('authentication audit events',()=>{
	beforeEach(()=>{
		vi.clearAllMocks();
		mocks.updateMany.mockResolvedValue({count:1});
		mocks.auditCreate.mockResolvedValue({});
	});

	it('records logout with a hashed session reference and clears the active session',async()=>{
		const signOut=authOptions.events?.signOut;
		if(!signOut)throw new Error('Sign-out event handler is unavailable.');
		await signOut({token:{id:'user-1',sessionId:'raw-session-secret'}} as never);

		expect(mocks.updateMany).toHaveBeenCalledWith({where:{id:'user-1',activeSessionId:'raw-session-secret'},data:{activeSessionId:null,activeSessionUpdatedAt:null}});
		expect(mocks.auditCreate).toHaveBeenCalledWith({data:expect.objectContaining({actorId:'user-1',action:'LOGOUT_SUCCESS',entity:'LOGIN',entityId:'user-1',metadata:expect.objectContaining({status:'SUCCESS',sessionRef:expect.any(String)})})});
		expect(JSON.stringify(mocks.auditCreate.mock.calls)).not.toContain('raw-session-secret');
	});
});