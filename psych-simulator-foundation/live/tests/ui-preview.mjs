// Manual browser QA only. Never use this injected mock as a live-model demo.
import {createApp} from '../server.mjs';
import {mockProvider} from './helpers.mjs';
const {server}=await createApp({provider:mockProvider()});
server.listen(8771,'127.0.0.1',()=>console.log('MOCK browser QA only: http://127.0.0.1:8771/'));
