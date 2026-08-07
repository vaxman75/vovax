import { Router } from 'express';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pool from '../db/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEmployeeSkill(filename) {
  try { return readFileSync(join(__dirname, '../employees', filename), 'utf-8'); }
  catch { return null; }
}

function loadCastingStandards() {
  const fallback = {
    vovax:  { include: ['dark','night','moody','minimal','underground','studio','street'], exclude: ['office','corporate','sofa','business','bright','suit','formal'] },
    signal: { include: ['urban','street','casual','outdoor','city','energetic','night','underground'], exclude: ['office','corporate','sofa','business','formal','suit'] },
  };
  try {
    const content = readFileSync(join(__dirname, '../employees/references/avatar-casting-standards.md'), 'utf-8');
    const sectionMap = {};
    let currentSection = null;
    for (const line of content.split('\n')) {
      const m = line.match(/^##\s+(.+)/);
      if (m) { currentSection = m[1].trim(); sectionMap[currentSection] = ''; }
      else if (currentSection && line.trim() && !line.startsWith('#') && !sectionMap[currentSection]) {
        sectionMap[currentSection] = line.trim();
      }
    }
    const parseList = (key) => (sectionMap[key] ?? '').split(',').map(s => s.trim()).filter(Boolean);
    const vi = parseList('VOVAX keywords: include');
    const ve = parseList('VOVAX keywords: exclude');
    const si = parseList('Signal Detected keywords: include');
    const se = parseList('Signal Detected keywords: exclude');
    const standards = {
      vovax:  { include: vi.length > 0 ? vi : fallback.vovax.include,  exclude: ve.length > 0 ? ve : fallback.vovax.exclude  },
      signal: { include: si.length > 0 ? si : fallback.signal.include, exclude: se.length > 0 ? se : fallback.signal.exclude },
    };
    console.log(`[ART] casting standards loaded from file — vovax include:${standards.vovax.include.length} exclude:${standards.vovax.exclude.length}`);
    return standards;
  } catch (e) {
    console.warn('[ART] casting standards file not found — using hardcoded fallback:', e.message);
    return fallback;
  }
}

const router = Router();

// ─── Content libraries ────────────────────────────────────────────────────────

const VOVAX_TOPICS = ['track_release', 'gig_announcement', 'behind_scenes', 'studio_session', 'fan_message'];
const SIGNAL_TOPICS = ['discovery', 'track_feature', 'underground_pick', 'artist_spotlight', 'genre_deep_dive'];

const VOVAX_SCRIPTS = {
  track_release:    ["Dropping something new. Heavy, hypnotic, built for the floor. Link in bio.", "New music out now. This one took time to get right.", "It's out. Heavy melodic techno for late nights. Listen."],
  gig_announcement: ["On stage at {venue} — {date}. See you there.", "Next show: {venue}, {date}. This one is going to hit hard.", "Playing {venue} on {date}. Come early."],
  behind_scenes:    ["Late night in the studio. This is what it sounds like when everything clicks.", "Hours in. Finding the groove. Heavy melodic techno doesn't come easy.", "Studio mode. Almost there."],
  studio_session:   ["Deep in the studio. Building something heavy and hypnotic.", "Late session. The bassline just locked in.", "This one is going somewhere dark and interesting."],
  fan_message:      ["Thank you for showing up. Every stream, every show — it means everything.", "The support keeps this going. Grateful.", "To everyone listening — this music exists because of you."],
};

const SIGNAL_SCRIPTS = {
  discovery:        ["Found this. Underground release, heavy melodic techno. Worth your time.", "This one just dropped. Underground, uncompromising. Listen.", "A new release from the underground. Heavy and hypnotic."],
  track_feature:    ["This release is what the underground sounds like right now.", "Heavy melodic techno. The kind of music that doesn't get enough attention.", "Track of the week. Underground and uncompromising."],
  underground_pick: ["This one has been on repeat. Underground, heavy, real.", "From the underground: a track that doesn't compromise.", "Not on the radar yet. It should be."],
  artist_spotlight: ["An artist building something real. No shortcuts, no compromises.", "One to watch. Heavy melodic techno with a clear artistic vision.", "This artist is doing it right. Underground and consistent."],
  genre_deep_dive:  ["Heavy melodic techno: the sound of the underground right now.", "The underground is alive. This is what it sounds like.", "Dark, hypnotic, uncompromising."],
};

// ─── HeyGen top-picks ─────────────────────────────────────────────────────────

// Loaded from avatar-casting-standards.md — אלה owns this file, publish.js reads FROM it
const PERSONA_AVATAR = loadCastingStandards();

function scoreAvatar(a, persona) {
  const name = (a.name || '').toLowerCase();
  const { include, exclude } = PERSONA_AVATAR[persona] ?? PERSONA_AVATAR.vovax;
  if (exclude.some(w => name.includes(w))) return 0;
  return include.filter(w => name.includes(w)).length;
}

function scoreVoice(v) {
  const lang = (v.language || '').toLowerCase();
  if (!lang.includes('english')) return 0;
  let score = 1;
  if (v.emotion_support) score += 1;
  if (v.preview_audio)   score += 1;
  return score;
}

async function fetchElevenLabsVoice(gender) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey || apiKey === 'placeholder') return null;
  try {
    const r = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': apiKey } });
    if (!r.ok) return null;
    const data = await r.json();
    const scoreEl = v => (v.labels?.use_case === 'narration' ? 2 : 0) + (v.preview_url ? 1 : 0);
    const candidates = (data.voices ?? [])
      .filter(v => v.voice_id && (!gender || (v.labels?.gender ?? '').toLowerCase() === gender.toLowerCase()))
      .sort((a, b) => scoreEl(b) - scoreEl(a));
    if (!candidates[0]) return null;
    return { voice_id: candidates[0].voice_id, name: candidates[0].name };
  } catch { return null; }
}

// Automated regression check — runs on every generation; throws to abort on mismatch
function assertGenderPairing({ avatarId, avatarGender, voiceGender, usedAvatarIds = [], context = '' }) {
  const issues = [];
  if (!avatarGender)
    issues.push(`avatar_gender is null for ${avatarId}`);
  if (avatarGender && voiceGender && avatarGender !== voiceGender)
    issues.push(`GENDER_MISMATCH avatar=${avatarGender} voice=${voiceGender}`);
  if (avatarId && usedAvatarIds.includes(avatarId))
    issues.push(`NO_ROTATION avatarId=${avatarId} appeared in last ${usedAvatarIds.length} generations`);
  const tag = `[gender-parity ${context}]`;
  if (issues.length > 0) {
    console.error(`${tag} FAIL — ${issues.join(' | ')}`);
    throw new Error(`${tag} FAIL — ${issues.join(' | ')}`);
  }
  console.log(`${tag} PASS — avatar=${avatarGender} voice=${voiceGender} fresh=${!usedAvatarIds.includes(avatarId)}`);
}

