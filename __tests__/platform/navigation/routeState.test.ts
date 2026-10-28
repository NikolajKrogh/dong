import { historyParams, parseFriendsTab, parseHistoryState, parseSoloStep, resolveStep, SOLO_STEPS, withViewParams } from '../../../platform/navigation/routeState';
const friendId = '00000000-0000-4000-8000-000000000002';
it('preserves legacy comparisons while explicit valid tabs take precedence', () => {
 expect(parseHistoryState({friendId})).toMatchObject({tab:'stats',friendId});
 expect(parseHistoryState({friendId,tab:'players',gameId:'g1'})).toMatchObject({tab:'players',friendId:'',gameId:''});
 expect(parseHistoryState({friendId},friendId)).toMatchObject({tab:'stats',friendId:''});
});
it('rejects ambiguous, malformed and incompatible view parameters', () => {
 expect(parseHistoryState({tab:['stats','players'],friendId,sort:['goals'],direction:'bad',gameId:'../x'})).toEqual({tab:'games',friendId:'',gameId:'',sort:'date',direction:'desc'});
 expect(parseSoloStep({step:['assign']})).toBe('players');
 expect(parseFriendsTab({tab:'unknown'})).toBe('friends');
 expect(parseHistoryState({tab:'games',gameId:'1700000000000'}).gameId).toBe('1700000000000');
});
it('canonicalizes owned keys without dropping return context', () => {
 const state=parseHistoryState({tab:'stats',friendId,sort:'goals',direction:'asc'});
 expect(withViewParams({returnTo:'/friends',gameId:'old'},historyParams(state))).toEqual({returnTo:'/friends',tab:'stats',friendId,sort:'goals',direction:'asc'});
});
it.each([
 { expected: 'players', prerequisites: [true, false, false, false] },
 { expected: 'matches', prerequisites: [true, true, false, false] },
 { expected: 'common', prerequisites: [true, true, true, false] },
 { expected: 'assign', prerequisites: [true, true, true, true] },
])('restores $expected as the earliest available step', ({ expected, prerequisites }) => {
 expect(resolveStep('assign', SOLO_STEPS, prerequisites)).toBe(expected);
});
