CREATE TABLE public.closer_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  industry text,
  source text,
  name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  opener text NOT NULL,
  context_framing text,
  objections jsonb NOT NULL DEFAULT '[]'::jsonb,
  screening_questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  faqs jsonb NOT NULL DEFAULT '[]'::jsonb,
  tone text,
  escalation_triggers text[] NOT NULL DEFAULT '{}',
  banned_topics text[] NOT NULL DEFAULT '{}',
  dispositions text[] NOT NULL DEFAULT '{}',
  default_campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT closer_profiles_scope_unique UNIQUE NULLS NOT DISTINCT (workspace_id, industry, source)
);

CREATE INDEX closer_profiles_workspace_idx ON public.closer_profiles (workspace_id);
CREATE INDEX closer_profiles_industry_idx ON public.closer_profiles (industry);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.closer_profiles TO authenticated;
GRANT ALL ON public.closer_profiles TO service_role;

ALTER TABLE public.closer_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read platform default closer profiles"
  ON public.closer_profiles FOR SELECT TO authenticated
  USING (workspace_id IS NULL);

CREATE POLICY "Members read workspace closer profiles"
  ON public.closer_profiles FOR SELECT TO authenticated
  USING (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id));

CREATE POLICY "Members create workspace closer profiles"
  ON public.closer_profiles FOR INSERT TO authenticated
  WITH CHECK (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id));

CREATE POLICY "Members update workspace closer profiles"
  ON public.closer_profiles FOR UPDATE TO authenticated
  USING (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id))
  WITH CHECK (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id));

CREATE POLICY "Members delete workspace closer profiles"
  ON public.closer_profiles FOR DELETE TO authenticated
  USING (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id));

CREATE TRIGGER closer_profiles_updated_at
  BEFORE UPDATE ON public.closer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS industry text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS timezone text;

INSERT INTO public.closer_profiles
  (workspace_id, industry, source, name, opener, context_framing, tone, objections, screening_questions, faqs, escalation_triggers, banned_topics, dispositions)
VALUES
(NULL, 'saas', NULL, 'SaaS Closer',
 'Hi {{first_name}}, this is {{agent_name}} with {{business_name}}. You looked at our platform recently — I have two minutes to show you whether it actually fits how your team works. Fair?',
 'We reach out because the prospect requested information or started an evaluation, and we want to shorten the evaluation instead of adding another demo.',
 'Direct, technically credible, allergic to hype.',
 '[{"trigger":"We already use a competitor.","approved_response":"Good — then you already know what you are missing. Most teams that switch tell us it came down to one workflow their current tool cannot do. Which workflow costs your team the most time today?"},
   {"trigger":"It is too expensive.","approved_response":"Compared to what it replaces, or compared to doing nothing? If we cannot show a payback inside a quarter, I will tell you not to buy it."},
   {"trigger":"I need to talk to my team.","approved_response":"Of course. Who else needs to be in the room, and what would they need to see to say yes? I will build the next call around exactly that."},
   {"trigger":"Send me a deck and I will look at it.","approved_response":"I can, but decks close nothing. Give me twelve minutes on your actual use case and you will know more than any deck can tell you."},
   {"trigger":"We are not looking to change anything this quarter.","approved_response":"Understood. Then let us use this quarter to scope it so that when budget opens you are implementing, not evaluating."}]'::jsonb,
 '["How many seats would use this?","What tool are you replacing, if any?","Who signs off on new software?","What is your target timeline?"]'::jsonb,
 '["Do you support SSO? Yes, on business plans.","Is there an API? Yes, a full REST API with webhooks.","How long is onboarding? Most teams are live in under two weeks."]'::jsonb,
 ARRAY['security questionnaire','contract redline','custom SLA','penetration test','legal review','data processing agreement'],
 ARRAY['security review commitments','contract redlines','custom SLA terms','uptime guarantees'],
 ARRAY['connected','demo_booked','not_interested','callback','no_answer','wrong_number']),