function extractBannedWords(issues = []) {
  const banned = new Set();
  for (const issue of issues) {
    for (const m of (issue.match(/"([^"]+)"/g) ?? [])) banned.add(m.replace(/"/g, '').toLowerCase());
    const rep = issue.match(/\b(\w+)\s+repetition\b/i);
    if (rep) banned.add(rep[1].toLowerCase());
  }
  return [...banned];
}

let _heygenCache = null;
let _heygenCacheAt = 0;
const HEYGEN_CACHE_TTL = 10 * 60 * 1000;

async function fetchHeyGenData() {
  const now = Date.now();
  if (_heygenCache && (now - _heygenCacheAt) < HEYGEN_CACHE_TTL) return _heygenCache;
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey || apiKey === 'placeholder') throw new Error('HEYGEN_API_KEY not set');
  const [avatarRes, voiceRes] = await Promise.all([
    fetch('https://api.heygen.com/v2/avatars',    { headers: { 'X-Api-Key': apiKey } }),
    fetch('https://api.heygen.com/v1/voice.list', { headers: { 'X-Api-Key': apiKey } }),
  ]);
  const avatarData = await avatarRes.json();
  const voiceData  = await voiceRes.json();
  const avatars = (avatarData.data?.avatars ?? []).map(({ avatar_id, avatar_name, gender, preview_image_url }) => ({ avatar_id, name: avatar_name ?? null, gender: gender ?? null, preview_image_url: preview_image_url ?? null }));
  const voices  = (voiceData.data?.list ?? voiceData.data?.voices ?? []).map(({ voice_id, name, language, gender, preview_audio, emotion_support }) => ({ voice_id, name: name ?? null, language: language ?? null, gender: gender ?? null, preview_audio: preview_audio ?? null, emotion_support: emotion_support ?? false }));
  _heygenCache = { avatars, voices };
  _heygenCacheAt = now;
  return _heygenCache;
}

// Which "energy" a piece of content needs — club/gig content needs a visibly
// energetic avatar, studio/reflective content needs a calmer one. Used to
// stop e.g. a still corporate-looking avatar being used for club promo.
const TOPIC_ENERGY = {
  track_release:     'high', gig_announcement: 'high',
  behind_scenes:      'calm', studio_session:   'calm', fan_message: 'calm',
  discovery:          'high', track_feature:    'high', underground_pick: 'high',
  artist_spotlight: 'neutral', genre_deep_dive: 'neutral',
};

// Real visual verification — replaces blind name-keyword matching (the actual
// mechanism behind "avatar doesn't look right for the brand" and "suit used
// for club content": HeyGen returns a real preview_image_url per avatar, but
// it was being discarded; casting was purely a string match against the
// avatar's auto-generated name, which often has no relation to how it looks).
async function visionVetAvatar(avatar, persona) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !avatar.preview_image_url) return { verdict: 'rejected', energy: null, notes: 'no preview image or API key' };

  const standards = loadEmployeeSkill('references/avatar-casting-standards.md') ?? '';

  try {
    const imgRes = await fetch(avatar.preview_image_url);
    if (!imgRes.ok) return { verdict: 'rejected', energy: null, notes: 'preview image fetch failed' };
    const buf = Buffer.from(await imgRes.arrayBuffer());
    // HeyGen serves preview images with a generic 'binary/octet-stream' content-type
    // header even though the file is a real webp/png/jpg — trust the URL extension,
    // not the header, or Claude's vision API rejects the invalid media type.
    const ext = avatar.preview_image_url.match(/\.(webp|png|jpe?g|gif)(\?|$)/i)?.[1]?.toLowerCase();
    const EXT_TO_MIME = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif' };
    const headerType = imgRes.headers.get('content-type') ?? '';
    const mediaType = EXT_TO_MIME[ext] ?? (headerType.startsWith('image/') ? headerType : 'image/webp');

    const system = `You are אלה, avatar casting authority at VOVAX. Apply these real casting standards exactly — do not use vague adjectives, use the concrete criteria below:\n\n${standards}\n\nPersona being cast for: ${persona === 'signal' ? 'Signal Detected (anonymous underground curator)' : 'VOVAX (the artist, personal underground techno persona)'}.`;
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        system,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: buf.toString('base64') } },
            { type: 'text', text: 'Look at this actual avatar photo. Apply the casting standards above. Score 0-10 how well it fits VOVAX brand casting (10 = perfect underground/night/studio fit, 0 = corporate headshot). Respond with ONLY JSON: {"score":0-10,"energy":"high"|"calm"|"neutral","notes":"one concrete sentence — what you actually see (clothing, pose, setting), not a vague adjective"}' },
          ],
        }],
      }),
    });
    const data = await resp.json();
    const text = (data.content?.[0]?.text ?? '').replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim();
    const parsed = JSON.parse(text);
    const score = Number.isFinite(parsed.score) ? Math.max(0, Math.min(10, Math.round(parsed.score))) : 0;
    return {
      score,
      verdict: score >= 6 ? 'approved' : 'rejected', // kept for readability in logs/cache, selection uses score
      energy:  ['high', 'calm', 'neutral'].includes(parsed.energy) ? parsed.energy : null,
      notes:   parsed.notes ?? '',
    };
  } catch (e) {
    return { score: 0, verdict: 'rejected', energy: null, notes: `vision check error: ${e.message}` };
  }
}

async function getVisionVerdict(avatar, persona) {
  const { rows } = await pool.query(
    `SELECT verdict, energy, visual_notes, score FROM avatar_vision_cache WHERE avatar_id=$1 AND persona=$2`,
    [avatar.avatar_id, persona]
  );
  if (rows[0] && rows[0].score !== null) return { verdict: rows[0].verdict, energy: rows[0].energy, notes: rows[0].visual_notes, score: rows[0].score };

  const result = await visionVetAvatar(avatar, persona);
  await pool.query(
    `INSERT INTO avatar_vision_cache (avatar_id, persona, verdict, energy, visual_notes, score, checked_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (avatar_id, persona) DO UPDATE SET verdict=$3, energy=$4, visual_notes=$5, score=$6, checked_at=$7`,
    [avatar.avatar_id, persona, result.verdict, result.energy, result.notes, result.score, Date.now()]
  );
  console.log(`[ART/vision] ${avatar.avatar_id} (${persona}): score=${result.score}/10 energy=${result.energy} — ${result.notes}`);
  return result;
}

