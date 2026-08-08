import pool from './db/index.js';

// Shared logging for the manager gatekeeping upgrade (2026-08-07) — every
// gate decision (pass or reject) is recorded so pass-through rate is
// measurable, not assumed. gate is one of: art_daniel, brand_shira,
// music_elad, qa_talia_yuval.
export async function logGate(gate, itemRef, decision, reason = null) {
  try {
    await pool.query(
      `INSERT INTO gate_log (gate, item_ref, decision, reason, created_at) VALUES ($1,$2,$3,$4,$5)`,
      [gate, itemRef, decision, reason, Date.now()]
    );
  } catch (e) {
    console.error(`gateLog: failed to log ${gate}/${decision} for ${itemRef}:`, e.message);
  }
}
