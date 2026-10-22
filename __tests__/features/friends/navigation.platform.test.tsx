import React from 'react';
import TestRenderer from 'react-test-renderer';
import { actCreate } from '../../../test-utils/render';
const mockRouter={push:jest.fn(),replace:jest.fn(),back:jest.fn(),canGoBack:jest.fn(()=>true),setParams:jest.fn()};
let mockParams:Record<string,string|string[]>={tab:'requests'};
let mockStatus='ready';
let mockEnabled=true;
jest.mock('expo-router',()=>({useRouter:()=>mockRouter,useLocalSearchParams:()=>mockParams}));
jest.mock('expo-linking',()=>({createURL:jest.fn()}));
jest.mock('tamagui',()=>({...jest.requireActual('tamagui'),Text:'Text',XStack:'XStack',YStack:'YStack'}));
jest.mock('../../../components/ui',()=>({ShellActionButton:'Action'}));
jest.mock('../../../components/preferences/SettingsPage',()=>({__esModule:true,default:({children,...props}:any)=>require('react').createElement('Page',props,children)}));
jest.mock('../../../features/friends/FriendSearchField',()=>({__esModule:true,default:'Search'}));
jest.mock('../../../features/friends/PeopleList',()=>({__esModule:true,default:'People'}));
jest.mock('../../../features/friends/RequestsPanel',()=>({__esModule:true,default:'Requests'}));
jest.mock('../../../hooks/useAccountAuth',()=>({useAccountAuth:()=>({status:mockStatus})}));
jest.mock('../../../features/friends/useFriends',()=>({useFriends:()=>({enabled:mockEnabled,items:[],results:[],list:{},search:{},refresh:jest.fn()})}));
beforeEach(()=>{jest.clearAllMocks();mockParams={tab:'requests'};mockEnabled=true;mockStatus='ready';mockRouter.canGoBack.mockReturnValue(true);});
const render=(file:string)=>actCreate(React.createElement(require('../../../test-utils/tamagui').TamaguiTestProvider,null,React.createElement(require('../../../features/friends/'+file).default)));
it.each(['FindFriendsScreen','BlockedAccountsScreen'])('%s returns to the existing Requests caller without replacing it',file=>{
 const tree=render(file); TestRenderer.act(()=>tree.root.findByType('Page' as React.ElementType).props.onBack());
 expect(mockRouter.back).toHaveBeenCalledTimes(1);expect(mockRouter.replace).not.toHaveBeenCalled();
});
it('preserves Requests in child fallback and leaves Friends for its actual caller',()=>{
 mockRouter.canGoBack.mockReturnValue(false);let tree=render('FindFriendsScreen');TestRenderer.act(()=>tree.root.findByType('Page' as React.ElementType).props.onBack());
 expect(mockRouter.replace).toHaveBeenCalledWith({pathname:'/friends',params:{tab:'requests'}});
 tree=render('FriendsScreen');expect(tree.root.findAllByType('Requests' as React.ElementType)).toHaveLength(1);
 mockRouter.canGoBack.mockReturnValue(true);TestRenderer.act(()=>tree.root.findByType('Page' as React.ElementType).props.onBack());expect(mockRouter.back).toHaveBeenCalledTimes(1);
});
it('uses a fixed intended destination for sign-in and supplies direct Home recovery',()=>{
 mockEnabled=false;mockStatus='signedOut';const tree=render('FriendsScreen');
 const actions=tree.root.findAllByType('Action' as React.ElementType);
 expect(actions.find(a=>a.props.label==='Sign in')!.props.href).toBe('/auth?returnTo=%2Ffriends%3Ftab%3Drequests');
 expect(actions.find(a=>a.props.label==='Home')!.props.href).toBe('/');
});
it('does not offer sign-in while account hydration is pending',()=>{
 mockEnabled=false;mockStatus='loading';const tree=render('FriendsScreen');expect(tree.root.findAllByType('Action' as React.ElementType).some(a=>a.props.label==='Sign in')).toBe(false);
});
