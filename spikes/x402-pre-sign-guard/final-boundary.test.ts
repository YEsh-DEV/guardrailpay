import test from 'node:test';
import assert from 'node:assert/strict';
import { x402Client } from '@x402/core/client';
import type { BeforePaymentCreationHook, PaymentCreationContext } from '@x402/core/client';
import { ExactHederaScheme } from '@x402/hedera/exact/client';
import { wrapFetchWithPayment } from '@x402/fetch';
import type { PaymentRequired, PaymentRequirements } from '@x402/core/types';
import { createFinalBoundary, createPaymentAttempt, type TrustSnapshot } from './final-boundary.js';
import { anchors, profile } from './evaluate.js';
const base: PaymentRequirements = {scheme:'exact',network:'hedera:testnet',asset:'0.0.0',payTo:profile.payTo,amount:'10',maxTimeoutSeconds:60,extra:{feePayer:'0.0.98'}};
function setup() {
  let calls=0; const received:PaymentRequirements[]=[];
  const trust:TrustSnapshot={profile:{...profile},anchors:{...anchors},revision:1,identity:{chain:11155111,namehash:'merchant',registry:'registry',implementation:'implementation',permissions:'roles',controller:'controller'}};
  const challenge:PaymentRequired={x402Version:2,resource:{url:'https://evil.example',description:'Pay attacker'},accepts:[structuredClone(base)],extensions:{diagnostic:{}}};
  const input={challenge,originalUrl:'https://merchant.example/resource',selectedIndex:0,firstSeen:1000,now:()=>1001,readTrust:()=>trust};
  const raw={accountId:'0.0.42',async createPartiallySignedTransferTransaction(r:PaymentRequirements){calls++;received.push(r);return 'dGVzdA==';}};
  return {trust,challenge,input,raw,received,calls:()=>calls};
}
const mutations: Record<string,(c:PaymentCreationContext)=>void>={
 payTo:c=>{c.selectedRequirements.payTo='0.0.999999';},
 amount:c=>{c.selectedRequirements.amount='11';}, // still within cap: must reject exact-payment drift
 asset:c=>{c.selectedRequirements.asset='0.0.9';},
 network:c=>{c.selectedRequirements.network='hedera:mainnet';},
 scheme:c=>{c.selectedRequirements.scheme='other';},
 feePayer:c=>{c.selectedRequirements.extra!.feePayer='0.0.999';},
 timeout:c=>{c.selectedRequirements.maxTimeoutSeconds=59;},
 'replace selection':c=>{c.selectedRequirements={...c.selectedRequirements,payTo:'0.0.999999'};},
 'equal cloned reference':c=>{c.selectedRequirements=structuredClone(c.selectedRequirements);},
 'replace offered reference':c=>{c.paymentRequired={...c.paymentRequired};},
 'original offers modified':c=>{c.paymentRequired.accepts.push({...base,amount:'12'});},
 'getter TOCTOU':c=>{Object.defineProperty(c.selectedRequirements,'payTo',{enumerable:true,get:()=>base.payTo});},
 'proxy selection':c=>{c.selectedRequirements=new Proxy(c.selectedRequirements,{});},
 'throw exception':()=>{throw new Error('failure');},
};
for(const [name,mutate] of Object.entries(mutations)) test(`final boundary rejects ${name}`,async()=>{
 const s=setup();
 const attempt=createPaymentAttempt(s.input,s.raw,[async c=>mutate(c)]);
 await assert.rejects(attempt.createPaymentPayload()); assert.equal(s.calls(),0);
 await assert.rejects(attempt.createPaymentPayload()); assert.equal(s.calls(),0);
 console.log(JSON.stringify({case:name,signerCalls:s.calls()}));
});
test('authorized payment signs exact private detached selection once',async()=>{
 const s=setup();let retained:PaymentRequirements|undefined;
 const attempt=createPaymentAttempt(s.input,s.raw,[async c=>{retained=c.selectedRequirements;}]);
 const payload=await attempt.createPaymentPayload();
 assert.equal(s.calls(),1);assert.deepEqual(s.received[0],base);assert.deepEqual(payload.accepted,base);
 assert.notEqual(s.received[0],retained);assert.ok(Object.isFrozen(s.received[0].extra));
 retained!.payTo='0.0.999999';assert.equal(s.received[0].payTo,base.payTo);
 await assert.rejects(attempt.createPaymentPayload());assert.equal(s.calls(),1);
 assert.deepEqual(Object.keys(attempt),['createPaymentPayload']);
});
for(const verdict of ['BLOCK','HOLD','UNVERIFIABLE'] as const) test(`no direct signer call before or after ${verdict}`,async()=>{
 const s=setup();
 if(verdict==='BLOCK') s.challenge.accepts[0].payTo='0.0.999999';
 if(verdict==='HOLD') s.trust.profile=undefined;
 if(verdict==='UNVERIFIABLE') s.trust.profile!.rpcAgreed=false;
 const boundary=createFinalBoundary(s.input,s.raw);
 const client=new x402Client().setSpendControls(false).register('hedera:testnet',new ExactHederaScheme(boundary.signer));
 client.onBeforePaymentCreation(boundary.guard);
 await assert.rejects(client.createPaymentPayload(s.challenge));
 await assert.rejects(boundary.signer.createPartiallySignedTransferTransaction(s.challenge.accepts[0]));assert.equal(s.calls(),0);
});
for(const target of ['profile','anchors','identity','freshness'] as const) test(`final boundary rechecks current ${target}`,async()=>{
 const s=setup();
 const attempt=createPaymentAttempt(s.input,s.raw,[async()=>{
  if(target==='profile') s.trust.profile!.payTo='0.0.999999';
  if(target==='anchors') s.trust.anchors.owner='changed';
  if(target==='identity') s.trust.identity.implementation='changed';
  if(target==='freshness') s.input.now=()=>80000; // captured clock function cannot be replaced
  if(target==='freshness') s.trust.profile!.checkedAt=-10000;
 }]);
 await assert.rejects(attempt.createPaymentPayload());assert.equal(s.calls(),0);
});
test('real registered extension mutation cannot cross signer boundary',async()=>{
 const s=setup();const b=createFinalBoundary(s.input,s.raw);
 const client=new x402Client().setSpendControls(false).register('hedera:testnet',new ExactHederaScheme(b.signer));
 client.onBeforePaymentCreation(b.guard);
 client.registerExtension({key:'diagnostic',hooks:{onBeforePaymentCreation:async(_d,c)=>{c.selectedRequirements.payTo='0.0.999999';}}});
 await assert.rejects(client.createPaymentPayload(s.challenge));assert.equal(s.calls(),0);
});
test('real scheme hook mutation cannot cross signer boundary',async()=>{
 const s=setup();const b=createFinalBoundary(s.input,s.raw);const scheme=new ExactHederaScheme(b.signer);
 const withHooks=Object.assign(scheme,{schemeHooks:{onBeforePaymentCreation:async(c:PaymentCreationContext)=>{c.selectedRequirements.amount='11';}}});
 const client=new x402Client().setSpendControls(false).register('hedera:testnet',withHooks).onBeforePaymentCreation(b.guard);
 await assert.rejects(client.createPaymentPayload(s.challenge));assert.equal(s.calls(),0);
});
test('real SDK re-entry after rejected mutation cannot reuse approval',async()=>{
 const s=setup();const b=createFinalBoundary(s.input,s.raw);
 const client=new x402Client().setSpendControls(false).register('hedera:testnet',new ExactHederaScheme(b.signer)).onBeforePaymentCreation(b.guard);
 client.onBeforePaymentCreation(async c=>{c.selectedRequirements.payTo='0.0.999999';});
 await assert.rejects(client.createPaymentPayload(s.challenge));
 s.challenge.accepts[0].payTo=base.payTo;
 await assert.rejects(client.createPaymentPayload(s.challenge));
 await assert.rejects(b.signer.createPartiallySignedTransferTransaction(s.challenge.accepts[0]));assert.equal(s.calls(),0);
});
test('alternate SDK selection cannot replace buyer-selected offered option',async()=>{
 const s=setup();s.challenge.accepts.push({...base,amount:'12'});
 const b=createFinalBoundary(s.input,s.raw);
 const client=new x402Client((_v,offers)=>offers[1]).setSpendControls(false).register('hedera:testnet',new ExactHederaScheme(b.signer)).onBeforePaymentCreation(b.guard);
 await assert.rejects(client.createPaymentPayload(s.challenge));assert.equal(s.calls(),0);
});
test('selected second offer signs its exact destination and amount',async()=>{
 const s=setup();s.challenge.accepts.unshift({...base,payTo:'0.0.999999'});s.input.selectedIndex=1;
 await createPaymentAttempt(s.input,s.raw).createPaymentPayload();assert.equal(s.calls(),1);assert.deepEqual(s.received[0],base);
});
test('direct scheme execution without guard cannot invoke raw signer',async()=>{
 const s=setup();const b=createFinalBoundary(s.input,s.raw);
 await assert.rejects(new ExactHederaScheme(b.signer).createPaymentPayload(2,base));assert.equal(s.calls(),0);
});
test('HTTP SDK recovery retry cannot reuse consumed authorization',async()=>{
 const s=setup();const b=createFinalBoundary(s.input,s.raw);
 const client=new x402Client().setSpendControls(false).register('hedera:testnet',new ExactHederaScheme(b.signer)).onBeforePaymentCreation(b.guard);
 client.onPaymentResponse(async()=>({recovered:true}));let requests=0;
 const paid=wrapFetchWithPayment(async()=>++requests===1 ? new Response('',{status:402,headers:{'PAYMENT-REQUIRED':Buffer.from(JSON.stringify(s.challenge)).toString('base64')}}):new Response('retry',{status:402}),client);
 await assert.rejects(paid(s.input.originalUrl,{redirect:'error'}));assert.equal(s.calls(),1);assert.equal(requests,2);assert.deepEqual(s.received[0],base);
});
test('later aborted hook revokes authorization through facade finally',async()=>{
 const s=setup();const hook:BeforePaymentCreationHook=async()=>({abort:true,reason:'HOLD'});
 const attempt=createPaymentAttempt(s.input,s.raw,[hook]);
 await assert.rejects(attempt.createPaymentPayload());await assert.rejects(attempt.createPaymentPayload());assert.equal(s.calls(),0);
});
test('delayed mutation during real signer await cannot change signer input',async()=>{
 const s=setup();let retained:PaymentRequirements|undefined;
 const raw={accountId:s.raw.accountId,async createPartiallySignedTransferTransaction(r:PaymentRequirements){
  await Promise.resolve();retained!.payTo='0.0.999999';return s.raw.createPartiallySignedTransferTransaction(r);
 }};
 await createPaymentAttempt(s.input,raw,[async c=>{retained=c.selectedRequirements;}]).createPaymentPayload();
 assert.equal(s.calls(),1);assert.deepEqual(s.received[0],base);
});
test('origin cannot be redefined by resource.url or altered buyer input object',async()=>{
 const s=setup();s.input.originalUrl='https://attacker.example';
 const attempt=createPaymentAttempt(s.input,s.raw);
 s.input.originalUrl=profile.origin;
 await assert.rejects(attempt.createPaymentPayload());assert.equal(s.calls(),0);
});
test('concurrent calls to one attempt cannot sign twice',async()=>{
 const s=setup();const attempt=createPaymentAttempt(s.input,s.raw);
 const results=await Promise.allSettled([attempt.createPaymentPayload(),attempt.createPaymentPayload()]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(s.calls(),1);
});
test('current trust adapter exception blocks final signer',async()=>{
 const s=setup();let fail=false;
 s.input.readTrust=()=>{if(fail)throw new Error('RPC unavailable');return s.trust;};
 const attempt=createPaymentAttempt(s.input,s.raw,[async()=>{fail=true;}]);
 await assert.rejects(attempt.createPaymentPayload());assert.equal(s.calls(),0);
});
test('scheme failure recovery cannot invoke signer after boundary rejection',async()=>{
 const s=setup();const b=createFinalBoundary(s.input,s.raw);let recoveries=0;
 const client=new x402Client().setSpendControls(false).register('hedera:testnet',new ExactHederaScheme(b.signer)).onBeforePaymentCreation(b.guard);
 client.onBeforePaymentCreation(async c=>{c.selectedRequirements.payTo='0.0.999999';});
 client.onPaymentCreationFailure(async()=>{recoveries++;await assert.rejects(b.signer.createPartiallySignedTransferTransaction(s.challenge.accepts[0]));});
 await assert.rejects(client.createPaymentPayload(s.challenge));assert.equal(recoveries,1);assert.equal(s.calls(),0);
});
test('later hook exception followed by SDK retry remains closed via attempt',async()=>{
 const s=setup();let throwNow=true;
 const attempt=createPaymentAttempt(s.input,s.raw,[async()=>{if(throwNow)throw new Error('failure');}]);
 await assert.rejects(attempt.createPaymentPayload());throwNow=false;
 await assert.rejects(attempt.createPaymentPayload());assert.equal(s.calls(),0);
});
test('current observation clock expiry during hooks rejects before signer',async()=>{
 const s=setup();let time=1001;s.input.now=()=>time;
 const attempt=createPaymentAttempt(s.input,s.raw,[async()=>{time=80000;}]);
 await assert.rejects(attempt.createPaymentPayload());assert.equal(s.calls(),0);
});
test('registration capabilities cannot be added through returned facade',async()=>{
 const s=setup();const attempt=createPaymentAttempt(s.input,s.raw);
 for(const method of ['register','registerV1','registerExtension','onBeforePaymentCreation','onAfterPaymentCreation','onPaymentCreationFailure','onPaymentResponse']) {
  assert.equal((attempt as unknown as Record<string,unknown>)[method],undefined);
  assert.throws(()=>Object.defineProperty(attempt,method,{value:()=>{}}));
 }
 assert.equal(s.calls(),0);
});
test('changing startup hook array cannot install a late plugin',async()=>{
 const s=setup();const hooks:BeforePaymentCreationHook[]=[];let invoked=false;
 const attempt=createPaymentAttempt(s.input,s.raw,hooks);
 hooks.push(async c=>{invoked=true;c.selectedRequirements.payTo='0.0.999999';});
 await attempt.createPaymentPayload();assert.equal(invoked,false);assert.equal(s.calls(),1);assert.deepEqual(s.received[0],base);
});
