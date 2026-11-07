// ── MarketHub starter catalogue: exactly 200 products ────────────────────────
//
// WHY A GENERATOR AND NOT A HAND-WRITTEN SQL FILE: 200 products × (name,
// description, price, stock, image, subcategory) is ~1,400 values. Written by
// hand that is unreviewable and drifts; generated from the tables below it is
// auditable at a glance and the count is provable.
//
// IDEMPOTENCY is the hard requirement. Every row is keyed by a DETERMINISTIC
// uuid derived from the product slug (see `stableId`), and every insert is
// `ON CONFLICT (id) DO NOTHING`. Re-running the seed therefore inserts nothing
// the second time — it cannot duplicate, and it cannot overwrite a price an
// admin has since edited. That last part matters: a seed that "refreshes" rows
// would silently undo real admin work on every redeploy.
//
// IMAGES: every path below is checked against client/public/products at build
// time by scripts/seed.mjs, which refuses to run if a referenced file is
// missing. A broken image link is worse than no product, so it is a hard error
// rather than a warning.
//
// PRICING: Nigerian market, in kobo (₦1 = 100 kobo). Deliberately generic
// product names — no real brand, model number, warranty or certification is
// claimed anywhere, because inventing those would be a false statement about a
// real company's product.
//
// Plain .mjs (no TypeScript syntax) so `node scripts/seed.mjs` runs it directly
// with no build step.

/** ₦ → kobo, so the tables below read as naira. */
const n = (naira) => Math.round(naira * 100);

// Row shape: [name, subcategory, price₦, discount₦|null, stock, image, featured?]

// ── Electronics ──────────────────────────────────────────────────────────────
const electronics = [
  ["43-Inch Full HD Smart Television", "Televisions", 285000, 249000, 18, "tv.png", true],
  ["32-Inch HD LED Television", "Televisions", 165000, 149000, 24, "tv.png"],
  ["55-Inch 4K UHD Smart Television", "Televisions", 520000, 469000, 9, "tv.png", true],
  ["Standing Electric Fan with Remote", "Home Appliances", 42000, 36500, 40, "fan.png"],
  ["16-Inch Rechargeable Standing Fan", "Home Appliances", 58000, null, 22, "fan.png"],
  ["Steam Pressing Iron 2000W", "Home Appliances", 24500, 21000, 55, "iron.png", true],
  ["Countertop Microwave Oven 20L", "Home Appliances", 98000, 87500, 14, "microwave.png"],
  ["Digital Microwave Oven 25L", "Home Appliances", 145000, null, 8, "microwave.png"],
  ["Portable Bluetooth Speaker", "Audio", 32000, 27500, 45, "speaker2.png", true],
  ["Party Speaker with Wireless Mic", "Audio", 88000, 79000, 12, "speaker2.png"],
  ["Slim Soundbar with Subwoofer", "Audio", 125000, 109000, 10, "soundbar2.png"],
  ["Over-Ear Studio Headphones", "Audio", 68000, 59000, 20, "headphones2.png", true],
  ["Wireless Earbuds with Charging Case", "Audio", 38500, 32000, 50, "earbuds2.png", true],
  ["Digital Camera with Zoom Lens", "Cameras", 385000, 349000, 6, "camera2.png"],
  ["Action Camera Waterproof Housing", "Cameras", 145000, 129000, 11, "action-camera.png"],
  ["Fitness Smartwatch with Heart Rate", "Wearables", 52000, 44000, 35, "smartwatch2.png", true],
  ["Classic Analog Wristwatch", "Wearables", 28000, null, 30, "wristwatch.png"],
  ["Slim Power Bank 20000mAh", "Power", 26500, 22500, 65, "power-bank2.png", true],
  ["Wireless Charging Pad 15W", "Power", 18500, 15500, 48, "charging-pad2.png"],
  ["Braided USB-C Charging Cable 2m", "Power", 6500, 4900, 120, "usb-cable2.png"],
];