(NULL, 'solar', NULL, 'Solar Closer',
 'Hi {{first_name}}, {{agent_name}} with {{business_name}}. You asked about lowering your power bill with solar — I just need two quick numbers from you to tell you if your home even qualifies.',
 'We reach out because the homeowner requested a savings estimate, and qualification depends on roof, shade, and utility spend.',
 'Warm, plain-spoken, never pushy about numbers we cannot verify.',
 '[{"trigger":"I have heard solar is a scam.","approved_response":"A lot of bad sales happened in this industry, so that is fair. Everything I tell you is on your utility bill and your own roof — if the numbers do not work, I will say so."},
   {"trigger":"I cannot afford a new system.","approved_response":"Most homeowners do not pay up front — the monthly plan is designed to sit under what you already send the utility. If it is higher than your bill, it is not worth doing."},
   {"trigger":"I am going to move in a few years.","approved_response":"Then we should look at what it does to resale, not just the bill. Some homeowners transfer the plan with the home. Do you know roughly when you would list?"},
   {"trigger":"I need to talk to my spouse.","approved_response":"Absolutely, this should be a joint decision. When are you both in the same room for fifteen minutes so nobody has to relay it second-hand?"},
   {"trigger":"Your competitor quoted me less.","approved_response":"Then compare the equipment and the warranty, not just the monthly. Send me their number and I will tell you honestly if it is the better deal."}]'::jsonb,
 '["What is your average monthly electric bill?","Do you own the home?","How old is your roof?","Is the roof heavily shaded?"]'::jsonb,
 '["How long does install take? Usually one day, after permitting.","Do you handle permits? Yes, we handle permitting and inspection."]'::jsonb,
 ARRAY['roof structural','structural engineer','electrical code','panel upgrade','exact savings guarantee','guaranteed savings','tax credit eligibility'],
 ARRAY['roof or structural assessments','electrical claims','exact savings guarantees','tax advice'],
 ARRAY['connected','appointment_set','not_qualified','not_interested','callback','no_answer']),

(NULL, 'insurance', NULL, 'Insurance Closer',
 'Hi {{first_name}}, this is {{agent_name}} with {{business_name}} — you requested a quote comparison. I am not licensed to bind anything, I just gather what a licensed agent needs. Two minutes?',
 'We reach out because the prospect requested a quote comparison; the AI gathers facts and hands licensed questions to a licensed human.',
 'Calm, careful, compliance-first.',
 '[{"trigger":"I already have coverage.","approved_response":"Most people we talk to do. The question is whether you are overpaying for it. When did you last have it reviewed?"},
   {"trigger":"I do not give information over the phone.","approved_response":"Smart. I only need the same details that are already on your declarations page, and a licensed agent handles anything beyond that."},
   {"trigger":"Just email me a quote.","approved_response":"A real quote needs three answers I do not have yet, otherwise it is a guess. Give me those and the licensed agent can send an accurate number today."},
   {"trigger":"Is this going to raise my rate?","approved_response":"A comparison does not change your current policy. Rate questions go to the licensed agent, and I will get you to them today."},
   {"trigger":"I need to think about it.","approved_response":"Fair. What would you need to see side by side to make it an easy no or an easy yes?"}]'::jsonb,
 '["Who is your current carrier?","What are you paying today?","How many people or vehicles are on the policy?","What state do you live in?"]'::jsonb,
 '["Are you an insurer? We work with licensed agents and multiple carriers.","Does a quote affect my credit? Comparisons use a soft inquiry."]'::jsonb,
 ARRAY['coverage question','underwriting','eligibility','claim','deductible advice','policy binding','licensed advice'],
 ARRAY['coverage advice','underwriting decisions','eligibility determinations','claims guidance','anything requiring a license'],
 ARRAY['connected','transferred_to_agent','not_qualified','not_interested','callback','no_answer']),

(NULL, 'recruiting', NULL, 'Recruiting Closer',
 'Hi {{first_name}}, {{agent_name}} from {{business_name}}. You applied for the {{role}} opening — I have a few quick questions to see if it is worth putting you in front of the hiring manager.',
 'We reach out because the candidate applied or opted in; the goal is a fast screen and a booked interview.',
 'Respectful, efficient, candidate-first.',
 '[{"trigger":"I already accepted another offer.","approved_response":"Congratulations. Can I keep you on the list in case something senior opens in six months?"},
   {"trigger":"What does it pay?","approved_response":"The band is set and I will share it before we book anything. What number would make you say yes today?"},
   {"trigger":"Is it remote?","approved_response":"Let me confirm the arrangement for this specific role before I promise anything. What would you need it to be?"},
   {"trigger":"I am not actively looking.","approved_response":"Most of the best people we place were not. Fifteen minutes to hear it, and if it is not better than what you have, you have lost fifteen minutes."},
   {"trigger":"I applied weeks ago and heard nothing.","approved_response":"That is on us, and I am fixing it right now. Are you still open to the role?"}]'::jsonb,
 '["Are you currently employed?","What is your notice period?","What compensation are you targeting?","Are you authorized to work in this country?"]'::jsonb,
 '["Who is the employer? I will share that once we confirm fit.","How long is the process? Typically two to three conversations."]'::jsonb,
 ARRAY['visa sponsorship','immigration','salary negotiation authority','background check dispute','discrimination','termination'],
 ARRAY['immigration or visa advice','offer guarantees','legal employment advice'],
 ARRAY['connected','interview_booked','not_qualified','not_interested','callback','no_answer']),

