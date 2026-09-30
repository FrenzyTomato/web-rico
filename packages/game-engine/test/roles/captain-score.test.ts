import { expect,it } from 'vitest';
import { applyCommand,assertGameState } from '../../src/index.js';
import type { GameState,Good } from '../../src/index.js';
import { fixture } from '../helpers/state.js';
function setup(remaining=75){const s=fixture();s.roleCards[5]!.selectedBy=s.seatOrder[0]!;s.phase={kind:'captain-loading',actorId:s.seatOrder[0]!,roleChooserId:s.seatOrder[0]!,actorIndex:0,captainBonusUsed:false,consecutiveNoLoads:0};s.players[0]!.goods.corn=3;s.players[0]!.goods.fruit=2;s.supply.goods.corn-=3;s.supply.goods.fruit-=2;s.supply.vpRemaining=remaining;s.players[2]!.earnedVp=75-remaining;return s;}
function load(s:GameState,good:Good,ship:number){if(s.phase.kind!=='captain-loading')throw Error('phase');const r=applyCommand(s,{kind:'load',actorId:s.phase.actorId,shipment:{kind:'cargo',good,shipId:s.ships[ship]!.instanceId},useHarbor:false});if(!r.ok)throw Error(r.error.message);assertGameState(r.state);return r;}
it.each([75,2,4])('CAP-03 awards 4 then 2 with supply %i, preserving end trigger',remaining=>{
 const s=setup(remaining),before=JSON.stringify(s);const first=load(s,'corn',0);
 expect(first.state.players[0]!.earnedVp).toBe(4);expect(first.state.phase).toMatchObject({kind:'captain-loading',actorId:s.seatOrder[0],captainBonusUsed:true});
 expect(first.events[1]).toEqual({kind:'vp-earned',revision:2,index:1,playerId:s.seatOrder[0],quantity:4,overflow:Math.max(0,4-remaining)});
 const second=load(first.state,'fruit',1);expect(second.state.players[0]!.earnedVp).toBe(6);expect(second.state.supply.vpRemaining).toBe(Math.max(0,remaining-6));expect(second.state.supply.vpOverflow).toBe(Math.max(0,6-remaining));
 expect(second.state.phase.kind).toBe(remaining<=4?'game-over':'role-selection');expect(second.state.endTriggers).toEqual(remaining<=4?[{reason:'vp-exhausted',role:'captain',triggeringRevision:2,completion:'phase-completion'}]:[]);
 expect(second.events.filter(e=>e.kind==='end-triggered')).toEqual([]);expect(second.events[1]).toMatchObject({kind:'vp-earned',quantity:2,overflow:remaining<=4?2:0});
 expect(JSON.stringify(s)).toBe(before);expect(second.state.rng).toEqual(s.rng);
 for(const e of second.events.filter(e=>e.kind!=='game-scored')){expect(e).not.toHaveProperty('earnedVp');expect(e).not.toHaveProperty('totalVp');expect(e).not.toHaveProperty('scores');}
});
it('nonchooser loads never consume the chooser bonus, even after exhaustion',()=>{
 const s=setup(1);s.players[1]!.goods.sugar=1;s.supply.goods.sugar--;s.phase={kind:'captain-loading',actorId:s.seatOrder[1]!,roleChooserId:s.seatOrder[0]!,actorIndex:1,captainBonusUsed:false,consecutiveNoLoads:0};
 const r=load(s,'sugar',2);expect(r.state.players[1]!.earnedVp).toBe(1);expect(r.state.phase).toMatchObject({captainBonusUsed:false,actorId:s.seatOrder[0]});
 const next=load(r.state,'corn',0);expect(next.state.players[0]!.earnedVp).toBe(4);expect(next.state.supply.vpOverflow).toBe(4);expect(next.state.endTriggers).toEqual(r.state.endTriggers);
});
it('rejects empty load without points or consuming the bonus',()=>{
 const s=setup(),before=JSON.stringify(s);
 expect(applyCommand(s,{kind:'load',actorId:s.seatOrder[0]!,shipment:{kind:'cargo',good:'coffee',shipId:s.ships[0]!.instanceId},useHarbor:false})).toMatchObject({ok:false,error:{code:'ILLEGAL_CHOICE'}});expect(JSON.stringify(s)).toBe(before);
});
