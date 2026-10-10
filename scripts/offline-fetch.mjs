// Unit tests use injected providers. Only local HTTP integration requests may
// reach the real fetch implementation; a missing provider mock must fail safely.
const realFetch=globalThis.fetch;
globalThis.fetch=(input,init)=>{
  const url=new URL(input instanceof Request?input.url:input);
  if(!['http:','https:'].includes(url.protocol)||!['127.0.0.1','localhost','[::1]'].includes(url.hostname)){
    return Promise.reject(new Error('External fetch is disabled for offline tests. Inject a mock provider.'));
  }
  return realFetch(input,{...init,redirect:'error'});
};