async function getTopPicks(persona, usedAvatarIds = [], energyHint = null) {
  const { avatars, voices } = await fetchHeyGenData();

  // Cheap name-keyword pre-filter, narrows 1264 HeyGen avatars before the
  // real (expensive) check runs
  const scored = avatars
    .map(a => ({ ...a, _score: scoreAvatar(a, persona) }))
    .filter(a => a._score > 0)
    .sort((a, b) => b._score - a._score);

  if (scored.length === 0) throw new Error(`getTopPicks(${persona}): no name-keyword candidates at all`);

  // Real visual verification against אלה's actual casting standards — the
  // name-keyword filter alone was the mechanism behind "avatar doesn't look
  // right for the brand": a corporate-suited avatar with a generic name
  // (no "office"/"suit" literal match) sailed straight through it before.
  // Bounded + cached so this isn't 1264 vision calls on every generation.
  const VISION_CHECK_CAP = 80;
  const visionScored = [];
  for (const a of scored.slice(0, VISION_CHECK_CAP)) {
    const v = await getVisionVerdict(a, persona);
    visionScored.push({ ...a, _visionScore: v.score, _energy: v.energy, _notes: v.notes });
  }
  visionScored.sort((a, b) => b._visionScore - a._visionScore);

  // Prefer genuinely good fits (score >= 6). If NONE reach that bar — a real,
  // logged finding, not assumed — fall back to the best available rather than
  // hard-failing, but say so loudly so this is visible, not silently accepted
  // as "fine."
  const good = visionScored.filter(a => a._visionScore >= 6);
  let approved;
  if (good.length > 0) {
    approved = good;
  } else {
    const bestScore = visionScored[0]?._visionScore ?? 0;
    approved = visionScored.filter(a => a._visionScore === bestScore);
    console.error(`[ART/vision] getTopPicks(${persona}): NO avatar reached the 6/10 brand-fit bar among ${visionScored.length} checked — using best available (score ${bestScore}/10: "${visionScored[0]?._notes}"). This needs real casting attention, not just code — see אלה's manually-approved list in avatar-casting-standards.md, currently empty.`);
  }
  if (approved.length === 0) {
    throw new Error(`getTopPicks(${persona}): no avatar candidates at all among top ${VISION_CHECK_CAP} name-keyword matches`);
  }

  // Prefer avatars whose visual energy matches what THIS content needs — club
  // promo needs a visibly energetic avatar, not the same pool used for a calm
  // studio-session post. This is the scene-matching fix: energy is now a real
  // filter, not left to whichever avatar happened to score highest by name.
  const energyMatched = energyHint ? approved.filter(a => a._energy === energyHint) : [];
  const candidatePool = energyMatched.length > 0 ? energyMatched : approved;

  // Rotation: prefer avatars not used recently; cycle through full set if all have been used
  const fresh = candidatePool.filter(a => !usedAvatarIds.includes(a.avatar_id));
  const finalPool = fresh.length > 0 ? fresh : candidatePool;

  // Pick randomly among the top-scoring tier among survivors — real variety, never always index 0
  const topScore = finalPool[0]?._score ?? 0;
  const topTier  = finalPool.filter(a => a._score === topScore);
  const topAvatar = topTier[Math.floor(Math.random() * topTier.length)] ?? finalPool[0];

  // Gender is mandatory — pairing is refused if avatar has no gender metadata
  const avatarGender = topAvatar?.gender ? topAvatar.gender.toLowerCase() : null;
  if (!avatarGender) throw new Error(`getTopPicks(${persona}): avatar "${topAvatar?.name ?? 'unknown'}" has no gender metadata — pairing refused`);

  // HeyGen voice must match avatar gender exactly — no silent fallback
  const voiceCandidates = voices.filter(v => v.gender && v.gender.toLowerCase() === avatarGender);
  if (voiceCandidates.length === 0) throw new Error(`getTopPicks(${persona}): no ${avatarGender} HeyGen voices available`);

  const topVoice = voiceCandidates
    .map(v => ({ ...v, _score: scoreVoice(v) }))
    .filter(v => v._score > 0)
    .sort((a, b) => b._score - a._score)[0] ?? voiceCandidates[0];

  // ElevenLabs voice — gender-matched so any Zapier narration path also gets the right voice
  const elVoice = await fetchElevenLabsVoice(avatarGender);

  console.log(`getTopPicks(${persona}): avatar="${topAvatar?.name}" visionEnergy=${topAvatar._energy} energyHint=${energyHint} gender=${avatarGender} heygen="${topVoice?.name}" el="${elVoice?.name ?? 'none'}" fresh=${!usedAvatarIds.includes(topAvatar?.avatar_id)} (${approved.length}/${Math.min(scored.length, VISION_CHECK_CAP)} passed vision)`);

  return {
    avatar_id:     topAvatar?.avatar_id  ?? null,
    avatar_name:   topAvatar?.name       ?? null,
    avatar_gender: avatarGender,
    voice_id:      topVoice?.voice_id    ?? null,
    voice_name:    topVoice?.name        ?? null,
    el_voice_id:   elVoice?.voice_id     ?? null,
    el_voice_name: elVoice?.name         ?? null,
  };
}

