/* eslint-disable react-hooks/globals -- Probe exposes hook state to lifecycle assertions. */
import React from 'react';
import TestRenderer,{act} from 'react-test-renderer';
import {usePersonalHistoryStats,useSocialHistory,useHistoryCoplayerContext,invalidateSocialHistory} from '../../../features/history/useSocialHistory';
import {loadPersonalHistoryStats,loadSocialHistory,loadSharedGames,loadSharedTimeline,loadCoplayerContext} from '../../../features/history/socialHistoryRepository';
import type {Person} from '../../../features/friends/friendsRepository';
import {queryClient,setAccountScope} from '../../../lib/queryClient';
import {useAccountAuth} from '../../../hooks/useAccountAuth';
jest.mock('../../../features/friends',() => ({parseHistoryPerson:require('../../../features/friends/friendsRepository').parseHistoryPerson}));
jest.mock('../../../hooks/useAccountAuth',() => ({useAccountAuth:jest.fn()}));
jest.mock('../../../lib/supabase',() => ({getSupabaseClient:() => ({})}));
let mockInteractive=true;
jest.mock('../../../platform/visibility',() => ({useAppVisibility:() => ({isInteractive:mockInteractive})}));
jest.mock('expo-router',() => ({useFocusEffect:(callback:()=>()=>void) => require('react').useEffect(callback,[callback])}));
jest.mock('../../../features/history/socialHistoryRepository',() => ({
  ...jest.requireActual('../../../features/history/socialHistoryRepository'),loadPersonalHistoryStats:jest.fn(),loadSocialHistory:jest.fn(),loadSharedGames:jest.fn(),loadSharedTimeline:jest.fn(),loadCoplayerContext:jest.fn(),
}));
const a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002',c='00000000-0000-4000-8000-000000000003';
const coplayerId=(value:number) => `00000000-0000-4000-8000-${value.toString(16).padStart(12,'0')}`;
const stats=(id:string) => ({account_id:id,username:id,games_participated:0,total_drinks:0,average_drinks:null});
const person=(id:string):Person => ({account_id:id,username:id,relationship:'friends',request_id:null});
const bundle=(viewer=a,target=b) => ({scope:'all_time_completed_online' as const,viewer:stats(viewer),target:stats(target),
  shared:{shared_games:0,viewer_total_drinks:0,target_total_drinks:0,viewer_average_drinks:null,target_average_drinks:null,
    viewer_higher_count:0,target_higher_count:0,tied_count:0},games:{items:[],next_cursor:null as string|null}});