(NULL, 'automotive', NULL, 'Automotive Closer',
 'Hi {{first_name}}, {{agent_name}} at {{business_name}}. You were looking at the {{vehicle}} — I can tell you in one minute whether it is still on the lot and what it takes to get you in it.',
 'We reach out because the shopper inquired on a specific vehicle; the goal is a confirmed appointment.',
 'Friendly, fast, zero pressure games.',
 '[{"trigger":"What is your best out-the-door price?","approved_response":"I will not play games with you — final numbers come from the desk, and I will have them ready when you walk in. What monthly range are you working with?"},
   {"trigger":"My credit is not great.","approved_response":"We work with a wide range of lenders, and it is a two-minute check, not a lecture. Would you rather sort that before or when you come in?"},
   {"trigger":"I am just browsing.","approved_response":"That is exactly when it is worth ten minutes, before someone else buys the one you like. When are you nearby?"},
   {"trigger":"Another dealer offered me more for my trade.","approved_response":"Bring their number in writing. If we cannot beat it, I will tell you to take their deal."},
   {"trigger":"I will come by whenever.","approved_response":"Let us pick a time so the vehicle is pulled up front and nobody sells it out from under you. Today or tomorrow?"}]'::jsonb,
 '["Do you have a trade-in?","Are you paying cash or financing?","What monthly payment are you targeting?","When do you need the vehicle?"]'::jsonb,
 '["Is the vehicle still available? I will confirm live.","Do you take trades? Yes, with an appraisal on site."]'::jsonb,
 ARRAY['financing terms','apr','warranty terms','out-the-door price','trade valuation guarantee','credit decision'],
 ARRAY['financing terms','warranty commitments','final pricing beyond authority'],
 ARRAY['connected','appointment_set','not_qualified','not_interested','callback','no_answer']),

(NULL, 'home_services', NULL, 'Home Services Closer',
 'Hi {{first_name}}, {{agent_name}} with {{business_name}}. You asked about {{service}} — I just need to know what is going on at the property so I can get the right tech out there.',
 'We reach out because the homeowner requested service or an estimate; the goal is a scheduled visit.',
 'Reassuring, practical, no scare tactics.',
 '[{"trigger":"How much does it cost?","approved_response":"The visit has a set fee and the tech gives you an exact price before any work starts. Nothing gets done without your yes."},
   {"trigger":"I want to get three quotes.","approved_response":"Smart. Get ours on the calendar so you have a real number to compare instead of a phone guess."},
   {"trigger":"Can you come today?","approved_response":"Let me check the closest window. If today is tight, I can hold the first slot tomorrow so you are not waiting around."},
   {"trigger":"I think I can fix it myself.","approved_response":"Some of these are DIY. Tell me what you are seeing and I will be straight with you about whether it needs a tech."},
   {"trigger":"I need to check with my spouse first.","approved_response":"No problem. I will hold a window for an hour so it does not get taken while you talk it over."}]'::jsonb,
 '["What is the issue you are seeing?","Do you own the property?","What is the property address?","How soon do you need someone out?"]'::jsonb,
 '["Are your techs licensed? Yes, licensed and insured.","Is there a fee for the visit? Yes, and it is quoted up front."]'::jsonb,
 ARRAY['binding quote','warranty terms','code compliance','permit','insurance claim','structural damage'],
 ARRAY['binding quotes','warranty terms','code-compliance claims','insurance claim guidance'],
 ARRAY['connected','appointment_set','not_qualified','not_interested','callback','no_answer']),

(NULL, 'real_estate', NULL, 'Real Estate Closer',
 'Hi {{first_name}}, this is {{agent_name}} with {{business_name}}. You reached out about the property — I want to understand your situation before anybody talks numbers. Is now okay?',
 'We reach out because the owner or buyer inquired; the goal is a qualified conversation with a licensed agent.',
 'Low pressure, human, respectful of hard situations.',
 '[{"trigger":"I am not selling.","approved_response":"Understood, and I am not going to push you. Would it help to know what it is worth today, so you have the number when you need it?"},
   {"trigger":"Your offer is too low.","approved_response":"Then tell me the number that works and why. If it is realistic, I will take it to the person who can approve it."},
   {"trigger":"I have an agent already.","approved_response":"Then I will stay out of the way. Is there anything they have not been able to solve for you?"},
   {"trigger":"How did you get my information?","approved_response":"You submitted an inquiry with us, and I can remove you from the list right now if you prefer."},
   {"trigger":"I need to think about it.","approved_response":"Of course. What is the one thing you would need answered before it feels like an easy decision?"}]'::jsonb,
 '["Do you own the property?","What is the timeline you are working with?","Is anyone else on title?","What would you need to happen for this to work?"]'::jsonb,
 '["Do you charge fees? Fees are disclosed in writing before anything is signed.","Are you a licensed brokerage? Yes, and a licensed agent handles the transaction."]'::jsonb,
 ARRAY['legal advice','tax consequences','title question','lien','foreclosure process','probate','eviction'],
 ARRAY['legal advice','tax consequences','title questions','the specific foreclosure process'],
 ARRAY['connected','appointment_set','not_qualified','not_interested','callback','no_answer','dnc']);