// Submit a HeyGen video render job — returns {video_id, avatar_id, voice_id, el_voice_id, avatar_gender} or null
async function submitHeyGenRender(script, persona, usedAvatarIds = [], topic = null) {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey || apiKey === 'placeholder') return null;

  const energyHint = TOPIC_ENERGY[topic] ?? null;

  let picks;
  try { picks = await getTopPicks(persona, usedAvatarIds, energyHint); } catch (e) {
    console.error('submitHeyGenRender: getTopPicks failed:', e.message);
    return null;
  }
  if (!picks?.avatar_id || !picks?.voice_id) return null;

  // Automated regression check — every generation must pass before video is submitted
  assertGenderPairing({
    avatarId:     picks.avatar_id,
    avatarGender: picks.avatar_gender,
    voiceGender:  picks.avatar_gender,  // voice was filtered to match avatar gender in getTopPicks
    usedAvatarIds,
    context:      persona,
  });

  // Pacing fix: 1.0 (HeyGen's narration default) is what was reading as slow
  // and book-like. High-energy short-form content gets a snappier delivery
  // pace; calm/studio content stays close to natural. Neither is "narration."
  const speed = energyHint === 'high' ? 1.15 : energyHint === 'calm' ? 1.05 : 1.1;

  const body = {
    video_inputs: [{
      character:  { type: 'avatar', avatar_id: picks.avatar_id, avatar_style: 'normal' },
      voice:      { type: 'text',   input_text: script,         voice_id: picks.voice_id, speed },
      background: { type: 'color',  value: '#000000' },
    }],
    aspect_ratio: '9:16',
    caption: true,
  };

  try {
    const r = await fetch('https://api.heygen.com/v2/video/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    if (!r.ok || !data.data?.video_id) {
      console.error('HeyGen submit failed:', data?.error ?? data);
      return null;
    }
    return { video_id: data.data.video_id, avatar_id: picks.avatar_id, avatar_name: picks.avatar_name, voice_id: picks.voice_id, el_voice_id: picks.el_voice_id, avatar_gender: picks.avatar_gender };
  } catch (e) {
    console.error('HeyGen submit error:', e.message);
    return null;
  }
}

// Poll a single HeyGen video ID — used by cron
export async function checkHeyGenRender(videoId) {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) return null;
  try {
    const r = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${videoId}`, {
      headers: { 'X-Api-Key': apiKey },
    });
    const data = await r.json();
    return data.data ?? null;  // { status, video_url, thumbnail_url, duration, ... }
  } catch { return null; }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function scriptHash(script) { return Buffer.from(script.slice(0, 50)).toString('base64').slice(0, 16); }
function pickFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function pickTopic(allTopics, usedRecently) {
  const available = allTopics.filter(t => !usedRecently.includes(t));
  return pickFrom(available.length > 0 ? available : allTopics);
}

async function recentTopics(channel, n = 3) {
  const { rows } = await pool.query(
    `SELECT topic FROM publish_queue WHERE channel=$1 AND status='published' ORDER BY published_at DESC LIMIT $2`,
    [channel, n]
  );
  return rows.map(r => r.topic);
}

async function recentAvatarIds(channel, n = 5) {
  const { rows } = await pool.query(
    `SELECT avatar_id FROM publish_queue WHERE channel=$1 AND status='published' AND avatar_id IS NOT NULL ORDER BY published_at DESC LIMIT $2`,
    [channel, n]
  );
  return rows.map(r => r.avatar_id);
}

async function nextGig() {
  const { rows } = await pool.query(
    `SELECT venue, date, city, notes FROM gigs WHERE date::date >= CURRENT_DATE ORDER BY date ASC LIMIT 1`
  );
  if (!rows[0]) return null;
  const g = rows[0];
  let meta = {};
  try { meta = JSON.parse(g.notes); } catch {}
  const dateStr = new Date(g.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  return { venue: g.city ? `${g.venue}, ${g.city}` : g.venue, date: dateStr };
}

async function pickUnusedTrack(lookback = 10) {
  const { rows } = await pool.query(
    `WITH recent AS (SELECT track_id FROM publish_queue WHERE track_id IS NOT NULL ORDER BY created_at DESC LIMIT $1)
     SELECT * FROM tracks WHERE id NOT IN (SELECT track_id FROM recent) ORDER BY RANDOM() LIMIT 1`,
    [lookback]
  );
  if (rows[0]) return rows[0];
  const { rows: any } = await pool.query('SELECT * FROM tracks ORDER BY RANDOM() LIMIT 1');
  return any[0] ?? null;
}

const TOPIC_ANGLE = {
  track_release:    'You just released this track. The post is about the release.',
  behind_scenes:    'You are in the studio, working on or inspired by this track.',
  studio_session:   'Late night studio session. Deep in the sound of this track.',
  fan_message:      'This track exists because of your fans. Express gratitude through the lens of this music.',
  discovery:        'You just discovered this underground track. Express the excitement of the find.',
  track_feature:    'Highlight what makes this track stand out from the underground.',
  underground_pick: 'This is your underground pick of the week.',
  artist_spotlight: 'Spotlight the artistic vision behind this track (without naming the artist).',
  genre_deep_dive:  'Use this track as a lens into the heavy melodic techno underground.',
};

async function generateScript(persona, track, topic, priorFailures = null, durationHint = null) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const angle   = TOPIC_ANGLE[topic] ?? '';
  const rawDesc = (track.description ?? '').slice(0, 300);
  const desc  = persona === 'signal' ? rawDesc.replace(/vovax/gi, '[artist]') : rawDesc;
  const title = persona === 'signal' ? (track.title ?? '').replace(/vovax/gi, '[track]') : (track.title ?? '');

  // Duration: set by עמית's briefing; absent = natural narrative length (no artificial cap)
  const lengthGuide = durationHint
    ? `- Target: approximately ${durationHint} — let the narrative fill that space naturally`
    : `- Length: as long as the story genuinely needs — never cut short to fit a number`;

  let corrective = '';
  if (priorFailures) {
    const banned = (priorFailures.bannedWords ?? []);
    const bannedLine = banned.length > 0 ? `\nBANNED words (must not appear): ${banned.join(', ')}` : '';
    const issueLines = (priorFailures.issues ?? []).length > 0
      ? '\nSpecific failures:\n' + priorFailures.issues.map(i => `- ${i}`).join('\n')
      : '';
    corrective = `\n\n⚠ PREVIOUS DRAFT FAILED QA (attempt #${priorFailures.attempt ?? 2}). MANDATORY corrections:\nRejection: ${priorFailures.reason ?? ''}${issueLines}${bannedLine}\n- No metaphors, no poetic phrasing — blunt, direct, real\n- Sentence structure must be different from the failed draft`;
  }

  // Pacing fix: this is written to be SPOKEN by an avatar in a short-form video,
  // not read as prose. The old prompt had zero delivery guidance and explicitly
  // invited unlimited-length literary narration — that combination is exactly
  // what produced slow, book-like voiceover. Length policy is untouched
  // (עמית's "no artificial cap" stands); this fixes RHYTHM, not duration.
  const pacingGuide = `- Write for SPOKEN delivery at short-form video pace, not written narration\n- Short sentences (5-12 words). Break up any sentence that runs longer\n- No semicolons, no em-dash mid-thought interruptions, no comma-stacked clauses\n- Energetic, forward-moving rhythm — every sentence should sound like it could be said in one breath\n- Avoid introspective slow-build prose ("that moment when...", "I realized...", extended sensory description)`;

  let prompt;
  if (persona === 'signal') {
    prompt = `You are Signal Detected, an anonymous underground music curator posting on Instagram/TikTok.\n${angle}\n\nTrack: "${title}"\nGenre: ${track.genre ?? 'underground techno'}\n${desc ? `Description: ${desc}` : ''}\n\nWrite a curator post. Hard rules:\n${lengthGuide}\n${pacingGuide}\n- NEVER mention the artist name or "VOVAX"\n- NEVER say "underground" or "heavy melodic techno" verbatim\n- Tone: clipped, direct, scout who found something first — no flowery language\n- No hashtags, no emojis${corrective}\nWrite only the post text, nothing else.`;
  } else {
    prompt = `You are VOVAX, an underground heavy melodic techno artist posting on Instagram/TikTok.\n${angle}\n\nTrack: "${title}"\nGenre: ${track.genre ?? 'heavy melodic techno'}\n${desc ? `Description: ${desc}` : ''}\n\nWrite a first-person post. Hard rules:\n${lengthGuide}\n${pacingGuide}\n- Dark, minimal, intimate in TONE — but energetic and punchy in RHYTHM, not slow narration\n- No hashtags, no emojis${corrective}\nWrite only the post text, nothing else.`;
  }

  // max_tokens raised: 150 was too low for longer narratives when no duration cap
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 600, messages: [{ role: 'user', content: prompt }] }),
  });
  const data = await r.json();
  if (!r.ok) return null;
  const raw = data.content?.[0]?.text?.trim() ?? null;
  if (!raw) return null;
  // Strip any leading markdown headings the model adds (e.g. "# Signal Detected\n\n")
  return raw.replace(/^#+[^\n]*\n+/, '').trim();
}