// ── Phones and Accessories ───────────────────────────────────────────────────
const phones = [
  ["6.5-Inch Android Smartphone 128GB", "Smartphones", 245000, 219000, 20, "smartphone.png", true],
  ["6.1-Inch Android Smartphone 64GB", "Smartphones", 165000, 149000, 28, "smartphone.png"],
  ["Budget Android Smartphone 32GB", "Smartphones", 98000, 87500, 35, "smartphone.png"],
  ["Slim Silicone Phone Case", "Cases and Covers", 4500, 3500, 150, "phone-case.png", true],
  ["Clear Shockproof Phone Case", "Cases and Covers", 5500, null, 130, "phone-case.png"],
  ["Tempered Glass Screen Protector", "Screen Protection", 3500, 2500, 200, "screen-protector.png", true],
  ["Privacy Screen Protector", "Screen Protection", 6500, 5200, 85, "screen-protector.png"],
  ["Phone Ring Holder Stand", "Accessories", 2500, null, 180, "phone-case.png"],
  ["Selfie Ring Light with Tripod", "Accessories", 14500, 12000, 40, "camera2.png"],
  ["Phone Camera Lens Kit", "Accessories", 18500, 15500, 25, "camera2.png"],
  ["Car Phone Mount Holder", "Accessories", 7500, 5900, 70, "phone-case.png"],
  ["Phone Grip Pop Socket", "Accessories", 2000, null, 220, "phone-case.png"],
  ["Wireless Earbuds for Calls", "Audio", 22500, 18500, 55, "earbuds2.png"],
  ["Bluetooth Selfie Stick", "Accessories", 12500, 9900, 45, "camera2.png"],
  ["Fast Charging Cable Set", "Power", 8500, 6500, 110, "usb-cable2.png"],
  ["Dual Port Car Charger", "Power", 9500, null, 75, "charger.png"],
  ["Phone Cleaning Kit", "Accessories", 3500, 2500, 95, "phone-case.png"],
  ["SIM Card Adapter Kit", "Accessories", 1500, null, 160, "phone-case.png"],
  ["Phone Stand for Desk", "Accessories", 5500, 4200, 88, "phone-case.png"],
  ["Waterproof Phone Pouch", "Accessories", 4500, null, 100, "phone-case.png"],
];

// ── Computers and Accessories ────────────────────────────────────────────────
const computers = [
  ["14-Inch Laptop 8GB RAM 256GB SSD", "Laptops", 485000, 439000, 12, "laptop.png", true],
  ["15.6-Inch Laptop 16GB RAM 512GB SSD", "Laptops", 685000, 619000, 7, "laptop.png", true],
  ["Budget Laptop 4GB RAM 128GB SSD", "Laptops", 285000, 259000, 15, "laptop.png"],
  ["24-Inch Full HD Monitor", "Monitors", 145000, 129000, 18, "monitor.png", true],
  ["27-Inch QHD Monitor", "Monitors", 235000, 209000, 9, "monitor.png"],
  ["Full-Size Wired Keyboard", "Keyboards and Mice", 12500, 9900, 60, "keyboard.png"],
  ["Wireless Keyboard and Mouse Combo", "Keyboards and Mice", 24500, 19900, 42, "keyboard.png", true],
  ["Wireless Optical Mouse", "Keyboards and Mice", 8500, 6900, 85, "mouse.png"],
  ["Ergonomic Vertical Mouse", "Keyboards and Mice", 15500, null, 30, "mouse.png"],
  ["Gaming Headset with Microphone", "Audio", 38500, 32500, 28, "headset.png", true],
  ["Aluminium Laptop Stand", "Accessories", 18500, 14900, 38, "laptop-stand.png"],
  ["Laptop Sleeve 14-Inch", "Accessories", 12500, 9900, 55, "backpack.png"],
  ["Portable External Hard Drive 1TB", "Storage", 78000, 69000, 22, "external-drive.png", true],
  ["USB Flash Drive 64GB", "Storage", 8500, 6500, 95, "flash-drive.png"],
  ["USB Flash Drive 128GB", "Storage", 14500, 11900, 65, "flash-drive.png"],
  ["Memory Card 64GB", "Storage", 12500, 9900, 80, "flash-drive.png"],
  ["HD Webcam with Clip Mount", "Accessories", 28500, 24500, 26, "webcam.png"],
  ["Compact Desktop Printer", "Printers", 165000, 149000, 8, "printer.png"],
  ["Wi-Fi Router Dual Antenna", "Networking", 42000, 36500, 32, "router.png", true],
  ["Ethernet Cable 5m", "Networking", 4500, null, 90, "usb-cable2.png"],
];

