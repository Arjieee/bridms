import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const hashPw = (password) => bcrypt.hashSync(password, 10);

const SEED_ACCOUNTS = [
  {
    id: 'admin-1',
    username: 'admin',
    password: hashPw('Admin@1234'),
    role: 'admin',
    full_name: 'Administrator',
    email: 'admin@brgy-puerto.gov.ph',
    contact: '09281000001',
    is_active: true,
    is_email_verified: true,
  },
  {
    id: 'staff-1',
    username: 'staff01',
    password: hashPw('Staff@1234'),
    role: 'staff',
    full_name: 'Staff User One',
    email: 'staff@brgy-puerto.gov.ph',
    contact: '09281000002',
    is_active: true,
    is_email_verified: true,
  },
];

const SEED_PUROKS = [
  { id: 1, name: 'Purok 1', is_active: true, is_archived: false },
  { id: 2, name: 'Purok 2', is_active: true, is_archived: false },
  { id: 3, name: 'Purok 3', is_active: true, is_archived: false },
  { id: 4, name: 'Purok 4', is_active: true, is_archived: false },
  { id: 5, name: 'Purok 5', is_active: true, is_archived: false },
];

const SEED_SECTORS = [
  { id: 1, code: 'pwd', name: 'PWD', custom: false },
  { id: 2, code: 'senior', name: 'Senior Citizen', custom: false },
  { id: 3, code: 'osy', name: 'Out-of-School Youth', custom: false },
  { id: 4, code: 'solo_parent', name: 'Solo Parent', custom: false },
  { id: 5, code: 'teenage_mom', name: 'Teenage Mother', custom: false },
];

const SEED_CATEGORIES = [
  { id: 1, name: 'Food', icon: 'fa-wheat-awn', color: '#16a34a' },
  { id: 2, name: 'Non-Food', icon: 'fa-box', color: '#2563eb' },
  { id: 3, name: 'Medicine', icon: 'fa-pills', color: '#dc2626' },
  { id: 4, name: 'Hygiene', icon: 'fa-soap', color: '#7c3aed' },
  { id: 5, name: 'Clothing', icon: 'fa-shirt', color: '#d97706' },
];

const SEED_STANDARD_PACKAGES = [
  // Household
  { sector_code: 'household', item_id: 1, item_name: 'Rice', quantity: 25, unit: 'kg' },
  { sector_code: 'household', item_id: 2, item_name: 'Canned Sardines', quantity: 5, unit: 'cans' },
  { sector_code: 'household', item_id: 3, item_name: 'Canned Corned Beef', quantity: 3, unit: 'cans' },
  { sector_code: 'household', item_id: 4, item_name: 'Instant Noodles', quantity: 5, unit: 'packs' },
  { sector_code: 'household', item_id: 5, item_name: 'Bottled Water (500ml)', quantity: 6, unit: 'bottles' },
  // PWD
  { sector_code: 'pwd', item_id: 1, item_name: 'Rice', quantity: 12.5, unit: 'kg' },
  { sector_code: 'pwd', item_id: 2, item_name: 'Canned Sardines', quantity: 3, unit: 'cans' },
  { sector_code: 'pwd', item_id: 7, item_name: 'Hygiene Kit', quantity: 1, unit: 'pcs' },
  { sector_code: 'pwd', item_id: 5, item_name: 'Bottled Water (500ml)', quantity: 6, unit: 'bottles' },
  // Senior
  { sector_code: 'senior', item_id: 1, item_name: 'Rice', quantity: 12.5, unit: 'kg' },
  { sector_code: 'senior', item_id: 9, item_name: 'Paracetamol', quantity: 1, unit: 'boxes' },
  { sector_code: 'senior', item_id: 5, item_name: 'Bottled Water (500ml)', quantity: 6, unit: 'bottles' },
  // OSY
  { sector_code: 'osy', item_id: 1, item_name: 'Rice', quantity: 12.5, unit: 'kg' },
  { sector_code: 'osy', item_id: 4, item_name: 'Instant Noodles', quantity: 3, unit: 'packs' },
  { sector_code: 'osy', item_id: 5, item_name: 'Bottled Water (500ml)', quantity: 6, unit: 'bottles' },
  // Solo Parent
  { sector_code: 'solo_parent', item_id: 1, item_name: 'Rice', quantity: 25, unit: 'kg' },
  { sector_code: 'solo_parent', item_id: 2, item_name: 'Canned Sardines', quantity: 5, unit: 'cans' },
  { sector_code: 'solo_parent', item_id: 4, item_name: 'Instant Noodles', quantity: 5, unit: 'packs' },
  { sector_code: 'solo_parent', item_id: 7, item_name: 'Hygiene Kit', quantity: 1, unit: 'pcs' },
  // Teenage Mom
  { sector_code: 'teenage_mom', item_id: 1, item_name: 'Rice', quantity: 12.5, unit: 'kg' },
  { sector_code: 'teenage_mom', item_id: 2, item_name: 'Canned Sardines', quantity: 3, unit: 'cans' },
  { sector_code: 'teenage_mom', item_id: 7, item_name: 'Hygiene Kit', quantity: 1, unit: 'pcs' },
  // Emergency
  { sector_code: 'emergency', item_id: 1, item_name: 'Rice', quantity: 25, unit: 'kg' },
  { sector_code: 'emergency', item_id: 2, item_name: 'Canned Sardines', quantity: 5, unit: 'cans' },
  { sector_code: 'emergency', item_id: 4, item_name: 'Instant Noodles', quantity: 5, unit: 'packs' },
  { sector_code: 'emergency', item_id: 5, item_name: 'Bottled Water (500ml)', quantity: 12, unit: 'bottles' },
  { sector_code: 'emergency', item_id: 7, item_name: 'Hygiene Kit', quantity: 1, unit: 'pcs' },
  { sector_code: 'emergency', item_id: 10, item_name: 'Blanket', quantity: 1, unit: 'pcs' },
];

async function main() {
  console.log('🌱 Starting Barangay Puerto database seed...');

  // 1. Seed Accounts
  for (const acc of SEED_ACCOUNTS) {
    await prisma.account.upsert({
      where: { username: acc.username },
      update: {
        password: acc.password,
        role: acc.role,
        full_name: acc.full_name,
        email: acc.email,
        contact: acc.contact,
        is_active: true,
      },
      create: acc,
    });
  }
  console.log('✅ Accounts seeded (Admin & Staff).');

  // 2. Seed Puroks
  for (const p of SEED_PUROKS) {
    await prisma.purok.upsert({
      where: { id: p.id },
      update: { name: p.name, is_active: p.is_active, is_archived: p.is_archived },
      create: p,
    });
  }
  console.log('✅ Puroks seeded (Purok 1 - 5).');

  // 3. Seed Sectors
  for (const s of SEED_SECTORS) {
    await prisma.sector.upsert({
      where: { code: s.code },
      update: { name: s.name, custom: s.custom },
      create: s,
    });
  }
  console.log('✅ Sectors seeded.');

  // 4. Seed Categories
  for (const c of SEED_CATEGORIES) {
    await prisma.category.upsert({
      where: { id: c.id },
      update: { name: c.name, icon: c.icon, color: c.color },
      create: c,
    });
  }
  console.log('✅ Categories seeded.');

  // 5. Seed Standard Packages
  const existingPkgCount = await prisma.standardPackage.count();
  if (existingPkgCount === 0) {
    for (const pkg of SEED_STANDARD_PACKAGES) {
      await prisma.standardPackage.create({
        data: pkg,
      });
    }
    console.log('✅ Standard packages seeded.');
  }

  console.log('🚀 Database seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