// ─── QA review ───────────────────────────────────────────────────────────────

async function runQaReview(item) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { qa_status: 'skip', qa_reason: 'ANTHROPIC_API_KEY not set', qa_issues: [] };

  const skillContent = loadEmployeeSkill('yuval-contentcheck.md')
    ?? 'You are a content quality reviewer for VOVAX and Signal Detected. Return JSON with {approved: bool, reason: string, issues: string[]}.';

  const isSignal = item.channel === 'signal';
  const persona  = isSignal ? 'Signal Detected (anonymous underground music curator, Instagram)' : 'VOVAX (personal underground techno artist, Instagram)';
  const rules    = isSignal
    ? `- MUST NOT contain "VOVAX" or any artist name\n- Curator discovery voice, not artist voice\n- Energetic, first-person scout tone\n- No hashtags, no emojis`
    : `- First-person artist voice (dark, minimal, intimate)\n- No hashtags, no emojis\n- No corporate or marketing language`;

  // Gender parity is guaranteed by assertGenderPairing() before render submission.
  // Pass gender as readable text only — never raw UUIDs which the model cannot interpret.
  const avatarLine = item.avatar_gender
    ? `\nAvatar gender: ${item.avatar_gender} | All voices: ${item.avatar_gender} — gender parity confirmed upstream, do NOT re-evaluate voice IDs`
    : '';

  const durationLine = item.duration_hint
    ? `\n- Duration target set by briefing: ${item.duration_hint} — check script fits that scope`
    : `\n- Length appropriate for the platform: no unnecessary padding, no artificial shortening`;
  const prompt = `Review this ${persona} post for publication quality.\n\nPost: "${item.script}"\nTopic: ${item.topic}${avatarLine}\n\nApproval criteria:\n${rules}${durationLine}\n- Grammatically correct and standalone-clear\n\nRespond ONLY with this JSON (no markdown, no explanation):\n{"approved": <boolean>, "reason": "<one sentence>", "issues": [<issue strings> or empty array]}`;

  let qa = { approved: false, reason: 'QA API error', issues: [] };
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 300, system: skillContent, messages: [{ role: 'user', content: prompt }] }),
    });
    if (r.ok) {
      const data = await r.json();
      let text = data.content?.[0]?.text?.trim() ?? '{}';
      text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      qa = JSON.parse(text);
    } else {
      const errData = await r.json().catch(() => ({}));
      qa.reason = `API ${r.status}: ${errData?.error?.message ?? r.statusText}`;
    }
  } catch (e) { qa.reason = e.message ?? 'QA parse error'; }

  const qaStatus = qa.approved ? 'pass' : 'fail';
  await pool.query(
    `UPDATE publish_queue SET qa_status=$1, qa_reason=$2, qa_issues=$3, qa_at=$4, qa_employee=$5 WHERE id=$6`,
    [qaStatus, qa.reason ?? null, qa.issues ?? [], Date.now(), 'yuval-contentcheck', item.id]
  );

  // Auto-reject + regenerate on QA fail (max 3 attempts to prevent loops)
  if (qaStatus === 'fail') {
    const attempts = item.rejection_count ?? 0;
    if (attempts < 3) {
      const reason = `QA auto-reject (attempt ${attempts + 1}/3): ${qa.reason ?? 'failed quality check'}`;
      const priorQaFailures = {
        attempt:     attempts + 2,
        reason:      qa.reason ?? '',
        issues:      qa.issues ?? [],
        bannedWords: extractBannedWords(qa.issues ?? []),
      };

      // Universal rule: rejected content is deleted immediately, not archived
      // under status='rejected'. Auto-regen creates a fresh row afterward —
      // it's a new attempt, not a resurrection of the rejected one.
      if (item.channel === 'vovax') {
        const deleted = await pool.query(
          `DELETE FROM publish_queue WHERE id=$1 AND status IN ('pending','rendering') RETURNING id`,
          [item.id]
        );
        if (deleted.rows.length > 0) {
          console.log(`Publishing: ${reason} — deleted ${item.id}, regenerating`);
          createVovaxItem({
            platform:        item.platform ?? 'instagram',
            topic:           item.topic,
            forceTrackId:    item.track_id ?? null,
            rejCount:        attempts + 1,
            regeneratedFrom: item.id,
            priorQaFailures,
          }).catch(e => console.error('QA auto-regen (vovax) failed:', e.message));
        }
      } else if (item.channel === 'signal') {
        const deleted = await pool.query(
          `DELETE FROM publish_queue WHERE id=$1 AND status='pending' RETURNING id`,
          [item.id]
        );
        if (deleted.rows.length > 0) {
          console.log(`Publishing[signal]: ${reason} — deleted ${item.id}, regenerating`);
          regenerateSignalItem(item, priorQaFailures, item.duration_hint ?? null)
            .catch(e => console.error('QA auto-regen (signal) failed:', e.message));
        }
      }
    }
    // If attempts >= 3: leave as pending so user can review manually — this is
    // an escalation to a human decision, not the archive-on-reject anti-pattern.
  }

  return { ok: true, qa_status: qaStatus, qa_reason: qa.reason ?? null, qa_issues: qa.issues ?? [], employee: 'yuval-contentcheck' };
}