// ── Fashion ──────────────────────────────────────────────────────────────────
const fashion = [
  ["Men's Short-Sleeve Cotton Shirt", "Men's Clothing", 12500, 9900, 70, "shirt.png", true],
  ["Men's Long-Sleeve Formal Shirt", "Men's Clothing", 16500, 13900, 55, "shirt.png"],
  ["Men's Chino Trousers", "Men's Clothing", 18500, 15500, 48, "chinos.png"],
  ["Men's Two-Piece Suit", "Men's Clothing", 85000, 74900, 12, "suit.png", true],
  ["Men's Denim Jacket", "Men's Clothing", 28500, 24500, 30, "denim-jacket2.png"],
  ["Men's Polo Shirt", "Men's Clothing", 11500, 8900, 65, "shirt.png"],
  ["Women's Floral Print Midi Dress", "Women's Clothing", 22500, 18500, 42, "dress.png", true],
  ["Women's Long-Sleeve Blouse", "Women's Clothing", 14500, 11900, 58, "blouse.png"],
  ["Women's Denim Jacket", "Women's Clothing", 26500, 22500, 28, "denim-jacket2.png"],
  ["Women's Maxi Wrap Dress", "Women's Clothing", 24500, 19900, 35, "dress.png"],
  ["Women's Pleated Skirt", "Women's Clothing", 13500, null, 44, "dress.png"],
  ["Unisex Cotton T-Shirt", "Unisex", 7500, 5900, 120, "shirt.png", true],
  ["Unisex Hooded Sweatshirt", "Unisex", 19500, 16500, 50, "shirt.png"],
  ["Unisex Baseball Cap", "Accessories", 6500, 4900, 85, "sunglasses2.png"],
  ["Sunglasses with UV Protection", "Accessories", 12500, 9900, 60, "sunglasses2.png", true],
  ["Leather Belt", "Accessories", 9500, 7500, 70, "handbag.png"],
  ["Silk Neck Scarf", "Accessories", 8500, null, 40, "blouse.png"],
  ["Wool Blend Winter Scarf", "Accessories", 11500, 8900, 32, "blouse.png"],
  ["Cotton Ankle Socks 5-Pack", "Accessories", 5500, 4200, 110, "shirt.png"],
  ["Canvas Tote Bag", "Bags", 9500, 7500, 75, "tote-bag2.png", true],
];

// ── Shoes and Bags ───────────────────────────────────────────────────────────
const shoes = [
  ["Men's Running Sneakers", "Men's Shoes", 38500, 32500, 40, "sneakers2.png", true],
  ["Men's Canvas Sneakers", "Men's Shoes", 22500, 18500, 55, "canvas-shoes.png"],
  ["Men's Leather Sandals", "Men's Shoes", 18500, 15500, 48, "sandals.png"],
  ["Men's Formal Leather Shoes", "Men's Shoes", 45000, 39500, 22, "sandals.png", true],
  ["Men's Slip-On Loafers", "Men's Shoes", 28500, 24500, 30, "canvas-shoes.png"],
  ["Women's Block-Heel Shoes", "Women's Shoes", 26500, 22500, 35, "heels.png", true],
  ["Women's Flat Ballet Shoes", "Women's Shoes", 18500, 15500, 42, "heels.png"],
  ["Women's Strappy Sandals", "Women's Shoes", 21500, 17900, 38, "sandals.png"],
  ["Women's Ankle Boots", "Women's Shoes", 38500, 32900, 20, "heels.png"],
  ["Unisex Sports Trainers", "Unisex Shoes", 32500, 27500, 45, "sneakers2.png"],
  ["Structured Leather Handbag", "Handbags", 42500, 36500, 25, "handbag.png", true],
  ["Everyday Shoulder Bag", "Handbags", 24500, 19900, 40, "handbag.png"],
  ["Crossbody Mini Bag", "Handbags", 18500, 15500, 48, "handbag.png"],
  ["Laptop Backpack", "Backpacks", 28500, 24500, 52, "backpack.png", true],
  ["Casual Daypack Backpack", "Backpacks", 19500, 16500, 60, "backpack.png"],
  ["Travel Duffel Bag", "Travel", 32500, 27900, 28, "backpack.png"],
  ["Cabin Trolley Suitcase", "Travel", 78500, 69900, 14, "backpack.png", true],
  ["Leather Wallet", "Wallets", 12500, 9900, 80, "handbag.png"],
  ["Card Holder Wallet", "Wallets", 7500, 5900, 95, "handbag.png"],
  ["Canvas Shopping Bag", "Bags", 5500, 4200, 100, "tote-bag2.png"],
];

