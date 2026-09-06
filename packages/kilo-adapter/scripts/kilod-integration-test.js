#!/usr/bin/env node
/**
 * Standalone Kilo integration test.
 *
 * This script runs outside of Jest to verify the real Kilo runtime bridge
 * against a live `kilo serve` process.
 *
 * Usage:
 *   node packages/kilo-adapter/scripts/kilod-integration-test.js
 *
 * Requirements:
 *   - `kilo` CLI installed and in PATH
 *   - Node.js >= 18
 */

import { KiloRuntimeBridge } from '../src/kilo-runtime-bridge.js';

async function main() {
  const port = 4196;
  const bridge = new KiloRuntimeBridge({ port });

  console.log(`[test] Starting Kilo runtime bridge on port ${port}...`);
  await bridge.start();
  console.log('[test] Bridge started');

  console.log('[test] Running health check...');
  const healthy = await bridge.healthCheck();
  console.log(`[test] Health check: ${healthy ? 'OK' : 'FAILED'}`);
  if (!healthy) {
    process.exit(1);
  }

  console.log('[test] Creating session...');
  const sessionId = await bridge.createSession({ title: 'integration-test', agent: 'build', model: 'default' });
  console.log(`[test] Session created: ${sessionId}`);

  console.log('[test] Sending prompt...');
  const result = await bridge.sendPrompt(sessionId, 'Say "hello from Kilo integration test"');
  console.log(`[test] Prompt result: ${JSON.stringify(result)}`);

  console.log('[test] Getting session status...');
  const status = await bridge.getSessionStatus(sessionId);
  console.log(`[test] Session status: ${JSON.stringify(status)}`);

  console.log('[test] Closing session...');
  await bridge.closeSession(sessionId);
  console.log('[test] Session closed');

  console.log('[test] Stopping bridge...');
  await bridge.stop();
  console.log('[test] Bridge stopped');

  console.log('[test] ALL CHECKS PASSED');
}

main().catch((err) => {
  console.error('[test] FAILED:', err);
  process.exit(1);
});