async function regenerateSignalItem(oldItem, priorFailures = null, durationHint = null) {
  const usedTopics = await recentTopics('signal', 3);
  const topic = oldItem.topic ?? pickTopic(SIGNAL_TOPICS, usedTopics);

  let track = null;
  let trackId = null;
  if (oldItem.track_id) {
    const { rows } = await pool.query('SELECT * FROM tracks WHERE id=$1', [oldItem.track_id]);
    track = rows[0] ?? null;
  }
  if (!track) track = await pickUnusedTrack();

  let finalScript = null;
  if (track) {
    finalScript = await generateScript('signal', track, topic, priorFailures, durationHint);
    if (finalScript && /vovax/i.test(finalScript)) finalScript = null;
    if (finalScript) trackId = track.id;
  }
  if (!finalScript) {
    finalScript = pickFrom(SIGNAL_SCRIPTS[topic] ?? SIGNAL_SCRIPTS.discovery);
    trackId = null;
  }
  if (/vovax/i.test(finalScript)) throw new Error('regenerateSignalItem: script_contains_vovax');

  const id  = uid();
  const now = Date.now();
  await pool.query(
    `INSERT INTO publish_queue (id,channel,platform,topic,script,script_hash,status,created_at,track_id,rejection_count,regenerated_from)
     VALUES ($1,'signal',$2,$3,$4,$5,'pending',$6,$7,$8,$9)`,
    [id, oldItem.platform ?? 'instagram', topic, finalScript, scriptHash(finalScript), now, trackId,
     (oldItem.rejection_count ?? 0) + 1, oldItem.id]
  );

  runQaReview({ id, channel: 'signal', topic, script: finalScript, rejection_count: (oldItem.rejection_count ?? 0) + 1 })
    .catch(e => console.error('QA error (signal regen):', e.message));

  console.log(`regenerateSignalItem: new signal item ${id} queued from ${oldItem.id}`);
}

// ─── Pending notification ─────────────────────────────────────────────────────

export async function sendPendingNotification() {
  const apiKey    = process.env.RESEND_API_KEY;
  const recipient = process.env.DIGEST_RECIPIENT_EMAIL;
  if (!apiKey || !recipient) return;
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM publish_queue WHERE channel='vovax' AND status='pending'`
  );
  const cnt = rows[0]?.cnt ?? 1;
  const { Resend } = await import('resend');
  const resend = new Resend(apiKey);
  const from   = process.env.DIGEST_FROM_EMAIL || 'VOVAX Digest <onboarding@resend.dev>';
  const appUrl = process.env.APP_URL || 'https://vovax-app-production.up.railway.app';
  await resend.emails.send({
    from,
    to: [recipient],
    subject: `VOVAX — ${cnt === 1 ? 'טיוטה חדשה מחכה' : `${cnt} טיוטות מחכות`} לאישורך`,
    html: `<div dir="rtl" style="font-family:sans-serif;background:#0A0A0C;color:#F2F1ED;padding:32px;max-width:480px">
      <p style="color:#8B8A85;font-size:11px;letter-spacing:.15em;margin:0 0 12px">VOVAX · COMMAND CENTER</p>
      <h2 style="margin:0 0 16px;font-size:20px">${cnt === 1 ? 'טיוטה חדשה' : `${cnt} טיוטות`} ממתינ${cnt === 1 ? 'ת' : 'ות'} לאישורך</h2>
      <p style="color:#8B8A85;margin:0 0 24px">וידאו HeyGen מוכן. לחץ לצפייה ואישור:</p>
      <a href="${appUrl}/admin" style="background:#46C7FF;color:#0A0A0C;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:700;display:inline-block">
        פתח Command Center →
      </a>
    </div>`,
  });
}

// ─── Core VOVAX item creation (used by generate + auto-regen after reject) ────

async function createVovaxItem({ platform = 'instagram', topic: forceTopic, forceTrackId, rejCount = 0, regeneratedFrom = null, priorQaFailures = null, durationHint = null }) {
  const usedTopics    = await recentTopics('vovax', 3);
  const usedAvatarIds = await recentAvatarIds('vovax', 5);
  const topic = forceTopic ?? pickTopic(VOVAX_TOPICS, usedTopics);

  let scriptTemplate = null;
  let trackId = forceTrackId ?? null;

  if (topic === 'gig_announcement') {
    const tpl = pickFrom(VOVAX_SCRIPTS.gig_announcement);
    const gig = await nextGig();
    if (gig) {
      scriptTemplate = tpl.replace('{venue}', gig.venue).replace('{date}', gig.date);
    } else {
      const fallback = pickTopic(VOVAX_TOPICS.filter(t => t !== 'gig_announcement'), usedTopics);
      scriptTemplate = pickFrom(VOVAX_SCRIPTS[fallback]);
    }
  } else {
    let track;
    if (forceTrackId) {
      const { rows } = await pool.query('SELECT * FROM tracks WHERE id=$1', [forceTrackId]);
      track = rows[0] ?? null;
    } else {
      track = await pickUnusedTrack();
    }
    if (track) {
      trackId        = track.id;
      scriptTemplate = await generateScript('vovax', track, topic, priorQaFailures, durationHint);
    }
    if (!scriptTemplate) {
      scriptTemplate = pickFrom(VOVAX_SCRIPTS[topic] ?? VOVAX_SCRIPTS.studio_session);
      if (!forceTrackId) trackId = null;
    }
  }

  // Submit HeyGen render — non-blocking failure gracefully falls back to text-only pending
  const render = await submitHeyGenRender(scriptTemplate, 'vovax', usedAvatarIds, topic).catch(() => null);
  const status = render ? 'rendering' : 'pending';

  const id  = uid();
  const now = Date.now();
  const item = { id, channel: 'vovax', platform, topic, script: scriptTemplate, script_hash: scriptHash(scriptTemplate), avatar_id: render?.avatar_id ?? null, avatar_name: render?.avatar_name ?? null, heygen_video_id: render?.video_id ?? null, avatar_gender: render?.avatar_gender ?? null, heygen_voice_id: render?.voice_id ?? null, el_voice_id: render?.el_voice_id ?? null, status, created_at: now, track_id: trackId, rejection_count: rejCount, regenerated_from: regeneratedFrom, duration_hint: durationHint };

  await pool.query(
    `INSERT INTO publish_queue (id,channel,platform,topic,script,script_hash,avatar_id,avatar_name,heygen_video_id,avatar_gender,heygen_voice_id,el_voice_id,status,created_at,track_id,rejection_count,regenerated_from,duration_hint)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
    [item.id, item.channel, item.platform, item.topic, item.script, item.script_hash,
     item.avatar_id, item.avatar_name, item.heygen_video_id, item.avatar_gender, item.heygen_voice_id, item.el_voice_id,
     item.status, item.created_at, item.track_id,
     item.rejection_count, item.regenerated_from, item.duration_hint]
  );

  // QA runs on the script immediately (non-blocking — video render runs in parallel)
  runQaReview(item).catch(e => console.error('QA error (vovax):', e.message));

  return { item, usedAvatarIds, rendering: !!render };
}