// ── Beauty and Personal Care ─────────────────────────────────────────────────
const beauty = [
  ["Nourishing Body Lotion 400ml", "Body Care", 8500, 6900, 90, "body-lotion.png", true],
  ["Shea Butter Body Cream 250ml", "Body Care", 7500, 5900, 75, "cream-jar.png"],
  ["Hydrating Face Serum 30ml", "Skincare", 14500, 11900, 55, "serum.png", true],
  ["Gentle Facial Cleanser 150ml", "Skincare", 9500, 7500, 68, "serum.png"],
  ["Moisturising Face Cream 50ml", "Skincare", 11500, 8900, 60, "cream-jar.png"],
  ["Facial Toner 200ml", "Skincare", 8500, null, 50, "serum.png"],
  ["Matte Lipstick Set of 3", "Makeup", 12500, 9900, 70, "lipstick.png", true],
  ["Liquid Foundation 30ml", "Makeup", 13500, 10900, 45, "lipstick.png"],
  ["Mascara Volume Formula", "Makeup", 8500, 6500, 65, "lipstick.png"],
  ["Compact Powder", "Makeup", 7500, 5900, 58, "lipstick.png"],
  ["Eau de Parfum 50ml", "Fragrance", 28500, 24500, 30, "perfume.png", true],
  ["Body Mist 200ml", "Fragrance", 9500, 7500, 62, "perfume.png"],
  ["Roll-On Deodorant", "Personal Care", 3500, 2500, 120, "body-lotion.png"],
  ["Antiseptic Soap 4-Pack", "Personal Care", 4500, 3500, 100, "body-lotion.png"],
  ["Hair Dryer 1800W", "Hair Care", 22500, 18900, 35, "hair-dryer.png", true],
  ["Hair Straightener Ceramic", "Hair Care", 18500, 15500, 40, "hair-dryer.png"],
  ["Shampoo 500ml", "Hair Care", 6500, 4900, 85, "body-lotion.png"],
  ["Hair Conditioner 500ml", "Hair Care", 6500, 4900, 80, "body-lotion.png"],
  ["Cotton Face Towel Set", "Personal Care", 5500, 4200, 70, "plates2.png"],
  ["Nail Care Kit", "Personal Care", 7500, 5900, 55, "lipstick.png"],
];

// ── Home and Kitchen ─────────────────────────────────────────────────────────
const home = [
  ["Stainless Steel Cooking Pan Set", "Cookware", 38500, 32500, 30, "pans2.png", true],
  ["Non-Stick Frying Pan 28cm", "Cookware", 18500, 15500, 45, "pans2.png"],
  ["Cast Iron Pot 5L", "Cookware", 28500, 24500, 22, "pans2.png"],
  ["Ceramic Dinner Plate Set of 6", "Tableware", 22500, 18900, 38, "plates2.png", true],
  ["Glass Tumblers Set of 6", "Tableware", 12500, 9900, 50, "plates2.png"],
  ["Stainless Steel Cutlery Set", "Tableware", 16500, 13500, 42, "plates2.png"],
  ["Electric Kettle 1.7L", "Appliances", 18500, 15500, 55, "kettle2.png", true],
  ["Countertop Blender with Glass Jug", "Appliances", 32500, 27500, 28, "blender2.png", true],
  ["Air Fryer 5L Digital", "Appliances", 78500, 68900, 18, "air-fryer2.png", true],
  ["Rice Cooker 1.8L", "Appliances", 28500, 24500, 25, "kettle2.png"],
  ["Toaster 2-Slice", "Appliances", 18500, 15500, 32, "kettle2.png"],
  ["Food Storage Container Set", "Kitchen Storage", 12500, 9900, 60, "plates2.png"],
  ["Insulated Water Bottle 1L", "Kitchen Storage", 9500, 7500, 75, "water-bottle.png", true],
  ["Vacuum Flask 1.5L", "Kitchen Storage", 14500, 11900, 48, "water-bottle.png"],
  ["Bath Towel Set of 3", "Bathroom", 16500, 13500, 40, "plates2.png"],
  ["Shower Curtain Waterproof", "Bathroom", 8500, 6500, 35, "plates2.png"],
  ["Laundry Basket Foldable", "Home Organisation", 9500, 7500, 45, "plates2.png"],
  ["Storage Box Set of 3", "Home Organisation", 11500, 8900, 52, "plates2.png"],
  ["LED Table Lamp", "Lighting", 12500, 9900, 38, "kettle2.png"],
  ["Wall Clock Silent Movement", "Home Decor", 8500, 6500, 42, "plates2.png"],
];

