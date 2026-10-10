import React from 'react';
import TestRenderer from 'react-test-renderer';
import {actCreate} from '../../../test-utils/render';
import {TamaguiTestProvider} from '../../../test-utils/tamagui';
import SharedHistoryScreen from '../../../features/history/SharedHistoryScreen';
import {useSocialHistory} from '../../../features/history/useSocialHistory';
import type {SocialHistory} from '../../../features/history/socialHistoryRepository';
jest.mock('../../../features/history/useSocialHistory',() => ({useSocialHistory:jest.fn()}));
const mockBack=jest.fn(),mockReplace=jest.fn();
const mockRouteParams = {accountId:'00000000-0000-4000-8000-000000000001',returnTo:'/history'};
jest.mock('expo-router',() => ({useLocalSearchParams:() => mockRouteParams,
  useRouter:() => ({canGoBack:() => false,back:mockBack,replace:mockReplace})}));
jest.mock('../../../components/preferences/SettingsPage',() => (props:Record<string,unknown>) =>
  require('react').createElement('Page',props,props.children));
jest.mock('../../../components/ui',() => ({ShellActionButton:(props:Record<string,unknown>) =>
  require('react').createElement('Action',props)}));
jest.mock('../../../components/history/GameDetailsModal',() => (props:Record<string,unknown>) =>
  require('react').createElement('GameDetails',props));
const stats=(id:string,name:string) => ({account_id:id,username:name,games_participated:3,total_drinks:12,average_drinks:4});
const game={id:'shared',date:'2026-10-01T12:00Z',players:[{id:'p',name:'Recorded name',drinksTaken:2,leftAt:'2026-10-01T11:30Z'}],
  matches:[],commonMatchId:null,playerAssignments:{},matchesPerPlayer:0};
const fixture:SocialHistory={scope:'all_time_completed_online',viewer:stats('viewer','Me'),
  target:stats('00000000-0000-4000-8000-000000000001','Friend'),
  shared:{shared_games:2,viewer_total_drinks:6,target_total_drinks:6,viewer_average_drinks:3,target_average_drinks:3,
    viewer_higher_count:1,target_higher_count:1,tied_count:0},games:{items:[game],next_cursor:null}};
const state=():ReturnType<typeof useSocialHistory> => ({data:fixture,timeline:null,checking:false,paging:false,error:null,
  refresh:jest.fn(),loadGames:jest.fn(),loadTimeline:jest.fn()});
let tree:TestRenderer.ReactTestRenderer;
beforeEach(() => {jest.clearAllMocks();mockRouteParams.accountId='00000000-0000-4000-8000-000000000001';
  jest.mocked(useSocialHistory).mockReturnValue(state());});
afterEach(() => {TestRenderer.act(() => tree.unmount());});
const screenText=() => tree.root.findAll(node => typeof node.type==='string').flatMap(node => node.children.filter(child => typeof child==='string')).join(' ');
const render=() => {tree=actCreate(<TamaguiTestProvider><SharedHistoryScreen /></TamaguiTestProvider>);return tree;};
it('labels overall/shared scopes and early departures and opens only shared details',() => {
  render(); const text=screenText();
  expect(text).toContain('Overall stats'); expect(text).toContain('Your games together');
  expect(text).toContain('Left early'); expect(text).toContain('All time');
  const button=tree.root.findAllByType('Action' as never).find(node => node.props.label.startsWith('View shared game'));
  TestRenderer.act(() => button!.props.onPress());
  expect(tree.root.findByType('GameDetails' as never).props.game.id).toBe('shared');
});
it('removes an open detail modal when permission data disappears',() => {
  render(); const button=tree.root.findAllByType('Action' as never).find(node => node.props.label.startsWith('View shared game'));
  TestRenderer.act(() => button!.props.onPress());
  jest.mocked(useSocialHistory).mockReturnValue({...state(),data:null,checking:true} as ReturnType<typeof useSocialHistory>);
  TestRenderer.act(() => tree.update(<TamaguiTestProvider><SharedHistoryScreen /></TamaguiTestProvider>));
  expect(tree.root.findAllByType('GameDetails' as never)).toHaveLength(0);
  expect(screenText()).not.toContain('12.0 total drinks');
});
it('keeps overall totals visible when there are no games together',() => {
  const value=state();
  value.data={...fixture,games:{items:[],next_cursor:null},shared:{...fixture.shared,shared_games:0,
    viewer_total_drinks:0,target_total_drinks:0,viewer_average_drinks:null,target_average_drinks:null,
    viewer_higher_count:0,target_higher_count:0,tied_count:0}};
  jest.mocked(useSocialHistory).mockReturnValue(value); render();
  expect(screenText()).toContain('No completed online games together yet');
  expect(screenText()).toContain('Unavailable');
});
it('does not pass a malformed account ID to the shared history hook',() => {
  mockRouteParams.accountId='not-an-account-id';
  render();
  expect(useSocialHistory).toHaveBeenCalledWith('');
});
it('labels partial timelines and uses a safe direct-link Back fallback',() => {
  jest.mocked(useSocialHistory).mockReturnValue({...state(),timeline:{items:[],next_cursor:'more'}});
  render(); expect(screenText()).toContain('Partial');
  TestRenderer.act(() => tree.root.findByType('Page' as never).props.onBack());
  expect(mockReplace).toHaveBeenCalledWith('/history');
});
