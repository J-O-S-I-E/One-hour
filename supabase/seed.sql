-- Demo seed data: one sample downtown campus with generic nearby places.
-- Names are illustrative placeholders; replace with real campus data before a pilot.

insert into public.campuses (id, name, city, lat, lng) values
  ('00000000-0000-0000-0000-000000000001', 'Downtown Campus (demo)', 'New York, NY', 40.7295, -73.9965)
on conflict do nothing;

insert into public.places (campus_id, name, category, description, lat, lng, typical_duration_min, price_level, tags, opens_at, closes_at) values
  ('00000000-0000-0000-0000-000000000001', 'Corner Halal Cart', 'eat', 'Chicken over rice, fast line, eat on the steps.', 40.7301, -73.9975, 20, 1, '{quick,halal,outdoor}', '10:00', '22:00'),
  ('00000000-0000-0000-0000-000000000001', 'Dumpling Counter', 'eat', 'Cheap pork & veggie dumplings, counter seating.', 40.7283, -73.9921, 25, 1, '{quick,vegetarian-options}', '11:00', '21:00'),
  ('00000000-0000-0000-0000-000000000001', 'Grain Bowl Spot', 'eat', 'Build-your-own salads and bowls. Vegan friendly.', 40.7312, -73.9940, 25, 2, '{vegan,vegetarian,gluten-free}', '10:30', '20:00'),
  ('00000000-0000-0000-0000-000000000001', 'Student Union Food Hall', 'eat', 'Many stalls under one roof, meal swipes accepted.', 40.7290, -73.9958, 30, 1, '{meal-swipe,indoor,vegetarian,halal}', '07:30', '21:00'),
  ('00000000-0000-0000-0000-000000000001', 'Neighborhood Pizza Slice', 'eat', 'Classic dollar-ish slice, grab and go.', 40.7276, -73.9990, 15, 0, '{quick,vegetarian}', '10:00', '02:00'),
  ('00000000-0000-0000-0000-000000000001', 'Campus Rec Center', 'exercise', 'Gym floor, pool and courts. Student ID required.', 40.7305, -73.9985, 45, 0, '{gym,indoor,shower}', '06:00', '23:00'),
  ('00000000-0000-0000-0000-000000000001', 'Riverside Running Loop', 'exercise', 'Flat 2-mile loop along the water.', 40.7276, -74.0105, 35, 0, '{outdoor,run}', null, null),
  ('00000000-0000-0000-0000-000000000001', 'Drop-in Yoga Studio', 'exercise', '30-min express flow classes on the hour.', 40.7322, -73.9930, 40, 2, '{yoga,indoor}', '07:00', '21:00'),
  ('00000000-0000-0000-0000-000000000001', 'The Square Fountain', 'relax', 'People-watching, buskers, sun on a nice day.', 40.7308, -73.9973, 20, 0, '{outdoor,free}', null, null),
  ('00000000-0000-0000-0000-000000000001', 'Quiet Library Reading Room', 'study', 'Silent floor with outlets and big windows.', 40.7295, -73.9972, 45, 0, '{indoor,quiet,wifi}', '08:00', '23:59'),
  ('00000000-0000-0000-0000-000000000001', 'Board Game Cafe', 'socialize', 'Grab a table and a quick game with friends.', 40.7284, -73.9897, 50, 2, '{indoor,group,coffee}', '11:00', '23:00'),
  ('00000000-0000-0000-0000-000000000001', 'Indie Record Shop', 'explore', 'Crate-dig used vinyl, listening station in back.', 40.7262, -73.9935, 25, 0, '{browse,music}', '12:00', '20:00'),
  ('00000000-0000-0000-0000-000000000001', 'Pocket Art Gallery', 'explore', 'Free rotating exhibits from local artists.', 40.7254, -73.9989, 30, 0, '{art,free,indoor}', '11:00', '18:00'),
  ('00000000-0000-0000-0000-000000000001', 'Specialty Coffee Bar', 'socialize', 'Good espresso, standing bar, chatty vibe.', 40.7299, -73.9932, 20, 2, '{coffee,quick}', '07:00', '19:00'),
  ('00000000-0000-0000-0000-000000000001', 'Community Garden', 'relax', 'Shady benches, quiet even at lunch rush.', 40.7246, -73.9862, 25, 0, '{outdoor,quiet,free}', '08:00', '19:00');

-- A few sample events relative to "now" so the feed is never empty in a demo.
insert into public.events (campus_id, title, description, category, location_name, lat, lng, starts_at, ends_at, is_popup, price_level, source) values
  ('00000000-0000-0000-0000-000000000001', 'Free taco pop-up', 'Student org fundraiser handing out free tacos while they last.', 'eat', 'Square, north arch', 40.7313, -73.9971, now() - interval '15 minutes', now() + interval '75 minutes', true, 0, 'campus'),
  ('00000000-0000-0000-0000-000000000001', 'Pickup frisbee', 'Casual ultimate game, all levels, need 4 more people.', 'exercise', 'Square, east lawn', 40.7306, -73.9962, now() + interval '10 minutes', now() + interval '70 minutes', true, 0, 'campus'),
  ('00000000-0000-0000-0000-000000000001', 'Jazz trio at the student union', 'Lunchtime set in the atrium.', 'socialize', 'Student Union atrium', 40.7290, -73.9958, now() + interval '30 minutes', now() + interval '90 minutes', false, 0, 'campus'),
  ('00000000-0000-0000-0000-000000000001', 'Zine-making drop-in', 'Supplies provided; make a page, take a copy.', 'explore', 'Library, 2nd floor lab', 40.7295, -73.9972, now() + interval '2 hours', now() + interval '4 hours', false, 0, 'campus');