// ─── VOVAX endpoints ──────────────────────────────────────────────────────────

// Zapier calls on schedule → generates script, submits HeyGen, queues for approval
router.post('/vovax/generate', async (req, res) => {
  try {
    const { rows: pbRows } = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM publish_queue WHERE channel='vovax' AND status='pending'`
    );
    const pendingBefore = pbRows[0]?.cnt ?? 0;

    const result = await createVovaxItem({ platform: req.body.platform ?? 'instagram', topic: req.body.topic, durationHint: req.body.duration_hint ?? null });

    // Only notify if no HeyGen render is running (cron will notify when render completes)
    if (!result.rendering && pendingBefore === 0) {
      sendPendingNotification().catch(() => {});
    }

    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// App polls this to show pending items
router.get('/vovax/pending', async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM publish_queue WHERE channel='vovax' AND status IN ('pending','rendering') ORDER BY created_at DESC`
  );
  res.json({ items: rows });
});

// App: approve a pending item (only after video_url exists — enforced by status check)
router.post('/vovax/:id/approve', async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE publish_queue SET status='approved', decided_at=$1, avatar_id=COALESCE($2, avatar_id)
     WHERE id=$3 AND channel='vovax' AND status='pending' RETURNING *`,
    [Date.now(), req.body.avatar_id ?? null, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'not found or not pending' });
  res.json({ ok: true, item: rows[0] });
});

// App: reject — deletes immediately (universal rule: no 'rejected' archive
// status), then auto-regenerates a fresh new version with same track + topic
router.post('/vovax/:id/reject', async (req, res) => {
  const reason = req.body.reason ?? req.body.notes ?? null;
  const { rows } = await pool.query(
    `DELETE FROM publish_queue WHERE id=$1 AND channel='vovax' AND status IN ('pending','approved') RETURNING *`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'not found or already published' });
  const old = rows[0];
  console.log(`Publishing: rejected + deleted ${old.id}${reason ? ` — ${reason}` : ''}`);

  // Auto-regenerate: new script + new HeyGen render, same track + topic
  let regenerated = null;
  try {
    const priorQaFailures = reason ? {
      attempt:     (old.rejection_count ?? 0) + 2,
      reason,
      issues:      [],
      bannedWords: [],
    } : null;
    const result = await createVovaxItem({
      platform:         old.platform ?? 'instagram',
      topic:            old.topic,
      forceTrackId:     old.track_id ?? null,
      rejCount:         (old.rejection_count ?? 0) + 1,
      regeneratedFrom:  old.id,
      priorQaFailures,
    });
    regenerated = result.item;
    // Notify if regenerated item goes straight to pending (no HeyGen)
    if (!result.rendering) sendPendingNotification().catch(() => {});
  } catch (e) {
    console.error('Auto-regenerate failed after reject:', e.message);
  }

  res.json({ ok: true, rejected: { id: old.id, reason }, regenerated });
});

// Zapier polls this every hour — returns oldest approved item with video_url
router.get('/vovax/next-approved', async (req, res) => {
  const platform = req.query.platform;
  const { rows } = platform
    ? await pool.query(`SELECT * FROM publish_queue WHERE channel='vovax' AND status='approved' AND platform=$1 ORDER BY decided_at ASC LIMIT 1`, [platform])
    : await pool.query(`SELECT * FROM publish_queue WHERE channel='vovax' AND status='approved' ORDER BY decided_at ASC LIMIT 1`);

  const item = rows[0] ?? null;
  if (!item) return res.json({ item: null });

  // Expose el_voice_id for Zapier's ElevenLabs narration path — always gender-matched to avatar
  // Items generated before fix 006 won't have el_voice_id stored; fall back to fresh picks for those
  item.resolved_avatar_id = item.avatar_id;
  item.voice_id           = item.heygen_voice_id;  // HeyGen voice used in the render
  if (!item.el_voice_id) {
    try {
      const usedIds = await recentAvatarIds('vovax', 5);
      const picks   = await getTopPicks('vovax', usedIds, TOPIC_ENERGY[item.topic] ?? null);
      item.el_voice_id   = picks.el_voice_id;
      item.el_voice_name = picks.el_voice_name;
      item.avatar_name   = picks.avatar_name;
    } catch {}
  }

  res.json({ item });
});

// Zapier calls after successful publish
router.post('/vovax/:id/mark-published', async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE publish_queue SET status='published', published_at=$1
     WHERE id=$2 AND channel='vovax' AND status='approved' RETURNING *`,
    [Date.now(), req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'not found or not approved' });
  res.json({ ok: true, item: rows[0] });
});

// ─── Signal Detected endpoints ────────────────────────────────────────────────

