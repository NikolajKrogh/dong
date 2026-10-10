import React, { useState } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { actCreate } from '../../../test-utils/render';
import { TamaguiTestProvider } from '../../../test-utils/tamagui';
import HistoryStatistics from '../../../features/history/HistoryStatistics';
import { usePersonalHistoryStats, useSocialHistory } from '../../../features/history/useSocialHistory';
import type { useFriends } from '../../../features/friends';

jest.mock('../../../features/history/useSocialHistory',() => ({useSocialHistory:jest.fn(),usePersonalHistoryStats:jest.fn(),invalidateSocialHistory:jest.fn()}));
jest.mock('../../../components/ui',() => ({ShellActionButton:(props:unknown) => require('react').createElement('Action',props)}));
const stats=(id:string,games=24,total=48) => ({account_id:id,username:id,games_participated:games,total_drinks:total,average_drinks:games ? total/games : null});
const view:ReturnType<typeof useSocialHistory>={checking:false,paging:false,error:null,timeline:null,
  refresh:jest.fn(),loadGames:jest.fn(),loadTimeline:jest.fn(),data:{scope:'all_time_completed_online',
    viewer:stats('viewer'),target:stats('Qwerty',30,60),games:{items:[],next_cursor:null},shared:{shared_games:12,
      viewer_total_drinks:18,target_total_drinks:24,viewer_average_drinks:1.5,target_average_drinks:2,
      viewer_higher_count:0,target_higher_count:12,tied_count:0}}};
const personal={data:stats('viewer'),loading:false,error:null,enabled:true,refresh:jest.fn()};
const friends={id:'viewer',items:[{account_id:'friend',username:'Qwerty',relationship:'friends',request_id:null},
  {account_id:'pending',username:'Pending',relationship:'outgoing',request_id:'request'}],
  list:{isFetching:false,error:null,hasNextPage:false},refresh:jest.fn()} as unknown as ReturnType<typeof useFriends>;
function Probe({empty=false}:{empty?:boolean}) {
  const [targetId,onSelect]=useState('');
  return <TamaguiTestProvider><HistoryStatistics history={[]} friends={empty ? {...friends,items:[]} : friends}
    targetId={targetId} onSelect={onSelect} /></TamaguiTestProvider>;
}
let tree:TestRenderer.ReactTestRenderer;
const button=() => tree.root.findAll(node => node.props.accessibilityLabel==='Compare with Qwerty' && typeof node.props.onPress==='function').at(-1)!;
const press=() => act(() => button().props.onPress());
const text=() => tree.root.findAll(node => typeof node.type==='string').flatMap(node => node.children.filter(child => typeof child==='string')).join(' ').replace(/\s+/g,' ');
beforeEach(() => {jest.clearAllMocks();jest.mocked(useSocialHistory).mockReturnValue(view);
  jest.mocked(usePersonalHistoryStats).mockReturnValue(personal);tree=actCreate(<Probe />);});
afterEach(() => act(() => tree.unmount()));
it('shows personal totals and friend summaries before any selection',() => {
  expect(text()).toContain('Your stats');expect(text()).toContain('48.0');
  expect(text()).toContain('12 games together');expect(text()).toContain('30 games · 60.0 drinks');
  expect(useSocialHistory).toHaveBeenCalledWith('friend');expect(text()).not.toContain('Pending');
  expect(text()).not.toContain('Overall totals');
});
it('expands and collapses an inline comparison while keeping personal totals',() => {
  press();expect(button().props.accessibilityState.expanded).toBe(true);
  expect(text()).toContain('Overall totals');expect(text()).toContain('When you played together');
  expect(text()).toContain('18.0');expect(text()).toContain('24.0');expect(text()).toContain('Your stats');
  expect(text()).not.toContain('View shared game');
  press();expect(text()).not.toContain('Overall totals');expect(text()).toContain('Your stats');
});
it('hides every friend statistic during a fresh permission check',() => {
  press();jest.mocked(useSocialHistory).mockReturnValue({...view,data:null,checking:true});
  act(() => tree.update(<Probe />));expect(text()).toContain('Checking access');
  expect(text()).not.toContain('Overall totals');expect(text()).not.toContain('60.0');expect(text()).toContain('48.0');
});
it('keeps personal totals when a friend fails and retries just that friend',() => {
  jest.mocked(useSocialHistory).mockReturnValue({...view,data:null,error:'Shared history is unavailable.'});
  act(() => tree.update(<Probe />));expect(text()).toContain("Friend stats couldn't load");
  expect(text()).toContain('48.0');expect(text()).not.toContain('60.0');
  act(() => tree.root.findByProps({label:'Retry Qwerty'}).props.onPress());expect(view.refresh).toHaveBeenCalled();
});
it('shows personal statistics without friends or games',() => {
  act(() => tree.update(<Probe empty />));expect(text()).toContain('48.0');
  expect(text()).toContain('when you add friends');expect(tree.root.findAllByProps({accessibilityLabel:'Compare with Qwerty'})).toHaveLength(0);
});
it('keeps a selected friend pending until that friend appears in accepted friends',() => {
  const selectedAccountId = 'not-yet-loaded-account';
  const fetchingFriends = {...friends,list:{...friends.list,isFetching:true}};
  act(() => tree.update(<TamaguiTestProvider><HistoryStatistics history={[]} friends={fetchingFriends}
    targetId={selectedAccountId} onSelect={jest.fn()} /></TamaguiTestProvider>));

  expect(text()).toContain('Loading selected friend…');
  expect(text()).not.toContain(selectedAccountId);
  expect(text()).not.toContain('Pending');
  expect(useSocialHistory).not.toHaveBeenCalledWith(selectedAccountId);
});
it('uses unavailable placeholders instead of fabricated zero statistics',() => {
  jest.mocked(usePersonalHistoryStats).mockReturnValue({...personal,data:null,error:'Your statistics could not load.'});
  act(() => tree.update(<Probe empty />));expect(text()).toContain('—');
  expect(text()).not.toContain('48.0');expect(tree.root.findAllByProps({label:'Retry your stats'})).not.toHaveLength(0);
});
