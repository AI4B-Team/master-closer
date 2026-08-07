
-- Demo/mock data for the existing workspace
INSERT INTO public.agents (id, org_id, name, industry, voice, default_mode, active, system_prompt) VALUES
 ('a1000000-0000-4000-8000-000000000001','85276f69-e68e-4cf4-aed6-636662cae6ab','Ava Close','SaaS','Warm Female','full_ai',true,'You are Ava, a consultative closer for B2B SaaS. Lead with outcomes, never discount first.'),
 ('a1000000-0000-4000-8000-000000000002','85276f69-e68e-4cf4-aed6-636662cae6ab','Marcus Rowe','Home Services','Confident Male','hybrid',true,'You are Marcus. Qualify fast, book the estimate, hand off warm.'),
 ('a1000000-0000-4000-8000-000000000003','85276f69-e68e-4cf4-aed6-636662cae6ab','Nova Assist','Insurance','Neutral','copilot',true,'You whisper the next best line to a human rep. Be exact and short.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.leads (id, org_id, name, email, phone, company, title, source, status, tags, owner_id, consent, notes) VALUES
 ('b1000000-0000-4000-8000-000000000001','85276f69-e68e-4cf4-aed6-636662cae6ab','Dana Whitfield','dana@northbridge.io','+1 305 555 0142','Northbridge Systems','VP Revenue','Inbound Demo','qualified','{"enterprise","warm"}','2765de91-06f6-4de8-ae67-c7dce3fe7f09','express_written','Comparing us against an incumbent. Cares about ramp time.'),
 ('b1000000-0000-4000-8000-000000000002','85276f69-e68e-4cf4-aed6-636662cae6ab','Victor Ellis','victor@ellishvac.com','+1 407 555 0118','Ellis HVAC','Owner','Cold List','contacted','{"smb"}','2765de91-06f6-4de8-ae67-c7dce3fe7f09','implied','Wants after-hours coverage for missed calls.'),
 ('b1000000-0000-4000-8000-000000000003','85276f69-e68e-4cf4-aed6-636662cae6ab','Priya Raman','priya@lumenclinics.com','+1 212 555 0193','Lumen Clinics','Director of Ops','Referral','qualified','{"healthcare","hot"}','2765de91-06f6-4de8-ae67-c7dce3fe7f09','express_written','Compliance-sensitive. Needs consent logging proof.'),
 ('b1000000-0000-4000-8000-000000000004','85276f69-e68e-4cf4-aed6-636662cae6ab','Grant Mosley','grant@mosleyroofing.com','+1 813 555 0177','Mosley Roofing','GM','Cold List','new','{"smb"}',NULL,'unknown','Storm season spike. High lead volume, low pickup rate.'),
 ('b1000000-0000-4000-8000-000000000005','85276f69-e68e-4cf4-aed6-636662cae6ab','Alicia Fontaine','alicia@fontainelegal.com','+1 646 555 0129','Fontaine Legal','Partner','Webinar','contacted','{"legal"}','2765de91-06f6-4de8-ae67-c7dce3fe7f09','implied','All-party consent state. Disclosure required.'),
 ('b1000000-0000-4000-8000-000000000006','85276f69-e68e-4cf4-aed6-636662cae6ab','Ronnie Vega','ronnie@vegafitness.com','+1 786 555 0165','Vega Fitness','Founder','Inbound Demo','customer','{"fitness","expansion"}','2765de91-06f6-4de8-ae67-c7dce3fe7f09','express_written','Live on Copilot mode. Expanding to 3 more locations.'),
 ('b1000000-0000-4000-8000-000000000007','85276f69-e68e-4cf4-aed6-636662cae6ab','Sheila Kwon','sheila@apexsolar.com','+1 480 555 0154','Apex Solar','Sales Director','Cold List','qualified','{"solar","hot"}','2765de91-06f6-4de8-ae67-c7dce3fe7f09','implied','30 reps, wants Copilot for the whole floor.'),
 ('b1000000-0000-4000-8000-000000000008','85276f69-e68e-4cf4-aed6-636662cae6ab','Tom Bradshaw','tom@bradshawauto.com','+1 615 555 0188','Bradshaw Auto Group','Marketing Lead','Referral','unqualified','{"automotive"}',NULL,'opt_out','Asked not to be contacted again.'),
 ('b1000000-0000-4000-8000-000000000009','85276f69-e68e-4cf4-aed6-636662cae6ab','Nina Alvarez','nina@harborinsure.com','+1 305 555 0121','Harbor Insure','COO','Webinar','contacted','{"insurance"}','2765de91-06f6-4de8-ae67-c7dce3fe7f09','express_written','Needs carrier-grade recording retention.'),
 ('b1000000-0000-4000-8000-00000000000a','85276f69-e68e-4cf4-aed6-636662cae6ab','Derek Shaw','derek@shawlogistics.com','+1 972 555 0136','Shaw Logistics','VP Sales','Cold List','new','{"logistics"}',NULL,'unknown','Left voicemail twice.'),
 ('b1000000-0000-4000-8000-00000000000b','85276f69-e68e-4cf4-aed6-636662cae6ab','Camille Reyes','camille@reyesdental.com','+1 561 555 0175','Reyes Dental','Practice Manager','Inbound Demo','qualified','{"healthcare"}','2765de91-06f6-4de8-ae67-c7dce3fe7f09','implied','Front desk misses 40% of calls.'),
 ('b1000000-0000-4000-8000-00000000000c','85276f69-e68e-4cf4-aed6-636662cae6ab','Owen Pratt','owen@prattcapital.com','+1 917 555 0199','Pratt Capital','Managing Director','Referral','customer','{"finance","enterprise"}','2765de91-06f6-4de8-ae67-c7dce3fe7f09','express_written','Annual contract. Hybrid mode across two teams.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.call_lists (id, org_id, name) VALUES
 ('c1000000-0000-4000-8000-000000000001','85276f69-e68e-4cf4-aed6-636662cae6ab','Q3 Home Services — Florida'),
 ('c1000000-0000-4000-8000-000000000002','85276f69-e68e-4cf4-aed6-636662cae6ab','SaaS Renewal Winbacks')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.list_contacts (id, list_id, name, phone, email, attempts, last_outcome, consent) VALUES
 ('d1000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001','Victor Ellis','+1 407 555 0118','victor@ellishvac.com',1,'no_answer','implied'),
 ('d1000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000001','Grant Mosley','+1 813 555 0177','grant@mosleyroofing.com',0,NULL,'unknown'),
 ('d1000000-0000-4000-8000-000000000003','c1000000-0000-4000-8000-000000000001','Maria Santos','+1 305 555 0102','maria@santosplumbing.com',2,'voicemail','implied'),
 ('d1000000-0000-4000-8000-000000000004','c1000000-0000-4000-8000-000000000001','Luis Ortega','+1 786 555 0147','luis@ortegaelectric.com',0,NULL,'unknown'),
 ('d1000000-0000-4000-8000-000000000005','c1000000-0000-4000-8000-000000000001','Kelly Brant','+1 904 555 0163','kelly@brantpools.com',1,'connected','express_written'),
 ('d1000000-0000-4000-8000-000000000006','c1000000-0000-4000-8000-000000000002','Dana Whitfield','+1 305 555 0142','dana@northbridge.io',1,'connected','express_written'),
 ('d1000000-0000-4000-8000-000000000007','c1000000-0000-4000-8000-000000000002','Sheila Kwon','+1 480 555 0154','sheila@apexsolar.com',0,NULL,'implied'),
 ('d1000000-0000-4000-8000-000000000008','c1000000-0000-4000-8000-000000000002','Derek Shaw','+1 972 555 0136','derek@shawlogistics.com',2,'voicemail','unknown'),
 ('d1000000-0000-4000-8000-000000000009','c1000000-0000-4000-8000-000000000002','Nina Alvarez','+1 305 555 0121','nina@harborinsure.com',0,NULL,'express_written'),
 ('d1000000-0000-4000-8000-00000000000a','c1000000-0000-4000-8000-000000000002','Tom Bradshaw','+1 615 555 0188','tom@bradshawauto.com',3,'dnc','opt_out')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.campaigns (id, org_id, name, mode, agent_id, status, list_id, goal, daily_cap) VALUES
 ('e1000000-0000-4000-8000-000000000001','85276f69-e68e-4cf4-aed6-636662cae6ab','Florida Home Services Blitz','full_ai','a1000000-0000-4000-8000-000000000002','active','c1000000-0000-4000-8000-000000000001','Book on-site estimates',150),
 ('e1000000-0000-4000-8000-000000000002','85276f69-e68e-4cf4-aed6-636662cae6ab','SaaS Winback — Hybrid','hybrid','a1000000-0000-4000-8000-000000000001','active','c1000000-0000-4000-8000-000000000002','Reopen lapsed accounts',80),
 ('e1000000-0000-4000-8000-000000000003','85276f69-e68e-4cf4-aed6-636662cae6ab','Copilot Floor Test','copilot','a1000000-0000-4000-8000-000000000003','paused','c1000000-0000-4000-8000-000000000002','Lift rep close rate',40)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.calls (id, org_id, lead_id, agent_id, rep_id, campaign_id, list_contact_id, mode, outcome, disposition, dial_outcome, duration_sec, close_probability, summary, started_at, ended_at) VALUES
 ('f1000000-0000-4000-8000-000000000001','85276f69-e68e-4cf4-aed6-636662cae6ab','b1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','2765de91-06f6-4de8-ae67-c7dce3fe7f09','e1000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000006','hybrid','completed','Connected','connected',412,82,'Priced against incumbent. AI handled the cheaper-competitor objection, warm handoff closed on annual terms.', now() - interval '2 hours', now() - interval '1 hour 53 minutes'),
 ('f1000000-0000-4000-8000-000000000002','85276f69-e68e-4cf4-aed6-636662cae6ab','b1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000002',NULL,'e1000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','full_ai','no_answer','No Answer','no_answer',18,0,'No answer on first attempt.', now() - interval '5 hours', now() - interval '5 hours' + interval '18 seconds'),
 ('f1000000-0000-4000-8000-000000000003','85276f69-e68e-4cf4-aed6-636662cae6ab','b1000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000003','2765de91-06f6-4de8-ae67-c7dce3fe7f09','e1000000-0000-4000-8000-000000000003',NULL,'copilot','completed','Connected','connected',603,74,'Compliance-heavy conversation. Rep delivered disclosure, copilot supplied retention answer.', now() - interval '1 day', now() - interval '1 day' + interval '10 minutes'),
 ('f1000000-0000-4000-8000-000000000004','85276f69-e68e-4cf4-aed6-636662cae6ab','b1000000-0000-4000-8000-000000000007','a1000000-0000-4000-8000-000000000001',NULL,'e1000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000007','full_ai','completed','Connected','connected',289,66,'AI qualified 30-rep floor, booked follow-up with sales director.', now() - interval '1 day 3 hours', now() - interval '1 day 3 hours' + interval '5 minutes'),
 ('f1000000-0000-4000-8000-000000000005','85276f69-e68e-4cf4-aed6-636662cae6ab','b1000000-0000-4000-8000-00000000000a',NULL,'2765de91-06f6-4de8-ae67-c7dce3fe7f09','e1000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000008','copilot','voicemail','Voicemail','voicemail',34,0,'Left voicemail with callback number.', now() - interval '2 days', now() - interval '2 days' + interval '34 seconds'),
 ('f1000000-0000-4000-8000-000000000006','85276f69-e68e-4cf4-aed6-636662cae6ab','b1000000-0000-4000-8000-00000000000b','a1000000-0000-4000-8000-000000000002',NULL,'e1000000-0000-4000-8000-000000000001',NULL,'full_ai','completed','Connected','connected',356,71,'Front-desk overflow use case. AI booked a product walkthrough.', now() - interval '3 days', now() - interval '3 days' + interval '6 minutes'),
 ('f1000000-0000-4000-8000-000000000007','85276f69-e68e-4cf4-aed6-636662cae6ab','b1000000-0000-4000-8000-000000000008',NULL,'2765de91-06f6-4de8-ae67-c7dce3fe7f09','e1000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-00000000000a','copilot','completed','Do Not Call','dnc',47,0,'Prospect requested removal. Added to DNC.', now() - interval '4 days', now() - interval '4 days' + interval '47 seconds'),
 ('f1000000-0000-4000-8000-000000000008','85276f69-e68e-4cf4-aed6-636662cae6ab','b1000000-0000-4000-8000-00000000000c','a1000000-0000-4000-8000-000000000001','2765de91-06f6-4de8-ae67-c7dce3fe7f09','e1000000-0000-4000-8000-000000000002',NULL,'hybrid','completed','Connected','connected',742,88,'Annual renewal expanded to a second team after hybrid handoff.', now() - interval '5 days', now() - interval '5 days' + interval '12 minutes'),
 ('f1000000-0000-4000-8000-000000000009','85276f69-e68e-4cf4-aed6-636662cae6ab','b1000000-0000-4000-8000-000000000005','a1000000-0000-4000-8000-000000000003','2765de91-06f6-4de8-ae67-c7dce3fe7f09','e1000000-0000-4000-8000-000000000003',NULL,'copilot','completed','Busy','busy',9,0,'Line busy.', now() - interval '6 days', now() - interval '6 days' + interval '9 seconds'),
 ('f1000000-0000-4000-8000-00000000000a','85276f69-e68e-4cf4-aed6-636662cae6ab','b1000000-0000-4000-8000-000000000009','a1000000-0000-4000-8000-000000000002',NULL,'e1000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000005','full_ai','completed','Connected','connected',198,58,'Recording retention questions answered, sent compliance one-pager.', now() - interval '7 days', now() - interval '7 days' + interval '3 minutes')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.transcript_segments (id, call_id, speaker, text, ts_sec) VALUES
 ('11100000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001','Master Closer','Quick heads up before we start — this call uses an AI assistant and is recorded for quality and compliance.',0),
 ('11100000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000001','Prospect','Understood. Honestly though, your competitor is cheaper.',12),
 ('11100000-0000-4000-8000-000000000003','f1000000-0000-4000-8000-000000000001','Master Closer','Fair. If they close the same number of deals for you, take the cheaper one. What is your current connect-to-close rate?',22),
 ('11100000-0000-4000-8000-000000000004','f1000000-0000-4000-8000-000000000001','Prospect','About 9 percent, maybe less on cold lists.',38),
 ('11100000-0000-4000-8000-000000000005','f1000000-0000-4000-8000-000000000001','Master Closer','Then price is not the gap, conversion is. Let me bring in Dana''s closer to walk the numbers with you.',49),
 ('11100000-0000-4000-8000-000000000006','f1000000-0000-4000-8000-000000000001','Human Closer','Hi, this is Sarah — I have the context, let''s look at what a two-point lift is worth to you.',63),
 ('11100000-0000-4000-8000-000000000007','f1000000-0000-4000-8000-000000000003','Rep','Before we go on — this call is recorded and an AI assistant is helping me today.',0),
 ('11100000-0000-4000-8000-000000000008','f1000000-0000-4000-8000-000000000003','Prospect','We are in healthcare, so how long are recordings kept?',26),
 ('11100000-0000-4000-8000-000000000009','f1000000-0000-4000-8000-000000000003','Rep','Retention is configurable per workspace, and every disclosure is logged with a timestamp and jurisdiction.',41)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.suggestions (id, call_id, objection, line, was_used, ts_sec) VALUES
 ('12200000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001','Price Comparison','Ask what their connect-to-close rate is before defending price.',true,20),
 ('12200000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000001','Handoff Timing','Momentum is high — transfer to a human closer now.',true,47),
 ('12200000-0000-4000-8000-000000000003','f1000000-0000-4000-8000-000000000003','Compliance Risk','Lead with the audit log: every disclosure is timestamped by jurisdiction.',true,38),
 ('12200000-0000-4000-8000-000000000004','f1000000-0000-4000-8000-000000000003','Stalling','Offer the compliance one-pager and set a decision date.',false,55)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.consent_logs (id, org_id, call_id, method, jurisdiction, notes) VALUES
 ('13300000-0000-4000-8000-000000000001','85276f69-e68e-4cf4-aed6-636662cae6ab','f1000000-0000-4000-8000-000000000001','outbound_pre_connect_audio','FL','Pre-connect audio played before conversation.'),
 ('13300000-0000-4000-8000-000000000002','85276f69-e68e-4cf4-aed6-636662cae6ab','f1000000-0000-4000-8000-000000000001','pre_call_disclosure','FL','Spoken by AI at call open.'),
 ('13300000-0000-4000-8000-000000000003','85276f69-e68e-4cf4-aed6-636662cae6ab','f1000000-0000-4000-8000-000000000003','rep_delivered_disclosure','CA','Rep confirmed delivery before surface unlock.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.deals (id, org_id, lead_id, title, value, stage, close_probability, owner_id, expected_close_at) VALUES
 ('14400000-0000-4000-8000-000000000001','85276f69-e68e-4cf4-aed6-636662cae6ab','b1000000-0000-4000-8000-000000000001','Northbridge — Hybrid Rollout',48000,'negotiation',82,'2765de91-06f6-4de8-ae67-c7dce3fe7f09', current_date + 12),
 ('14400000-0000-4000-8000-000000000002','85276f69-e68e-4cf4-aed6-636662cae6ab','b1000000-0000-4000-8000-000000000003','Lumen Clinics — Compliance Tier',26400,'proposal',64,'2765de91-06f6-4de8-ae67-c7dce3fe7f09', current_date + 21),
 ('14400000-0000-4000-8000-000000000003','85276f69-e68e-4cf4-aed6-636662cae6ab','b1000000-0000-4000-8000-000000000007','Apex Solar — Copilot 30 Seats',36000,'qualifying',45,'2765de91-06f6-4de8-ae67-c7dce3fe7f09', current_date + 30),
 ('14400000-0000-4000-8000-000000000004','85276f69-e68e-4cf4-aed6-636662cae6ab','b1000000-0000-4000-8000-00000000000b','Reyes Dental — AI Reception',9600,'new',25,'2765de91-06f6-4de8-ae67-c7dce3fe7f09', current_date + 45),
 ('14400000-0000-4000-8000-000000000005','85276f69-e68e-4cf4-aed6-636662cae6ab','b1000000-0000-4000-8000-00000000000c','Pratt Capital — Annual Renewal',72000,'won',100,'2765de91-06f6-4de8-ae67-c7dce3fe7f09', current_date - 4),
 ('14400000-0000-4000-8000-000000000006','85276f69-e68e-4cf4-aed6-636662cae6ab','b1000000-0000-4000-8000-000000000008','Bradshaw Auto — Pilot',12000,'lost',0,'2765de91-06f6-4de8-ae67-c7dce3fe7f09', current_date - 10),
 ('14400000-0000-4000-8000-000000000007','85276f69-e68e-4cf4-aed6-636662cae6ab','b1000000-0000-4000-8000-000000000006','Vega Fitness — 3 Location Expansion',18500,'negotiation',70,'2765de91-06f6-4de8-ae67-c7dce3fe7f09', current_date + 9)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.dial_sessions (id, org_id, campaign_id, rep_id, started_at, ended_at, calls_made, connects) VALUES
 ('15500000-0000-4000-8000-000000000001','85276f69-e68e-4cf4-aed6-636662cae6ab','e1000000-0000-4000-8000-000000000001','2765de91-06f6-4de8-ae67-c7dce3fe7f09', now() - interval '1 day', now() - interval '1 day' + interval '2 hours', 64, 11),
 ('15500000-0000-4000-8000-000000000002','85276f69-e68e-4cf4-aed6-636662cae6ab','e1000000-0000-4000-8000-000000000002','2765de91-06f6-4de8-ae67-c7dce3fe7f09', now() - interval '3 hours', NULL, 22, 6)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.objections (id, org_id, trigger, response, category) VALUES
 ('16600000-0000-4000-8000-000000000001','85276f69-e68e-4cf4-aed6-636662cae6ab','Your competitor is cheaper','If they close the same number of deals, take the cheaper one. What is your connect-to-close rate today?','Price'),
 ('16600000-0000-4000-8000-000000000002','85276f69-e68e-4cf4-aed6-636662cae6ab','I need to think about it','Totally fair — is it price, timing, or fit that you are still weighing?','Stall'),
 ('16600000-0000-4000-8000-000000000003','85276f69-e68e-4cf4-aed6-636662cae6ab','Send me some information','Happy to. So I send the right thing, what is the one number you need to move this quarter?','Brush-off'),
 ('16600000-0000-4000-8000-000000000004','85276f69-e68e-4cf4-aed6-636662cae6ab','We already have a vendor','Good — then you already believe in the category. What is the one thing they still cannot do for you?','Incumbent'),
 ('16600000-0000-4000-8000-000000000005','85276f69-e68e-4cf4-aed6-636662cae6ab','I am not the decision maker','Understood. Who else needs to be on the next call for this to actually get decided?','Authority'),
 ('16600000-0000-4000-8000-000000000006','85276f69-e68e-4cf4-aed6-636662cae6ab','Is this a robot?','I am an AI assistant, and I said so at the top of the call. Want me to bring in a human closer now?','Trust')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.playbooks (id, org_id, name, description, content) VALUES
 ('17700000-0000-4000-8000-000000000001','85276f69-e68e-4cf4-aed6-636662cae6ab','Outbound Cold — Home Services','Five-line opener built for owner-operators who answer their own phone.','1. Name the neighborhood. 2. Name the problem (missed calls). 3. One-sentence proof. 4. Ask for the estimate slot. 5. Confirm the time out loud.'),
 ('17700000-0000-4000-8000-000000000002','85276f69-e68e-4cf4-aed6-636662cae6ab','Hybrid Handoff — SaaS Winback','When and how the AI transfers a warm account to a human closer.','Hand off the moment the prospect quantifies pain. Brief the closer in one line: account, objection, next move.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.dnc_list (id, org_id, phone, reason) VALUES
 ('18800000-0000-4000-8000-000000000001','85276f69-e68e-4cf4-aed6-636662cae6ab','+1 615 555 0188','Requested on call'),
 ('18800000-0000-4000-8000-000000000002','85276f69-e68e-4cf4-aed6-636662cae6ab','+1 214 555 0107','National registry match'),
 ('18800000-0000-4000-8000-000000000003','85276f69-e68e-4cf4-aed6-636662cae6ab','+1 503 555 0155','Written opt-out via email')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.integrations (id, org_id, provider, status, config, connected_at) VALUES
 ('19900000-0000-4000-8000-000000000001','85276f69-e68e-4cf4-aed6-636662cae6ab','twilio','disconnected','{"note":"Add carrier credentials to enable live dialing"}',NULL),
 ('19900000-0000-4000-8000-000000000002','85276f69-e68e-4cf4-aed6-636662cae6ab','stripe','disconnected','{"note":"Connect to send payment links from the call"}',NULL),
 ('19900000-0000-4000-8000-000000000003','85276f69-e68e-4cf4-aed6-636662cae6ab','real_elite','connected','{"federation":"hs256"}', now() - interval '9 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.events (id, org_id, event_type, payload, created_at) VALUES
 ('1aa00000-0000-4000-8000-000000000001','85276f69-e68e-4cf4-aed6-636662cae6ab','call.completed','{"call_id":"f1000000-0000-4000-8000-000000000001","mode":"hybrid","dial_outcome":"connected"}', now() - interval '1 hour 53 minutes'),
 ('1aa00000-0000-4000-8000-000000000002','85276f69-e68e-4cf4-aed6-636662cae6ab','lead.flagged_dnc','{"phone":"+1 615 555 0188"}', now() - interval '4 days'),
 ('1aa00000-0000-4000-8000-000000000003','85276f69-e68e-4cf4-aed6-636662cae6ab','deal.won','{"deal_id":"14400000-0000-4000-8000-000000000005","value":72000}', now() - interval '4 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.disclosure_settings (id, org_id, script, spoken_at_call_open, booking_confirmation, outbound_pre_connect_audio, default_jurisdiction)
SELECT '1bb00000-0000-4000-8000-000000000001','85276f69-e68e-4cf4-aed6-636662cae6ab','Quick heads up before we start — this call uses an AI assistant and is recorded for quality and compliance.',true,true,true,'FL'
WHERE NOT EXISTS (SELECT 1 FROM public.disclosure_settings WHERE org_id='85276f69-e68e-4cf4-aed6-636662cae6ab');
