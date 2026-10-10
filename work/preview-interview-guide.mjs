// Dedicated disposable UI QA server. Uses a mock, never Featherless credentials.
import {createApp} from '../psych-simulator-foundation/live/server.mjs';
import {mockProvider} from '../psych-simulator-foundation/live/tests/helpers.mjs';
const {server}=await createApp({provider:mockProvider()});
server.listen(8772,'127.0.0.1',()=>console.log('Interview companion QA only: http://127.0.0.1:8772/'));