// ── Groceries ────────────────────────────────────────────────────────────────
const groceries = [
  ["Premium Long Grain Rice 5kg", "Staples", 12500, 10900, 100, "rice.png", true],
  ["Premium Long Grain Rice 10kg", "Staples", 23500, 20900, 60, "rice.png", true],
  ["Dried Brown Beans 2kg", "Staples", 6500, 5500, 85, "beans.png"],
  ["Dried Spaghetti Pasta 500g", "Staples", 1500, 1200, 200, "spaghetti.png", true],
  ["Spaghetti Family Pack 5x500g", "Staples", 6500, 5500, 90, "spaghetti.png"],
  ["Tomato Paste Tin 400g", "Canned Goods", 1200, 950, 180, "tomato-paste.png", true],
  ["Tomato Paste Pack of 6", "Canned Goods", 6500, 5500, 75, "tomato-paste.png"],
  ["Vegetable Cooking Oil 3L", "Cooking Oil", 9500, 8200, 70, "cooking-oil.png", true],
  ["Vegetable Cooking Oil 1L", "Cooking Oil", 3500, 2900, 120, "cooking-oil.png"],
  ["Groundnut Oil 1L", "Cooking Oil", 4500, 3800, 65, "cooking-oil.png"],
  ["Wheat Flour 2kg", "Baking", 3500, 2900, 80, "rice.png"],
  ["Granulated Sugar 1kg", "Baking", 2500, 2000, 95, "rice.png"],
  ["Baking Powder 100g", "Baking", 1200, null, 110, "rice.png"],
  ["Instant Yeast Sachet 10-Pack", "Baking", 1800, 1400, 100, "rice.png"],
  ["Table Salt 1kg", "Seasoning", 800, 600, 200, "rice.png"],
  ["Seasoning Cubes Pack of 50", "Seasoning", 2500, 2000, 150, "tomato-paste.png"],
  ["Curry Powder 100g", "Seasoning", 1500, 1200, 130, "tomato-paste.png"],
  ["Dried Pepper Flakes 200g", "Seasoning", 2200, 1800, 105, "tomato-paste.png"],
  ["Breakfast Cereal 500g", "Breakfast", 4500, 3800, 70, "rice.png"],
  ["Instant Coffee 200g", "Beverages", 5500, 4500, 60, "rice.png"],
];

