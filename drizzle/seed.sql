-- ─────────────────────────────────────────────────────────────────────────────
-- MarketHub seed data
--
-- Run AFTER migrations:  psql "$DATABASE_URL" -f drizzle/seed.sql
-- Idempotent: every insert is ON CONFLICT DO NOTHING, so re-running is safe.
--
-- Money is integer kobo (₦1 = 100 kobo). ₦45,000 → 4500000.
-- Product images are served from /products/*.png in the app's public folder.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Categories (the nine fixed storefront departments) ──────────────────────
INSERT INTO categories (id, name, slug, description, sort_order) VALUES
  ('b0000000-0000-4000-8000-000000000001', 'Electronics', 'electronics', 'Audio, wearables and home entertainment.', 1),
  ('b0000000-0000-4000-8000-000000000002', 'Fashion', 'fashion', 'Shoes, outerwear, bags and accessories.', 2),
  ('b0000000-0000-4000-8000-000000000003', 'Home and Kitchen', 'home-and-kitchen', 'Appliances, cookware and tableware.', 3),
  ('b0000000-0000-4000-8000-000000000004', 'Phones and Accessories', 'phones-and-accessories', 'Smartphones, chargers and cables.', 4),
  ('b0000000-0000-4000-8000-000000000005', 'Beauty and Personal Care', 'beauty-and-personal-care', 'Skincare, haircare and grooming.', 5),
  ('b0000000-0000-4000-8000-000000000006', 'Groceries', 'groceries', 'Pantry staples and everyday essentials.', 6),
  ('b0000000-0000-4000-8000-000000000007', 'Sports and Fitness', 'sports-and-fitness', 'Home gym equipment and training gear.', 7),
  ('b0000000-0000-4000-8000-000000000008', 'Computers', 'computers', 'Laptops, desktops and peripherals.', 8),
  ('b0000000-0000-4000-8000-000000000009', 'Baby Products', 'baby-products', 'Strollers, care and nursery essentials.', 9)
ON CONFLICT (slug) DO NOTHING;

-- ── Products ────────────────────────────────────────────────────────────────
INSERT INTO products (id, name, slug, description, category_id, price, discount_price, stock, is_featured, status, rating_avg, rating_count, sold_count, created_at) VALUES
  -- Electronics
  ('a0000000-0000-4000-8000-000000000001', 'Aurora Pro Wireless Earbuds', 'aurora-pro-wireless-earbuds',
   'Active noise cancellation, 32 hours of playback with the charging case, and a transparency mode that lets the room back in. Bluetooth 5.3 with multipoint pairing so your laptop and phone stay connected at once. IPX5 sweat resistance and USB-C fast charge — ten minutes gives you three hours.',
   'b0000000-0000-4000-8000-000000000001', 4500000, 2999000, 42, true, 'active', 47, 128, 340, now() - interval '2 days'),

  ('a0000000-0000-4000-8000-000000000002', 'Pulse Mini Bluetooth Speaker', 'pulse-mini-bluetooth-speaker',
   'A palm-sized speaker with a surprising amount of low end. Fabric-wrapped grille, rubberised base that grips a wet counter, and 14 hours of playtime. Pair two units for true stereo, and take calls through the built-in mic.',
   'b0000000-0000-4000-8000-000000000001', 3200000, 2450000, 30, false, 'active', 45, 76, 210, now() - interval '9 days'),

  ('a0000000-0000-4000-8000-000000000003', 'Vantage S2 Smartwatch', 'vantage-s2-smartwatch',
   'A 1.9-inch AMOLED display that stays readable in direct sun, with heart-rate, SpO2 and sleep tracking. Over 100 workout modes, 5ATM water resistance, and a ten-day battery on typical use. Works with both Android and iOS.',
   'b0000000-0000-4000-8000-000000000001', 8900000, 6750000, 18, true, 'active', 46, 54, 96, now() - interval '5 days'),

  ('a0000000-0000-4000-8000-000000000004', 'Trail 4K Action Camera', 'trail-4k-action-camera',
   '4K60 recording with electronic stabilisation that holds up on a bike mount. Waterproof to 10 metres without a case, 2-inch rear touchscreen, and a magnetic quick-release mount. Ships with two batteries and a 32GB card.',
   'b0000000-0000-4000-8000-000000000001', 12500000, 9900000, 9, false, 'active', 44, 31, 58, now() - interval '14 days'),

  ('a0000000-0000-4000-8000-000000000005', 'Cinema 200W Soundbar', 'cinema-200w-soundbar',
   'Two full-range drivers and a pair of tweeters in a 90cm bar that fits under most TVs. HDMI ARC for one-cable setup, optical and Bluetooth inputs, and three EQ presets for film, music and dialogue.',
   'b0000000-0000-4000-8000-000000000001', 7800000, 5990000, 12, false, 'active', 43, 22, 41, now() - interval '21 days'),

  -- Fashion
  ('a0000000-0000-4000-8000-000000000006', 'Court Classic Leather Sneakers', 'court-classic-leather-sneakers',
   'Full-grain leather upper on a vulcanised rubber sole, with a padded collar and a cushioned insole that survives a full day on your feet. A clean silhouette that works with denim or a suit. Runs true to size.',
   'b0000000-0000-4000-8000-000000000002', 5500000, 3890000, 26, true, 'active', 48, 91, 187, now() - interval '3 days'),

  ('a0000000-0000-4000-8000-000000000007', 'Rigid Denim Trucker Jacket', 'rigid-denim-trucker-jacket',
   'A 12oz rigid cotton denim jacket with a classic four-pocket front and adjustable waist tabs. It starts stiff and softens into your shape over a few weeks. Unlined, so it layers over a hoodie without bulk.',
   'b0000000-0000-4000-8000-000000000002', 4200000, 3150000, 21, false, 'active', 45, 38, 74, now() - interval '11 days'),

  ('a0000000-0000-4000-8000-000000000008', 'Everyday Leather Tote', 'everyday-leather-tote',
   'Vegetable-tanned leather with a cotton canvas lining, sized to take a 14-inch laptop plus a water bottle. Two internal slip pockets, one zip pocket, and handles long enough to go over a shoulder.',
   'b0000000-0000-4000-8000-000000000002', 6800000, 4990000, 14, true, 'active', 47, 44, 88, now() - interval '7 days'),

  ('a0000000-0000-4000-8000-000000000009', 'Wayfarer Polarised Sunglasses', 'wayfarer-polarised-sunglasses',
   'Acetate frames with polarised CR-39 lenses that cut glare off water and windscreens. UV400 rated, with spring hinges and a hard case included.',
   'b0000000-0000-4000-8000-000000000002', 2500000, 1490000, 38, false, 'active', 42, 63, 152, now() - interval '18 days'),

  -- Home and Kitchen
  ('a0000000-0000-4000-8000-000000000010', 'Vortex 1200W Blender', 'vortex-1200w-blender',
   'A 1200W motor and six stainless blades that crush ice and blend smoothies in under a minute. 1.5L Tritan jar, three speed settings plus pulse, and a lid that seals properly. Jug and blade assembly are dishwasher safe.',
   'b0000000-0000-4000-8000-000000000003', 3900000, 2890000, 24, true, 'active', 46, 87, 203, now() - interval '4 days'),

  ('a0000000-0000-4000-8000-000000000011', 'Nordic 1.7L Electric Kettle', 'nordic-1-7l-electric-kettle',
   'Brushed stainless steel body with a real wood handle that stays cool. 1.7L capacity, 3000W so it boils in about three minutes, and an auto shut-off with boil-dry protection. 360° cordless base.',
   'b0000000-0000-4000-8000-000000000003', 1850000, 1390000, 45, false, 'active', 44, 112, 268, now() - interval '16 days'),

  ('a0000000-0000-4000-8000-000000000012', 'ProCook Non-Stick Pan Set', 'procook-non-stick-pan-set',
   'Three pans — 20cm, 24cm and 28cm — with a triple-layer non-stick coating that is PFOA free. Forged aluminium bodies with a thick base that spreads heat evenly, and stay-cool riveted handles. Oven safe to 180°C.',
   'b0000000-0000-4000-8000-000000000003', 4600000, 3450000, 17, false, 'active', 45, 49, 97, now() - interval '12 days'),

  ('a0000000-0000-4000-8000-000000000013', 'Stoneware Dinner Plate Set of 6', 'stoneware-dinner-plate-set-of-6',
   'Six 27cm stoneware plates with a reactive glaze, so no two are quite identical. Chip-resistant, microwave and dishwasher safe, and heavy enough not to slide around the table.',
   'b0000000-0000-4000-8000-000000000003', 2900000, 2190000, 22, false, 'active', 43, 27, 61, now() - interval '25 days'),

  ('a0000000-0000-4000-8000-000000000014', 'AirCrisp 5.5L Air Fryer', 'aircrisp-5-5l-air-fryer',
   '5.5L basket that takes a whole chicken, with eight presets and a shake reminder. 1700W rapid air circulation means chips come out crisp with a tablespoon of oil. Non-stick drawer is dishwasher safe.',
   'b0000000-0000-4000-8000-000000000003', 6500000, 4890000, 3, true, 'active', 48, 156, 312, now() - interval '1 day'),

  -- Phones and Accessories
  ('a0000000-0000-4000-8000-000000000015', 'Nova X9 5G Smartphone 256GB', 'nova-x9-5g-smartphone-256gb',
   'A 6.7-inch 120Hz AMOLED display, 256GB of storage and 8GB of RAM, with a 50MP main camera that holds detail in low light. 5000mAh battery with 67W fast charging — zero to full in about 40 minutes. Dual SIM, 5G ready.',
   'b0000000-0000-4000-8000-000000000004', 48000000, 39900000, 11, true, 'active', 47, 73, 129, now() - interval '6 days'),

  ('a0000000-0000-4000-8000-000000000016', 'Volt 20000mAh Power Bank', 'volt-20000mah-power-bank',
   '20000mAh with 22.5W PD output — enough for four phone charges. Digital display shows the exact percentage left, and two USB-A ports plus USB-C let you charge three devices at once. Airline safe.',
   'b0000000-0000-4000-8000-000000000004', 2200000, 1590000, 52, false, 'active', 45, 198, 421, now() - interval '8 days'),

  ('a0000000-0000-4000-8000-000000000017', 'Braided USB-C Cable 2m', 'braided-usb-c-cable-2m',
   'Nylon-braided 2-metre cable rated for 100W power delivery and 480Mbps data. Reinforced at both connectors, tested to 20,000 bends. Works with phones, laptops and the Switch.',
   'b0000000-0000-4000-8000-000000000004', 450000, 299000, 120, false, 'active', 44, 241, 610, now() - interval '20 days'),

  ('a0000000-0000-4000-8000-000000000018', 'MagCharge Wireless Pad 15W', 'magcharge-wireless-pad-15w',
   'A 15W magnetic wireless charger with a machined aluminium body and a soft-touch top that grips the phone. Aligns itself, so you do not have to hunt for the sweet spot. USB-C input, cable included.',
   'b0000000-0000-4000-8000-000000000004', 1600000, 1190000, 34, false, 'active', 43, 66, 143, now() - interval '15 days'),

  -- Beauty and Personal Care
  ('a0000000-0000-4000-8000-000000000019', 'Radiance Vitamin C Serum 30ml', 'radiance-vitamin-c-serum-30ml',
   '15% stabilised vitamin C with hyaluronic acid and vitamin E, in an amber glass bottle that protects the formula from light. Brightens uneven tone over four to six weeks. Fragrance free, suitable for daily morning use.',
   'b0000000-0000-4000-8000-000000000005', 1250000, 890000, 60, true, 'active', 46, 134, 289, now() - interval '2 days'),

  ('a0000000-0000-4000-8000-000000000020', 'Hydra Rich Night Cream 50ml', 'hydra-rich-night-cream-50ml',
   'A ceramide and squalane night cream for dry or compromised skin. Rich but not greasy, it absorbs in a couple of minutes and leaves no film. Fragrance free, dermatologically tested, 50ml jar lasts about three months.',
   'b0000000-0000-4000-8000-000000000005', 1800000, 1350000, 28, false, 'active', 45, 58, 121, now() - interval '13 days'),

  ('a0000000-0000-4000-8000-000000000021', 'AeroDry Ionic Hair Dryer', 'aerodry-ionic-hair-dryer',
   '1600W with ionic conditioning to cut frizz, three heat and two speed settings, plus a cool shot to set a style. Two concentrator nozzles and a diffuser included. Folds for travel and weighs 480g.',
   'b0000000-0000-4000-8000-000000000005', 4800000, 3690000, 16, false, 'active', 44, 41, 79, now() - interval '19 days'),

  -- Groceries
  ('a0000000-0000-4000-8000-000000000022', 'Premium Long Grain Rice 5kg', 'premium-long-grain-rice-5kg',
   'Stone-free, double-sorted long grain rice that cooks separate and fluffy. 5kg resealable bag, roughly 50 servings. Sourced and milled locally.',
   'b0000000-0000-4000-8000-000000000006', 8500000, 7200000, 40, false, 'active', 45, 89, 234, now() - interval '10 days'),

  ('a0000000-0000-4000-8000-000000000023', 'Cold Pressed Cooking Oil 1L', 'cold-pressed-cooking-oil-1l',
   'Cold pressed and unrefined, so it keeps its colour and flavour. 1L dark glass bottle that protects it from light. Good for everyday cooking and for finishing a salad.',
   'b0000000-0000-4000-8000-000000000006', 1450000, 1190000, 55, false, 'active', 42, 37, 96, now() - interval '23 days'),

  -- Sports and Fitness
  ('a0000000-0000-4000-8000-000000000024', 'Hex Rubber Dumbbell Pair', 'hex-rubber-dumbbell-pair',
   'A pair of hex dumbbells with a rubber-encased head that will not mark your floor and will not roll away between sets. Knurled chrome handles for grip. Available in 5kg, 10kg and 15kg per hand.',
   'b0000000-0000-4000-8000-000000000007', 3600000, 2890000, 19, false, 'active', 46, 52, 108, now() - interval '17 days'),

  ('a0000000-0000-4000-8000-000000000025', 'Grip Pro Yoga Mat 6mm', 'grip-pro-yoga-mat-6mm',
   'A 6mm TPE mat with a textured top that stays grippy through a hot session and a closed-cell surface that does not absorb sweat. 183 x 61cm, with a carry strap. Wipes clean in seconds.',
   'b0000000-0000-4000-8000-000000000007', 1900000, 1390000, 31, true, 'active', 47, 78, 164, now() - interval '5 days'),

  -- Computers
  ('a0000000-0000-4000-8000-000000000026', 'AeroBook 14 Ultrabook', 'aerobook-14-ultrabook',
   'A 14-inch 2.8K display, 16GB of RAM and a 512GB NVMe SSD in a 1.2kg aluminium chassis. The 75Wh battery runs a full working day, and it charges over USB-C. Backlit keyboard, fingerprint reader, Wi-Fi 6E.',
   'b0000000-0000-4000-8000-000000000008', 89000000, 74900000, 7, true, 'active', 48, 36, 62, now() - interval '3 days'),

  -- Baby Products
  ('a0000000-0000-4000-8000-000000000027', 'Glide Lite Baby Stroller', 'glide-lite-baby-stroller',
   'A 6.8kg stroller that folds one-handed into a cabin-bag size. Reclines flat for naps, has a UPF50+ canopy and a five-point harness. Swivel front wheels with a lock for rough ground, and a basket that takes a changing bag.',
   'b0000000-0000-4000-8000-000000000009', 15500000, 12400000, 2, false, 'active', 46, 29, 47, now() - interval '6 days')
ON CONFLICT (slug) DO NOTHING;

-- ── Product images (one primary image each, served from /public/products) ───
INSERT INTO product_images (id, product_id, url, sort_order) VALUES
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000001', '/products/earbuds.png', 0),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000002', '/products/speaker.png', 0),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000003', '/products/smartwatch.png', 0),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000004', '/products/action-camera.png', 0),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000005', '/products/soundbar.png', 0),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000006', '/products/sneakers.png', 0),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000007', '/products/denim-jacket.png', 0),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000008', '/products/tote-bag.png', 0),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000009', '/products/sunglasses.png', 0),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000010', '/products/blender.png', 0),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000011', '/products/kettle.png', 0),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000012', '/products/pans.png', 0),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000013', '/products/plates.png', 0),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000014', '/products/air-fryer.png', 0),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000015', '/products/smartphone.png', 0),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000016', '/products/power-bank.png', 0),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000017', '/products/usb-cable.png', 0),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000018', '/products/charging-pad.png', 0),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000019', '/products/serum.png', 0),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000020', '/products/cream-jar.png', 0),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000021', '/products/hair-dryer.png', 0),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000022', '/products/rice.png', 0),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000023', '/products/cooking-oil.png', 0),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000024', '/products/dumbbells.png', 0),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000025', '/products/yoga-mat.png', 0),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000026', '/products/laptop.png', 0),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000027', '/products/stroller.png', 0)
ON CONFLICT DO NOTHING;

-- ── Variants ────────────────────────────────────────────────────────────────
INSERT INTO product_variants (id, product_id, kind, value, price_delta, stock) VALUES
  -- Earbuds: colour
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000001', 'Colour', 'Midnight Black', 0, 20),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000001', 'Colour', 'Cloud White', 0, 14),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000001', 'Colour', 'Indigo', 0, 8),
  -- Sneakers: size
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000006', 'Size', 'EU 40', 0, 5),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000006', 'Size', 'EU 41', 0, 7),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000006', 'Size', 'EU 42', 0, 6),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000006', 'Size', 'EU 43', 0, 5),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000006', 'Size', 'EU 44', 0, 3),
  -- Denim jacket: size
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000007', 'Size', 'S', 0, 6),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000007', 'Size', 'M', 0, 8),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000007', 'Size', 'L', 0, 5),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000007', 'Size', 'XL', 0, 2),
  -- Tote: colour
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000008', 'Colour', 'Tan', 0, 8),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000008', 'Colour', 'Black', 0, 6),
  -- Smartphone: storage
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000015', 'Size', '256GB', 0, 7),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000015', 'Size', '512GB', 6000000, 4),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000015', 'Colour', 'Deep Violet', 0, 6),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000015', 'Colour', 'Graphite', 0, 5),
  -- Dumbbells: weight
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000024', 'Size', '5kg pair', -1200000, 8),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000024', 'Size', '10kg pair', 0, 7),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000024', 'Size', '15kg pair', 1800000, 4),
  -- Yoga mat: colour
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000025', 'Colour', 'Indigo', 0, 12),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000025', 'Colour', 'Charcoal', 0, 9),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000025', 'Colour', 'Sage', 0, 10),
  -- Laptop: storage
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000026', 'Size', '512GB / 16GB', 0, 4),
  (gen_random_uuid(), 'a0000000-0000-4000-8000-000000000026', 'Size', '1TB / 16GB', 9000000, 3)
ON CONFLICT DO NOTHING;

-- ── Payment settings (singleton; admin edits these in /admin/payment-settings) ─
INSERT INTO payment_settings (id, bank_name, account_name, account_number, instructions) VALUES
  (1,
   'Guaranty Trust Bank (GTBank)',
   'MarketHub Commerce Ltd',
   '0123456789',
   'Transfer the exact total shown on your order to the account above, using your order number as the transfer narration. Then come back to this page and submit the transaction reference from your bank receipt. We verify transfers manually within one business day — your order is only marked paid once a member of our team has confirmed the funds arrived. If you send the wrong amount or forget the narration, submit the reference anyway and add a note; we will match it up.')
ON CONFLICT (id) DO NOTHING;