let tree:TestRenderer.ReactTestRenderer,current:ReturnType<typeof useSocialHistory>;
function Probe({target=b}:{target?:string}) {current=useSocialHistory(target); return null;}
function auth(id:string) {setAccountScope(id); jest.mocked(useAccountAuth).mockReturnValue({account:{id},status:'ready'} as ReturnType<typeof useAccountAuth>);}
beforeEach(() => {
  queryClient.clear(); jest.clearAllMocks(); mockInteractive=true; auth(a);
  jest.mocked(loadSocialHistory).mockResolvedValue(bundle());
  jest.mocked(loadCoplayerContext).mockResolvedValue([]);
});
afterEach(() => {if(tree) act(() => tree.unmount()); queryClient.clear(); setAccountScope(null);});
const mount=async () => {await act(async () => {tree=TestRenderer.create(React.createElement(Probe));});};
it('hides cached values until a fresh authorized read succeeds',async () => {
  queryClient.setQueryData(['account',a,'social-history',b],bundle());
  let resolve!:(value:ReturnType<typeof bundle>)=>void;
  jest.mocked(loadSocialHistory).mockImplementation(() => new Promise(done => {resolve=done;}));
  await mount(); expect(current.data).toBeNull(); expect(current.checking).toBe(true);
  await act(async () => {resolve(bundle());});
  expect(current.data?.target.account_id).toBe(b);
});
it('clears cached friend data on connection failure and supports Retry',async () => {
  await mount(); expect(current.data).not.toBeNull();
  jest.mocked(loadSocialHistory).mockRejectedValueOnce(new Error('offline'));
  await act(async () => {await current.refresh();});
  expect(current.data).toBeNull(); expect(current.error).toContain('Could not connect');
  await act(async () => {await current.refresh();});
  expect(current.data).not.toBeNull();
});
it('hides data in background and rechecks on foreground',async () => {
  await mount(); mockInteractive=false;
  await act(async () => {tree.update(React.createElement(Probe));}); expect(current.data).toBeNull();
  jest.mocked(loadSocialHistory).mockRejectedValueOnce(new Error('offline')); mockInteractive=true;
  await act(async () => {tree.update(React.createElement(Probe));}); expect(current.data).toBeNull();
});
it('fences late results across signout and signing back into the same account',async () => {
  let resolve!:(value:ReturnType<typeof bundle>)=>void;
  jest.mocked(loadSocialHistory).mockImplementationOnce(() => new Promise(done => {resolve=done;}));
  await mount(); setAccountScope(null); auth(a);
  await act(async () => {tree.update(React.createElement(Probe)); resolve(bundle());});
  expect(current.data).toBeNull();
});
it('does not display a late result for another target',async () => {
  let resolve!:(value:ReturnType<typeof bundle>)=>void;
  jest.mocked(loadSocialHistory).mockImplementationOnce(() => new Promise(done => {resolve=done;}));
  await mount(); jest.mocked(loadSocialHistory).mockResolvedValue(bundle(a,c));
  await act(async () => {tree.update(React.createElement(Probe,{target:c})); resolve(bundle());});
  expect(current.data?.target.account_id).toBe(c);
});
it('immediately hides a view after a confirmed social mutation and rechecks',async () => {
  await mount(); jest.mocked(loadSocialHistory).mockRejectedValueOnce(new Error('revoked'));
  await act(async () => {await invalidateSocialHistory(a);});
  expect(current.data).toBeNull();
});
it('a rejected page clears all displayed social payload',async () => {
  const value=bundle(); value.games.next_cursor='cursor';
  jest.mocked(loadSocialHistory).mockResolvedValue(value); await mount();
  jest.mocked(loadSharedGames).mockRejectedValueOnce(new Error('revoked'));
  await act(async () => {await current.loadGames();});
  expect(current.data).toBeNull(); expect(current.timeline).toBeNull();
});
it('deduplicates shared pages and resets them on refresh',async () => {
  const value=bundle(); value.games.next_cursor='cursor';
  jest.mocked(loadSocialHistory).mockResolvedValue(value); await mount();
  const game={id:'one',date:'2026-10-01T12:00Z',players:[],matches:[],commonMatchId:null,playerAssignments:{},matchesPerPlayer:0};
  jest.mocked(loadSharedGames).mockResolvedValue({items:[game,game],next_cursor:null});
  await act(async () => {await current.loadGames();}); expect(current.data?.games.items).toHaveLength(1);
  await act(async () => {await current.refresh();}); expect(current.data?.games.items).toHaveLength(0);
});
it('loads only lazy timeline data',async () => {
  await mount(); expect(loadSharedTimeline).not.toHaveBeenCalled();
  jest.mocked(loadSharedTimeline).mockResolvedValue({items:[],next_cursor:null});
  await act(async () => {await current.loadTimeline();}); expect(current.timeline).toEqual({items:[],next_cursor:null});
});
it('loads coplayer batches with a four-request cap and keeps input order',async () => {
  const ids=Array.from({length:550},(_,index)=>coplayerId(index+1000));
  let coplayers:Person[]=[];
  const pending:{ids:string[];resolve:(people:Person[])=>void}[] = [];
  let inFlight=0;
  let maximumInFlight=0;
  const CoplayerProbe=() => {coplayers=useHistoryCoplayerContext(ids);return null;};
  jest.mocked(loadCoplayerContext).mockImplementation((_client,batchIds) => {
    inFlight++;
    maximumInFlight=Math.max(maximumInFlight,inFlight);
    return new Promise(resolve => pending.push({
      ids:batchIds,
      resolve:people => {inFlight--;resolve(people);},
    }));
  });

  await act(async () => {tree=TestRenderer.create(React.createElement(CoplayerProbe));});
  expect(pending).toHaveLength(4);

  const resolveRound=async () => act(async () => {
    const round=pending.splice(0);
    round.forEach(batch => batch.resolve(batch.ids.map(person)));
    await new Promise(done => setTimeout(done,0));
  });
  await resolveRound();
  expect(pending).toHaveLength(2);
  await resolveRound();

  expect(maximumInFlight).toBe(4);
  expect(loadCoplayerContext).toHaveBeenCalledTimes(6);
  expect(coplayers.map(value => value.account_id)).toEqual(ids);
});
it('stops scheduling coplayer batches after a request fails',async () => {
  const ids=Array.from({length:550},(_,index)=>coplayerId(index+2000));
  let coplayers:Person[]=[];
  const pending:{reject:(error:Error)=>void;signal:AbortSignal}[] = [];
  const CoplayerProbe=() => {coplayers=useHistoryCoplayerContext(ids);return null;};
  jest.mocked(loadCoplayerContext).mockImplementation((_client,_batchIds,signal) => new Promise((_resolve,reject) => {
    pending.push({reject,signal});
    signal.addEventListener('abort',() => reject(new Error('cancelled')),{once:true});
  }));

  await act(async () => {tree=TestRenderer.create(React.createElement(CoplayerProbe));});
  expect(pending).toHaveLength(4);
  pending[0].reject(new Error('server failure'));
  await act(async () => {await new Promise(done => setTimeout(done,0));});

  expect(loadCoplayerContext).toHaveBeenCalledTimes(4);
  expect(pending.every(request => request.signal.aborted)).toBe(true);
  expect(coplayers).toEqual([]);
});
it('does not publish late coplayer results after the authenticated account changes',async () => {
  let coplayers:Person[]=[];
  let resolveOld!:(people:Person[])=>void;
  let resolveCurrent!:(people:Person[])=>void;
  const CoplayerProbe=() => {coplayers=useHistoryCoplayerContext([b]);return null;};
  jest.mocked(loadCoplayerContext)
    .mockImplementationOnce(() => new Promise(resolve => {resolveOld=resolve;}))
    .mockImplementationOnce(() => new Promise(resolve => {resolveCurrent=resolve;}));

  await act(async () => {tree=TestRenderer.create(React.createElement(CoplayerProbe));});
  expect(loadCoplayerContext).toHaveBeenCalledTimes(1);
  setAccountScope(c);
  auth(c);
  await act(async () => {tree.update(React.createElement(CoplayerProbe));});
  expect(coplayers).toEqual([]);
  expect(loadCoplayerContext).toHaveBeenCalledTimes(2);

  await act(async () => {
    resolveOld([person(b)]);
    await new Promise(done => setTimeout(done,0));
  });
  expect(coplayers).toEqual([]);
  await act(async () => {
    resolveCurrent([person(b)]);
    await new Promise(done => setTimeout(done,0));
  });
  expect(coplayers).toEqual([person(b)]);
});
it('ignores a delayed page rejection after a successful refresh',async () => {
  const value=bundle(); value.games.next_cursor='cursor';
  jest.mocked(loadSocialHistory).mockResolvedValue(value); await mount();
  let reject!:(error:Error)=>void;
  jest.mocked(loadSharedGames).mockImplementationOnce(() => new Promise((_resolve,fail) => {reject=fail;}));
  let pending!:Promise<void>;
  act(() => {pending=current.loadGames();});
  await act(async () => {await current.refresh();});
  await act(async () => {reject(new Error('old permission failure')); await pending;});
  expect(current.data).not.toBeNull(); expect(current.error).toBeNull();
});

it('fences personal totals across account changes and signout',async () => {
  let personal!:ReturnType<typeof usePersonalHistoryStats>;
  const PersonalProbe=() => {personal=usePersonalHistoryStats();return null;};
  let resolve!:(value:ReturnType<typeof stats>)=>void;
  jest.mocked(loadPersonalHistoryStats).mockImplementationOnce(() => new Promise(done => {resolve=done;}));
  await act(async () => {tree=TestRenderer.create(React.createElement(PersonalProbe));});
  expect(personal.data).toBeNull();
  jest.mocked(loadPersonalHistoryStats).mockResolvedValue(stats(c));
  await act(async () => {auth(c);tree.update(React.createElement(PersonalProbe));await new Promise(done=>setTimeout(done,20));});
  await act(async () => {resolve(stats(a));await new Promise(done=>setTimeout(done,20));});
  expect(personal.data?.account_id).toBe(c);
  await act(async () => {
    setAccountScope(null);jest.mocked(useAccountAuth).mockReturnValue({account:null,status:'signedOut'} as ReturnType<typeof useAccountAuth>);
    tree.update(React.createElement(PersonalProbe));
  });
  expect(personal.data).toBeNull();expect(personal.enabled).toBe(false);
});