// ── Sports and Fitness ───────────────────────────────────────────────────────
const sports = [
  ["Adjustable Dumbbell Set", "Strength", 42500, 36500, 25, "dumbbells2.png", true],
  ["Kettlebell 10kg", "Strength", 22500, 18900, 20, "dumbbells2.png"],
  ["Resistance Band Set", "Strength", 8500, 6500, 65, "yoga-mat.png"],
  ["Push-Up Bar Stand", "Strength", 12500, 9900, 40, "dumbbells2.png"],
  ["Non-Slip Yoga Mat", "Yoga", 14500, 11900, 55, "yoga-mat.png", true],
  ["Yoga Block Set of 2", "Yoga", 7500, 5900, 48, "yoga-mat.png"],
  ["Skipping Rope with Handles", "Cardio", 4500, 3500, 90, "skipping-rope.png", true],
  ["Speed Jump Rope Pro", "Cardio", 6500, 5200, 60, "skipping-rope.png"],
  ["Football Size 5", "Team Sports", 12500, 9900, 50, "football.png", true],
  ["Football Size 4", "Team Sports", 9500, 7500, 45, "football.png"],
  ["Basketball Size 7", "Team Sports", 14500, 11900, 35, "football.png"],
  ["Volleyball Official Size", "Team Sports", 11500, 9500, 30, "football.png"],
  ["Sports Water Bottle 750ml", "Accessories", 5500, 4200, 85, "water-bottle.png"],
  ["Gym Duffel Bag", "Accessories", 18500, 15500, 40, "backpack.png"],
  ["Fitness Tracker Band", "Accessories", 22500, 18900, 45, "smartwatch2.png", true],
  ["Compression Knee Support", "Accessories", 6500, 4900, 70, "yoga-mat.png"],
  ["Sports Wristband Set", "Accessories", 3500, 2500, 95, "yoga-mat.png"],
  ["Foam Roller", "Recovery", 12500, 9900, 38, "yoga-mat.png"],
  ["Massage Gun Percussion", "Recovery", 48500, 42500, 15, "dumbbells2.png", true],
  ["Gym Gloves Padded", "Accessories", 7500, 5900, 62, "yoga-mat.png"],
];

// ── Baby Products ────────────────────────────────────────────────────────────
const baby = [
  ["Wooden Baby Cot with Bedding", "Nursery", 125000, 109000, 10, "baby-cot.png", true],
  ["Baby Travel Cot Portable", "Nursery", 68500, 59900, 14, "baby-cot.png"],
  ["Baby High Chair with Tray", "Feeding", 42500, 36500, 18, "high-chair.png", true],
  ["Baby Feeding Bottle 250ml", "Feeding", 4500, 3500, 110, "feeding-bottle.png", true],
  ["Baby Feeding Bottle Set of 3", "Feeding", 11500, 9500, 65, "feeding-bottle.png"],
  ["Baby Bottle Steriliser", "Feeding", 38500, 32900, 16, "feeding-bottle.png"],
  ["Baby Bath Tub", "Bath", 18500, 15500, 30, "bath-tub.png", true],
  ["Baby Bath Towel Hooded", "Bath", 6500, 4900, 55, "baby-blanket.png"],
  ["Baby Shampoo 300ml", "Bath", 4500, 3500, 80, "body-lotion.png"],
  ["Baby Body Lotion 300ml", "Bath", 4500, 3500, 75, "body-lotion.png"],
  ["Disposable Baby Diapers Pack", "Diapering", 12500, 10500, 90, "diapers.png", true],
  ["Baby Wet Wipes Pack of 3", "Diapering", 4500, 3500, 120, "wet-wipes.png", true],
  ["Baby Changing Mat", "Diapering", 8500, 6500, 45, "diapers.png"],
  ["Baby Bodysuit Set of 5", "Clothing", 12500, 9900, 60, "bodysuits.png", true],
  ["Baby Sleep Suit", "Clothing", 7500, 5900, 50, "bodysuits.png"],
  ["Baby Socks 5-Pack", "Clothing", 3500, 2500, 95, "bodysuits.png"],
  ["Soft Baby Blanket", "Bedding", 9500, 7500, 55, "baby-blanket.png", true],
  ["Baby Cot Bedsheet Set", "Bedding", 8500, 6500, 48, "baby-blanket.png"],
  ["Baby Carrier Sling", "Travel", 18500, 15500, 32, "baby-carrier.png", true],
  ["Baby Toy Rattle Set", "Toys", 6500, 4900, 70, "baby-toys.png", true],
];

const GROUPS = [
  { category: "electronics", rows: electronics },
  { category: "phones-and-accessories", rows: phones },
  { category: "computers", rows: computers },
  { category: "fashion", rows: fashion },
  { category: "shoes-and-bags", rows: shoes },
  { category: "beauty-and-personal-care", rows: beauty },
  { category: "home-and-kitchen", rows: home },
  { category: "groceries", rows: groceries },
  { category: "sports-and-fitness", rows: sports },
  { category: "baby-products", rows: baby },
];

/**
 * The ten storefront departments, in display order.
 *
 * `slug` values match the nine already in drizzle/seed.sql, plus
 * `shoes-and-bags`, which the brief calls for and the original nine did not
 * have. The seed inserts any that are missing rather than assuming they exist,
 * so it works on a fresh database and on the existing one alike.
 */
