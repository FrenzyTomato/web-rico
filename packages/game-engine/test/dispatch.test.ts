import { expect, it } from 'vitest';
import { applyCommand, getLegalCommands, createId } from '../src/index.js';
import type { GameCommand } from '../src/index.js';
import { fixture } from './helpers/state.js';
function freeze(value: unknown): void {
  if (value && typeof value==='object') { for(const child of Object.values(value)) freeze(child);Object.freeze(value); }
}
const choose = { kind:'choose-role',actorId:createId('player','p0'),roleCardId:createId('role-card','role-0') } as const;
it.each([
  [{...choose,actorId:createId('player','p1')},'WRONG_ACTOR'],
  [{...choose,actorId:createId('player','outsider')},'WRONG_ACTOR'],
  [{kind:'build',actorId:createId('player','p0'),purchase:null},'WRONG_PHASE'],
  [{kind:'not-a-command',actorId:createId('player','p0')},'UNKNOWN_COMMAND'],
  [null,'UNKNOWN_COMMAND'],
  [{kind:'choose-role'},'UNKNOWN_COMMAND'],
] as const)('rejects %j with %s and no mutation', (command,code)=>{
  const s=fixture();const before=JSON.stringify(s);freeze(s);freeze(command);
  const result=applyCommand(s,command as unknown as GameCommand);
  expect(result).toMatchObject({ok:false,error:{code}});
  expect(result).not.toHaveProperty('state');expect(result).not.toHaveProperty('events');
  expect(JSON.stringify(s)).toBe(before);expect(applyCommand(s,command as unknown as GameCommand)).toEqual(result);
});
it('advertises inactive Hacienda decline only to its actor',()=>{
  const s=fixture();s.roleCards[0]!.selectedBy=s.seatOrder[0]!;s.phase={kind:'planter-before',actorId:s.seatOrder[0]!,roleChooserId:s.seatOrder[0]!,actorIndex:0};freeze(s);
  expect(getLegalCommands(s,createId('player','p1'))).toEqual([]);
  expect(getLegalCommands(s,createId('player','outsider'))).toEqual([]);
  expect(getLegalCommands(s,choose.actorId)).toEqual([{phase:'planter-before',actorId:choose.actorId,accept:[false]}]);
  expect(applyCommand(s,{kind:'use-hacienda',actorId:choose.actorId,accept:false}).ok).toBe(true);
});
it('rejects external commands during automatic advancement',()=>{
  const s=fixture();s.roleSelectionIndex=2;
  for(let i=0;i<3;i++)s.roleCards[i]!.selectedBy=s.seatOrder[i]!;
  s.phase={kind:'round-completion'};freeze(s);
  expect(applyCommand(s,choose)).toMatchObject({ok:false,error:{code:'WRONG_PHASE'}});
  expect(getLegalCommands(s,choose.actorId)).toEqual([]);
});
it('rejects all commands after game over',()=>{
  const s=fixture();s.roleCards.find(r=>r.kind==='captain')!.selectedBy=s.seatOrder[0]!;
  s.players[0]!.earnedVp=75;s.supply.vpRemaining=0;
  s.endTriggers=[{reason:'vp-exhausted',role:'captain',triggeringRevision:1,completion:'phase-completion'}];
  s.phase={kind:'game-over',scores:s.players.map((p,i)=>({playerId:p.playerId,earnedVp:p.earnedVp,baseBuildingVp:0,
    bonuses:{'fire-station':0,residence:0,fortress:0,'customs-house':0,'city-hall':0},totalVp:p.earnedVp,tieBreakCoinsAndGoods:2,rank:i===0?1:2}))};
  freeze(s);expect(applyCommand(s,choose)).toMatchObject({ok:false,error:{code:'GAME_OVER'}});
  expect(getLegalCommands(s,choose.actorId)).toEqual([]);
});
it('rejects an invalid engine state before dispatching',()=>{
  const s=fixture();s.supply.goods.corn++;
  expect(()=>applyCommand(s,choose)).toThrow('INVARIANT-001');
  expect(()=>getLegalCommands(s,choose.actorId)).toThrow('INVARIANT-001');
});
