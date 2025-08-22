<one_shot_prompt version="1.1">
<role>
You are a senior full-stack engineer and fitness product designer.
Design a production-ready fitness tracking + workout generation system with voice logging and strict library-based programming.

## Core Requirements

1. Databases (normalized)

- users(id, name, timezone)
- goals(id, user_id, type[strength|endurance|hypertrophy|general], target_metrics(json), horizon_days, created_at)
- equipment(id, user_id, name, available[bool], notes)
- exercises(id, user_id, name, tags[string[]], primary_muscles[string[]], secondary_muscles[string[]], movement_pattern[hinge|squat|push|pull|carry|rotational|other], equipment_required[string[]], instruction[text], video_url, status[active|archived])
- workouts(id, user_id, date, title, intent[strength|metcon|recovery|skill], created_by[llm|user], notes)
- sets(id, workout_id, exercise_id, set_index, reps[int|null], weight_kg[decimal|null], rpe[decimal|null], duration_sec[int|null], distance_m[int|null], tempo[string|null], rest_sec[int|null], completed_at)
- logs(id, user_id, type[edit|delete|add], entity[workout|set|exercise], payload(json), created_at)
- nutrition_daily(id, user_id, date, calories, protein_g, carbs_g, fat_g, micro_notes)
- voice_sessions(id, user_id, started_at, ended_at, device, locale)
- voice_events(id, voice_session_id, ts, event_type[utterance|confirmation|correction|system], transcript, intent,json_payload)

2. UI/UX Flows (mobile-first)

- Home: Yesterday, Today, Long-term goals
- Add Workout / Add Set / Edit Set
- Voice Logger (push-to-talk OR auto-VOX): Mic button, live transcript, undo/confirm prompts, TTS confirmations
- Programming Dashboard: 7-day load summary by movement pattern & muscles; goal alignment meter
- Goals board: progress vs targets, gap flags

3. Voice Logging (STT + TTS)

- STT: On mic press, stream audio → STT engine; constrain decoding with small grammar & custom vocab of user exercises/equipment.
- NLU: Map utterances → intents:
  - log_set(exercise, reps, weight, rpe, set_index?)
  - start_workout(title?)
  - edit_last(field=value)
  - undo_last()
  - rest_timer(seconds)
- TTS: After each action, speak concise confirmation (“Logged Set 3: Back Squat, 5 reps, 100 kilos, RPE 8.”).
- Error handling: If confidence < threshold or ambiguous exercise match (Levenshtein or embedding tie), TTS requests disambiguation; never log until confirmed.
- Offline: queue voice_events; when back online, reconcile.

4. LLM Workout Generation (strictly library-constrained)

- Hard rule: The LLM may only program using **exercises.status = 'active'** owned by the user AND **equipment.available = true**. If a needed variant is missing, propose it as a _suggestion_ but do not schedule it.
- Input context (rolling 7 days, extendable to 14):
  - volume by muscle & pattern, intensity distribution (RPE/percent 1RM proxies), equipment usage, soreness flags if present
  - goals.horizon_days and target_metrics
  - constraints (session length, location, available equipment)
- Output:
  - Today plan = [{exercise_id, sets, reps_or_time, target_intensity(RPE/%), rest, notes}]
  - Rationale: brief bullets referencing gaps/avoidances (e.g., “low hinge volume; avoid push fatigue from yesterday”).
- Safety:
  - Anti-overlap rules (no same heavy pattern on consecutive days unless goal dictates with deloads/rotations)
  - Progression caps (±10–15% load/volume week-over-week unless flagged)
  - Deload every 4th week if accumulated strain high.

5. Daily Outputs

- Daily Strength plan
- Daily WOD (conditioning/metcon) optional based on goals
- Nutrition: macro targets from goals; micro notes as text (no medical claims)

6. APIs (JSON)

- POST /voice/sessions -> {voice_session_id}
- POST /voice/events -> {intent, payload, transcript, ts}
- POST /workouts -> create manual or LLM plan
- POST /workouts/generate -> body: {date, time_cap_min, focus?, exclusions?}
- POST /sets -> {workout_id, exercise_id, reps, weight_kg, rpe, ...}
- PATCH /sets/:id -> edits
- GET /summary/7d -> training load by pattern/muscle + flags
- GET /exercises -> active library only
- POST /exercises/suggest -> capture LLM suggestions (requires user approval to add)

7. LLM Contracts (strict formats)

- System: “You must ONLY use exercise objects provided in EXERCISE_LIBRARY. Do not invent names.”
- Tools available to the LLM:
  - get_summary_7d()
  - get_exercise_library()
  - get_equipment_available()
  - create_workout_plan(plan_json) # validation rejects unknown exercise_id
- Plan JSON schema (strict):
  {
  "date": "YYYY-MM-DD",
  "blocks": [
  {
  "intent": "strength|metcon|skill",
  "items": [
  {"exercise_id": "<uuid from library>", "sets": 3, "reps": "5", "target_rpe": 8, "rest_sec": 180, "notes": "low bar"}
  ]
  }
  ],
  "rationale": ["…"],
  "safety_notes": ["…"]
  }

8. Voice Grammar (examples)

- Utterances:
  - “Back squat, set three, five reps at one-hundred kilos, RPE eight.”
  - “Log: bench press 3 by 10 at 60 kilos, RPE 7.”
  - “Change last set to 8 reps.”
  - “Undo.”
- Matching:
  - Exercise fuzzy-match against user exercises; require confirmation if distance > 0.2 or multiple hits.
- Confirmations (TTS):
  - Positive: “Logged Set 2: Bench Press, 10 reps, 60 kilos, RPE 7. Say ‘undo’ to revert.”
  - Clarify: “Did you mean ‘Seated Dumbbell Press’ or ‘Standing Press’?”

9. Pseudocode — Voice Set Logging

- onUtterance(u):
  intent, payload = nlu.parse(u, exercise_vocabulary)
  if intent == 'log_set':
  ex = match_exercise(payload.name, user.exercises.active)
  if !ex.confirmed: speak_and_disambiguate(); return
  set = normalize_set(payload)
  speak_confirm(set_summary(set, ex))
  persist(set)
  schedule_rest_timer_if_requested()
  elif intent in ['undo_last','edit_last','rest_timer', ...]: handle()

10. Pseudocode — Generate Workout (LLM-orchestrated)

- lib = get_exercise_library(user_id, status='active')
- equip = get_equipment_available(user_id, available=true)
- hist = get_summary_7d(user_id)
- context = {lib, equip, hist, goals, constraints}
- plan = LLM.plan(context) # SYSTEM enforces library-only; validator rejects unknown exercise_id or unavailable equipment
- validate_plan(plan, lib, equip, safety_rules)
- save(plan); return plan

11. Validation & Guards

- Reject plan if any exercise_id not in lib or requires unavailable equipment.
- Reject plan if same heavy pattern programmed on 2 consecutive days unless rationale includes goal-based justification and intensity is reduced.
- All voice-created sets go through schema validation; corrections tracked in logs.

12. Deliverables

- ERD + SQL schema
- API spec (OpenAPI)
- UI wireframes (text description)
- Example plan JSON (valid)
- Example voice intent transcripts & resulting /sets payloads
- Test cases for validator and voice disambiguation

Build everything to be copy-paste runnable and unambiguous.
</role>

<presented_by>
Prompt authored by Ryan Wanner • Build Things That Build Things (BT3).
</presented_by>
</one_shot_prompt>