export const CATEGORIES = [
  { slug: "electronics", name: "Electronics", description: "Audio, wearables and home entertainment.", sortOrder: 1 },
  { slug: "phones-and-accessories", name: "Phones and Accessories", description: "Smartphones, chargers and cables.", sortOrder: 2 },
  { slug: "computers", name: "Computers and Accessories", description: "Laptops, monitors and peripherals.", sortOrder: 3 },
  { slug: "fashion", name: "Fashion", description: "Clothing, outerwear and accessories.", sortOrder: 4 },
  { slug: "shoes-and-bags", name: "Shoes and Bags", description: "Footwear, handbags and luggage.", sortOrder: 5 },
  { slug: "beauty-and-personal-care", name: "Beauty and Personal Care", description: "Skincare, haircare and grooming.", sortOrder: 6 },
  { slug: "home-and-kitchen", name: "Home and Kitchen", description: "Appliances, cookware and tableware.", sortOrder: 7 },
  { slug: "groceries", name: "Groceries", description: "Pantry staples and everyday essentials.", sortOrder: 8 },
  { slug: "sports-and-fitness", name: "Sports and Fitness", description: "Home gym equipment and training gear.", sortOrder: 9 },
  { slug: "baby-products", name: "Baby Products", description: "Nursery, feeding and care essentials.", sortOrder: 10 },
];

/** Slugify a product name into a stable, URL-safe key. */
function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * A deterministic UUIDv5-shaped id derived from the slug.
 *
 * WHY NOT randomUUID(): the seed must be idempotent, and `ON CONFLICT (id) DO
 * NOTHING` only works if the SAME product produces the SAME id on every run. A
 * random id would insert a fresh duplicate row each time the seed ran.
 *
 * This is a plain FNV-1a-based construction, not RFC 4122 §4.3 — it only needs
 * to be stable and collision-free across 200 known slugs, and it is marked as a
 * v5-shaped UUID so Postgres accepts it in a `uuid` column.
 */
export function stableId(slug) {
  const hex = [];
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < slug.length; i += 1) {
    const c = slug.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 + c + i, 0x85ebca6b) >>> 0;
  }
  // Four 32-bit words of state, expanded to 32 hex chars.
  let s = h1;
  for (let i = 0; i < 8; i += 1) {
    s = Math.imul(s ^ (s >>> 13), 0x5bd1e995) >>> 0;
    hex.push(s.toString(16).padStart(8, "0"));
  }
  const raw = hex.join("").slice(0, 32).split("");
  raw[12] = "5"; // version 5
  raw[16] = "8"; // variant
  const h = raw.join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

/** Build the full 200-product list. Throws if the count is not exactly 200. */
export function buildProducts() {
  const out = [];
  for (const group of GROUPS) {
    for (const [name, subcategory, price, discount, stock, image, feat] of group.rows) {
      const slug = slugify(name);
      out.push({
        name,
        slug,
        description: describe(name, subcategory),
        category: group.category,
        subcategory,
        price: n(price),
        discountPrice: discount === null ? null : n(discount),
        stock,
        featured: Boolean(feat),
        image,
      });
    }
  }
  if (out.length !== 200) {
    throw new Error(`Seed must contain exactly 200 products, built ${out.length}.`);
  }
  const slugs = new Set(out.map((p) => p.slug));
  if (slugs.size !== out.length) {
    throw new Error(`Duplicate slug in seed: ${out.length - slugs.size} collision(s).`);
  }
  return out;
}

/**
 * A description built from the product's own name and subcategory.
 *
 * Deliberately factual and generic: it describes what the item IS and what it
 * is for, and claims no brand, model number, warranty, certification or
 * performance figure. Inventing those would put false statements about real
 * companies' products on a live storefront.
 */
function describe(name, subcategory) {
  return (
    `${name}. A practical ${subcategory.toLowerCase()} choice for everyday use, ` +
    `selected for the Nigerian market and priced in Naira. ` +
    `Ships from our Lagos warehouse with delivery available nationwide. ` +
    `See the specifications listed on this page for the details of this item.`
  );
}