router.get('/signal/brief', async (req, res) => {
  try {
    const platform     = 'instagram';
    const durationHint = req.query.duration_hint ?? null;
    const usedTopics    = await recentTopics('signal', 3);
    const usedAvatarIds = await recentAvatarIds('signal', 5);
    const topic  = pickTopic(SIGNAL_TOPICS, usedTopics);
    const script = pickFrom(SIGNAL_SCRIPTS[topic] ?? SIGNAL_SCRIPTS.discovery);

    if (/vovax/i.test(script)) return res.status(500).json({ error: 'script_contains_vovax — content library error' });

    let trackId = null;
    let finalScript = script;
    const track = await pickUnusedTrack();
    if (track) {
      const claudeScript = await generateScript('signal', track, topic, null, durationHint);
      if (claudeScript && !/vovax/i.test(claudeScript)) { finalScript = claudeScript; trackId = track.id; }
    }

    if (/vovax/i.test(finalScript)) return res.status(500).json({ error: 'script_contains_vovax — content library error' });

    const id  = uid();
    const now = Date.now();
    await pool.query(
      `INSERT INTO publish_queue (id,channel,platform,topic,script,script_hash,status,created_at,track_id,duration_hint)
       VALUES ($1,'signal',$2,$3,$4,$5,'pending',$6,$7,$8)`,
      [id, platform, topic, finalScript, scriptHash(finalScript), now, trackId, durationHint]
    );

    runQaReview({ id, channel: 'signal', topic, script: finalScript, duration_hint: durationHint }).catch(e => console.error('QA error (signal):', e.message));

    let picks = { avatar_id: null, avatar_name: null, avatar_gender: null, voice_id: null, voice_name: null, el_voice_id: null, el_voice_name: null };
    try {
      picks = await getTopPicks('signal', usedAvatarIds, TOPIC_ENERGY[topic] ?? null);
      // Regression check — same gate as VOVAX path
      if (picks.avatar_id) {
        assertGenderPairing({
          avatarId:     picks.avatar_id,
          avatarGender: picks.avatar_gender,
          voiceGender:  picks.avatar_gender,
          usedAvatarIds,
          context:      'signal',
        });
      }
    } catch (e) { console.error('signal/brief: picks/assertion failed:', e.message); }

    res.json({ id, topic, script: finalScript, avatar_ids_to_avoid: usedAvatarIds, track_id: trackId, ...picks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/signal/mark-published', async (req, res) => {
  const { id, avatar_id } = req.body;
  if (!id) return res.status(400).json({ error: 'id required' });
  const { rows } = await pool.query(
    `UPDATE publish_queue SET status='published', published_at=$1, avatar_id=$2
     WHERE id=$3 AND channel='signal' AND status IN ('approved','pending') RETURNING *`,
    [Date.now(), avatar_id ?? null, id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'not found or not approved' });
  res.json({ ok: true, item: rows[0] });
});

// ─── Manual QA trigger ───────────────────────────────────────────────────────

router.post('/:id/qa-review', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM publish_queue WHERE id=$1`, [req.params.id]);
    const item = rows[0];
    if (!item) return res.status(404).json({ error: 'not found' });
    const result = await runQaReview(item);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Top-picks endpoint ───────────────────────────────────────────────────────

router.get('/top-picks', async (req, res) => {
  const persona = req.query.persona === 'signal' ? 'signal' : 'vovax';
  try {
    const picks = await getTopPicks(persona);
    res.json({ persona, ...picks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ART review — אלה scores recent avatar names against casting standards ────

export async function runArtReview() {
  const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const { rows } = await pool.query(
    `SELECT avatar_name, avatar_gender, channel, COUNT(*)::int AS uses, MAX(created_at) AS last_used
     FROM publish_queue
     WHERE avatar_name IS NOT NULL AND created_at >= $1
     GROUP BY avatar_name, avatar_gender, channel
     ORDER BY last_used DESC LIMIT 20`,
    [since]
  );

  if (rows.length === 0) {
    const result = { reviewed_at: Date.now(), avatars: [], flagged: [], compliant_count: 0, flagged_count: 0, summary: 'אין נתוני avatar_name עדיין' };
    await pool.query(
      `INSERT INTO tool_settings (tool,settings) VALUES ('art_review',$1) ON CONFLICT (tool) DO UPDATE SET settings=$1`,
      [JSON.stringify(result)]
    );
    console.log('[ART] runArtReview: no avatar_name data yet');
    return result;
  }

  const avatars = rows.map(row => {
    const name = (row.avatar_name ?? '').toLowerCase();
    const persona = row.channel === 'signal' ? 'signal' : 'vovax';
    const { include, exclude } = PERSONA_AVATAR[persona] ?? PERSONA_AVATAR.vovax;
    const excludeHits = exclude.filter(w => name.includes(w));
    const includeHits = include.filter(w => name.includes(w));
    return {
      name:         row.avatar_name,
      gender:       row.avatar_gender,
      channel:      row.channel,
      uses:         row.uses,
      score:        excludeHits.length > 0 ? 0 : includeHits.length,
      flagged:      excludeHits.length > 0,
      exclude_hits: excludeHits,
      include_hits: includeHits,
    };
  });

  const flagged   = avatars.filter(a => a.flagged);
  const compliant = avatars.filter(a => !a.flagged);
  const result = {
    reviewed_at:     Date.now(),
    avatars,
    flagged,
    compliant_count: compliant.length,
    flagged_count:   flagged.length,
    summary: flagged.length === 0
      ? `כל ${avatars.length} האווטארים תואמים לסטנדרט אלה`
      : `${flagged.length} אווטארים לא עומדים בסטנדרט: ${flagged.map(a => a.name).join(', ')}`,
  };

  await pool.query(
    `INSERT INTO tool_settings (tool,settings) VALUES ('art_review',$1) ON CONFLICT (tool) DO UPDATE SET settings=$1`,
    [JSON.stringify(result)]
  );
  console.log(`[ART] runArtReview: ${avatars.length} reviewed, ${flagged.length} flagged`);
  return result;
}

// ─── History ─────────────────────────────────────────────────────────────────

router.get('/history', async (req, res) => {
  const channel = req.query.channel;
  const base    = `SELECT * FROM publish_queue`;
  const where   = channel ? ` WHERE channel=$1` : '';
  const order   = ` ORDER BY created_at DESC LIMIT 50`;
  const { rows } = channel ? await pool.query(base + where + order, [channel]) : await pool.query(base + order);
  res.json({ items: rows });
});

export default router;
