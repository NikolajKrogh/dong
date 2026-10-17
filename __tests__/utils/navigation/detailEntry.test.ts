/**
 * @jest-environment jsdom
 * @jest-environment-options {"url":"http://localhost/history?gameId=g1"}
 */
import { hasDetailListParent, rememberDetailListParent } from '../../../platform/navigation/detailEntry.web';
beforeAll(()=>{globalThis.URLSearchParams=require('node:url').URLSearchParams;});
let callback: FrameRequestCallback;
let currentId = 'entry-one';
beforeEach(() => {
 window.sessionStorage.clear();currentId='entry-one';
 jest.spyOn(window.history,'state','get').mockImplementation(()=>({id:currentId}));
 jest.spyOn(window,'requestAnimationFrame').mockImplementation(fn=>{callback=fn;return 1;});
 jest.spyOn(window,'cancelAnimationFrame').mockImplementation(()=>{});
});
afterEach(()=>jest.restoreAllMocks());
it('remembers only opaque ownership for the current committed detail entry',()=>{
 expect(window.location.search).toBe('?gameId=g1');
 expect(new URLSearchParams(window.location.search).get('gameId')).toBe('g1');
 expect(window.history.state.id).toBe('entry-one');
 expect(hasDetailListParent()).toBe(false);
 const cleanup=rememberDetailListParent('g1');callback(0);
 expect(hasDetailListParent()).toBe(true);
 expect(window.sessionStorage.getItem('dong:history-detail-parents')).toBe('["entry-one"]');
 currentId='entry-two';expect(hasDetailListParent()).toBe(false);cleanup();expect(window.cancelAnimationFrame).toHaveBeenCalledWith(1);
});
it('does not mark a different or not-yet-committed URL',()=>{
 rememberDetailListParent('other-game');callback(0);expect(hasDetailListParent()).toBe(false);
});
it('bounds ownership markers and tolerates unavailable storage',()=>{
 window.sessionStorage.setItem('dong:history-detail-parents',JSON.stringify(Array.from({length:40},(_,index)=>'entry-'+index)));
 rememberDetailListParent('g1');callback(0);
 expect(JSON.parse(window.sessionStorage.getItem('dong:history-detail-parents')!)).toHaveLength(32);
 jest.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw new Error('Unavailable');});
 expect(hasDetailListParent()).toBe(false);expect(()=>rememberDetailListParent('g1')).not.toThrow();
});
