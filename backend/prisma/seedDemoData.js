import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const hashPw = (password) => bcrypt.hashSync(password, 10);

async function seedDemoData() {
  console.log('🚀 Seeding comprehensive demonstration data for BRIDMS...');

  // 1. Ensure Categories
  const categories = [
    { id: 1, name: 'Food', icon: 'fa-wheat-awn', color: '#16a34a' },
    { id: 2, name: 'Non-Food', icon: 'fa-box', color: '#2563eb' },
    { id: 3, name: 'Medicine', icon: 'fa-pills', color: '#dc2626' },
    { id: 4, name: 'Hygiene', icon: 'fa-soap', color: '#7c3aed' },
    { id: 5, name: 'Clothing', icon: 'fa-shirt', color: '#d97706' },
  ];
  for (const c of categories) {
    await prisma.category.upsert({
      where: { id: c.id },
      update: { name: c.name, icon: c.icon, color: c.color },
      create: c,
    });
  }

  // 2. Ensure Puroks 1 to 5
  const puroks = [
    { id: 1, name: 'Purok 1', is_active: true, is_archived: false },
    { id: 2, name: 'Purok 2', is_active: true, is_archived: false },
    { id: 3, name: 'Purok 3', is_active: true, is_archived: false },
    { id: 4, name: 'Purok 4', is_active: true, is_archived: false },
    { id: 5, name: 'Purok 5', is_active: true, is_archived: false },
  ];
  for (const p of puroks) {
    await prisma.purok.upsert({
      where: { id: p.id },
      update: { name: p.name, is_active: p.is_active, is_archived: p.is_archived },
      create: p,
    });
  }

  // 3. Ensure Sectors
  const sectors = [
    { id: 1, code: 'pwd', name: 'PWD', custom: false },
    { id: 2, code: 'senior', name: 'Senior Citizen', custom: false },
    { id: 3, code: 'osy', name: 'Out-of-School Youth', custom: false },
    { id: 4, code: 'solo_parent', name: 'Solo Parent', custom: false },
    { id: 5, code: 'teenage_mom', name: 'Teenage Mother', custom: false },
  ];
  for (const s of sectors) {
    await prisma.sector.upsert({
      where: { code: s.code },
      update: { name: s.name, custom: s.custom },
      create: s,
    });
  }

  // 4. Warehouse Inventory Items & Stock (Separated by Donor Attribution)
  const inventoryItems = [
    { id: 1, item_code: 'INV-001', name: 'Canned Sardines', category_id: 1, unit: 'cans', quantity: 1250, low_threshold: 50, critical_threshold: 20, donor_id: 'dn-002', donor_name: 'DSWD Field Office Region X', is_repacked: false },
    { id: 2, item_code: 'INV-002', name: 'Rice', category_id: 1, unit: 'sacks', quantity: 40, low_threshold: 15, critical_threshold: 5, donor_id: 'dn-002', donor_name: 'DSWD Field Office Region X', is_repacked: false },
    { id: 3, item_code: 'INV-003', name: 'Instant Noodles', category_id: 1, unit: 'packs', quantity: 1800, low_threshold: 100, critical_threshold: 30, donor_id: 'dn-001', donor_name: 'Philippine Red Cross - CDO Chapter', is_repacked: false },
    { id: 4, item_code: 'INV-004', name: 'Bottled Water 1L', category_id: 1, unit: 'bottles', quantity: 720, low_threshold: 50, critical_threshold: 20, donor_id: 'dn-005', donor_name: 'San Miguel Foods Corporation', is_repacked: false },
    { id: 5, item_code: 'INV-005', name: 'Rice', category_id: 1, unit: 'kg', quantity: 1500, low_threshold: 200, critical_threshold: 50, donor_id: 'dn-002', donor_name: 'DSWD Field Office Region X', is_repacked: true, source_item_id: 2 },
    { id: 6, item_code: 'INV-006', name: 'Canned Corned Beef', category_id: 1, unit: 'cans', quantity: 820, low_threshold: 40, critical_threshold: 15, donor_id: 'dn-003', donor_name: 'CDRRMD - Cagayan de Oro City', is_repacked: false },
    { id: 7, item_code: 'INV-007', name: 'Hygiene Kit', category_id: 4, unit: 'pcs', quantity: 450, low_threshold: 30, critical_threshold: 10, donor_id: 'dn-001', donor_name: 'Philippine Red Cross - CDO Chapter', is_repacked: false },
    { id: 8, item_code: 'INV-008', name: 'Bottled Water (500ml)', category_id: 1, unit: 'bottles', quantity: 1100, low_threshold: 100, critical_threshold: 30, donor_id: 'dn-008', donor_name: 'Aboitiz Foundation Inc.', is_repacked: false },
    { id: 9, item_code: 'INV-009', name: 'Paracetamol 500mg', category_id: 3, unit: 'boxes', quantity: 180, low_threshold: 25, critical_threshold: 10, donor_id: 'dn-003', donor_name: 'CDRRMD - Cagayan de Oro City', is_repacked: false },
    { id: 10, item_code: 'INV-010', name: 'Thermal Blanket', category_id: 2, unit: 'pcs', quantity: 320, low_threshold: 20, critical_threshold: 5, donor_id: 'dn-004', donor_name: 'GMA Kapuso Foundation', is_repacked: false },
    { id: 11, item_code: 'INV-011', name: 'First Aid Emergency Kit', category_id: 3, unit: 'sets', quantity: 110, low_threshold: 15, critical_threshold: 5, donor_id: 'dn-001', donor_name: 'Philippine Red Cross - CDO Chapter', is_repacked: false },
    { id: 12, item_code: 'INV-012', name: 'Rice', category_id: 1, unit: 'sacks', quantity: 25, low_threshold: 15, critical_threshold: 5, donor_id: 'dn-003', donor_name: 'City Government of Cagayan de Oro (LGU)', is_repacked: false },
    { id: 13, item_code: 'INV-013', name: 'Rice', category_id: 1, unit: 'kg', quantity: 800, low_threshold: 200, critical_threshold: 50, donor_id: 'dn-003', donor_name: 'City Government of Cagayan de Oro (LGU)', is_repacked: true, source_item_id: 12 },
    { id: 14, item_code: 'INV-014', name: 'Canned Sardines', category_id: 1, unit: 'cans', quantity: 600, low_threshold: 50, critical_threshold: 20, donor_id: 'dn-003', donor_name: 'City Government of Cagayan de Oro (LGU)', is_repacked: false },
  ];

  for (const item of inventoryItems) {
    await prisma.inventoryItem.upsert({
      where: { id: item.id },
      update: {
        name: item.name,
        category_id: item.category_id,
        unit: item.unit,
        quantity: item.quantity,
        low_threshold: item.low_threshold,
        critical_threshold: item.critical_threshold,
        donor_id: item.donor_id,
        donor_name: item.donor_name,
        is_repacked: item.is_repacked,
        source_item_id: item.source_item_id || null,
      },
      create: item,
    });
  }
  console.log('✅ Inventory items & stock verified (14 items separated by Donor & Repack status).');

  // 5. StockLedger Intake History
  const ledgerCount = await prisma.stockLedger.count();
  if (ledgerCount < 10) {
    const ledgerEntries = [
      { id: 'sl-001', item_id: 5, item_name: 'Rice', type: 'in', qty: 3000, balance_after: 3000, description: 'National Food Authority (NFA) Disaster Buffer Stock Intake', reference_id: 'NFA-2026-081', recorded_by: 'admin' },
      { id: 'sl-002', item_id: 1, item_name: 'Canned Sardines', type: 'in', qty: 1500, balance_after: 1500, description: 'DSWD Region X Emergency Goods Delivery', reference_id: 'DSWD-REC-492', recorded_by: 'admin' },
      { id: 'sl-003', item_id: 3, item_name: 'Instant Noodles', type: 'in', qty: 2000, balance_after: 2000, description: 'DSWD Region X Emergency Goods Delivery', reference_id: 'DSWD-REC-492', recorded_by: 'admin' },
      { id: 'sl-004', item_id: 7, item_name: 'Hygiene Kit', type: 'in', qty: 500, balance_after: 500, description: 'Philippine Red Cross Relief Grant', reference_id: 'PRC-DON-102', recorded_by: 'admin' },
      { id: 'sl-005', item_id: 9, item_name: 'Paracetamol 500mg', type: 'in', qty: 200, balance_after: 200, description: 'City Health Department Medical Logistics Support', reference_id: 'CHD-MED-771', recorded_by: 'admin' },
    ];
    for (const le of ledgerEntries) {
      const exists = await prisma.stockLedger.findUnique({ where: { id: le.id } });
      if (!exists) {
        await prisma.stockLedger.create({ data: le });
      }
    }
  }

  // 6. Realistic Households & Members Across All Puroks (1 to 5)
  const demoHouseholds = [
    // PUROK 1
    {
      id: 'hh-p1-001',
      hh_code: 'HH-10101',
      purok_id: 1,
      purok_name: 'Purok 1',
      house_no_street: 'Zone 1 Riverside',
      status: 'approved',
      reg_date: '2026-09-01',
      members: [
        { id: 'm-p1-001a', is_head: true, fname: 'Juan', lname: 'Dela Cruz', age: 52, age_group: 'adult', sex: 'Male', relationship: 'Head', contact: '09171112233', email: 'juan.delacruz@gmail.com', sectors: '[]' },
        { id: 'm-p1-001b', is_head: false, fname: 'Maria', lname: 'Dela Cruz', age: 50, age_group: 'adult', sex: 'Female', relationship: 'Spouse', contact: '09171112234', email: null, sectors: '[]' },
        { id: 'm-p1-001c', is_head: false, fname: 'Mark', lname: 'Dela Cruz', age: 19, age_group: 'adult', sex: 'Male', relationship: 'Son', contact: null, email: null, sectors: '["osy"]' },
        { id: 'm-p1-001d', is_head: false, fname: 'Angela', lname: 'Dela Cruz', age: 14, age_group: 'minor', sex: 'Female', relationship: 'Daughter', contact: null, email: null, sectors: '[]' },
      ],
    },
    {
      id: 'hh-p1-002',
      hh_code: 'HH-10102',
      purok_id: 1,
      purok_name: 'Purok 1',
      house_no_street: 'Lower Purok 1',
      status: 'approved',
      reg_date: '2026-09-02',
      members: [
        { id: 'm-p1-002a', is_head: true, fname: 'Roberto', lname: 'Santos', age: 68, age_group: 'senior', sex: 'Male', relationship: 'Head', contact: '09282223344', email: null, sectors: '["senior"]' },
        { id: 'm-p1-002b', is_head: false, fname: 'Chloe', lname: 'Santos', age: 8, age_group: 'minor', sex: 'Female', relationship: 'Granddaughter', contact: null, email: null, sectors: '[]' },
      ],
    },
    // PUROK 2
    {
      id: 'hh-p2-001',
      hh_code: 'HH-10201',
      purok_id: 2,
      purok_name: 'Purok 2',
      house_no_street: 'Block 3 Lot 12',
      status: 'approved',
      reg_date: '2026-09-03',
      members: [
        { id: 'm-p2-001a', is_head: true, fname: 'Elena', lname: 'Bautista', age: 42, age_group: 'adult', sex: 'Female', relationship: 'Head', contact: '09393334455', email: 'elena.bautista@gmail.com', sectors: '["solo_parent"]' },
        { id: 'm-p2-001b', is_head: false, fname: 'Joshua', lname: 'Bautista', age: 16, age_group: 'minor', sex: 'Male', relationship: 'Son', contact: null, email: null, sectors: '[]' },
        { id: 'm-p2-001c', is_head: false, fname: 'Jasmine', lname: 'Bautista', age: 11, age_group: 'minor', sex: 'Female', relationship: 'Daughter', contact: null, email: null, sectors: '[]' },
      ],
    },
    {
      id: 'hh-p2-002',
      hh_code: 'HH-10202',
      purok_id: 2,
      purok_name: 'Purok 2',
      house_no_street: 'National Highway Crossing',
      status: 'approved',
      reg_date: '2026-09-04',
      members: [
        { id: 'm-p2-002a', is_head: true, fname: 'Ricardo', lname: 'Mendoza', age: 36, age_group: 'adult', sex: 'Male', relationship: 'Head', contact: '09454445566', email: null, sectors: '[]' },
        { id: 'm-p2-002b', is_head: false, fname: 'Ana', lname: 'Mendoza', age: 33, age_group: 'adult', sex: 'Female', relationship: 'Spouse', contact: null, email: null, sectors: '[]' },
        { id: 'm-p2-002c', is_head: false, fname: 'Bea', lname: 'Mendoza', age: 17, age_group: 'minor', sex: 'Female', relationship: 'Daughter', contact: null, email: null, sectors: '["teenage_mom"]' },
        { id: 'm-p2-002d', is_head: false, fname: 'Liam', lname: 'Mendoza', age: 1, age_group: 'minor', sex: 'Male', relationship: 'Grandson', contact: null, email: null, sectors: '[]' },
      ],
    },
    // PUROK 3
    {
      id: 'hh-p3-002',
      hh_code: 'HH-10302',
      purok_id: 3,
      purok_name: 'Purok 3',
      house_no_street: 'Hilltop View',
      status: 'approved',
      reg_date: '2026-09-05',
      members: [
        { id: 'm-p3-002a', is_head: true, fname: 'Rodrigo', lname: 'Ramos', age: 64, age_group: 'senior', sex: 'Male', relationship: 'Head', contact: '09565556677', email: 'rodrigo.ramos@yahoo.com', sectors: '["senior", "pwd"]' },
        { id: 'm-p3-002b', is_head: false, fname: 'Remedios', lname: 'Ramos', age: 59, age_group: 'adult', sex: 'Female', relationship: 'Sister', contact: null, email: null, sectors: '["pwd"]' },
      ],
    },
    // PUROK 4
    {
      id: 'hh-p4-001',
      hh_code: 'HH-10401',
      purok_id: 4,
      purok_name: 'Purok 4',
      house_no_street: 'San Vicente St.',
      status: 'approved',
      reg_date: '2026-09-06',
      members: [
        { id: 'm-p4-001a', is_head: true, fname: 'Ferdinand', lname: 'Gonzales', age: 48, age_group: 'adult', sex: 'Male', relationship: 'Head', contact: '09676667788', email: null, sectors: '[]' },
        { id: 'm-p4-001b', is_head: false, fname: 'Teresa', lname: 'Gonzales', age: 45, age_group: 'adult', sex: 'Female', relationship: 'Spouse', contact: null, email: null, sectors: '[]' },
        { id: 'm-p4-001c', is_head: false, fname: 'Kyle', lname: 'Gonzales', age: 21, age_group: 'adult', sex: 'Male', relationship: 'Son', contact: null, email: null, sectors: '["osy"]' },
        { id: 'm-p4-001d', is_head: false, fname: 'Carmen', lname: 'Gonzales', age: 77, age_group: 'senior', sex: 'Female', relationship: 'Mother', contact: null, email: null, sectors: '["senior"]' },
      ],
    },
    {
      id: 'hh-p4-002',
      hh_code: 'HH-10402',
      purok_id: 4,
      purok_name: 'Purok 4',
      house_no_street: 'Zone 4 Inner Lane',
      status: 'approved',
      reg_date: '2026-09-07',
      members: [
        { id: 'm-p4-002a', is_head: true, fname: 'Patricia', lname: 'Villanueva', age: 39, age_group: 'adult', sex: 'Female', relationship: 'Head', contact: '09787778899', email: 'patricia.v@gmail.com', sectors: '["solo_parent", "pwd"]' },
        { id: 'm-p4-002b', is_head: false, fname: 'Daniel', lname: 'Villanueva', age: 13, age_group: 'minor', sex: 'Male', relationship: 'Son', contact: null, email: null, sectors: '[]' },
      ],
    },
    // PUROK 5
    {
      id: 'hh-p5-001',
      hh_code: 'HH-10501',
      purok_id: 5,
      purok_name: 'Purok 5',
      house_no_street: 'Coastal Road Area',
      status: 'approved',
      reg_date: '2026-09-08',
      members: [
        { id: 'm-p5-001a', is_head: true, fname: 'Manuel', lname: 'Flores', age: 56, age_group: 'adult', sex: 'Male', relationship: 'Head', contact: '09898889900', email: null, sectors: '[]' },
        { id: 'm-p5-001b', is_head: false, fname: 'Cynthia', lname: 'Flores', age: 53, age_group: 'adult', sex: 'Female', relationship: 'Spouse', contact: null, email: null, sectors: '[]' },
        { id: 'm-p5-001c', is_head: false, fname: 'Joy', lname: 'Flores', age: 23, age_group: 'adult', sex: 'Female', relationship: 'Daughter', contact: null, email: null, sectors: '[]' },
        { id: 'm-p5-001d', is_head: false, fname: 'Paolo', lname: 'Flores', age: 18, age_group: 'adult', sex: 'Male', relationship: 'Son', contact: null, email: null, sectors: '[]' },
      ],
    },
    {
      id: 'hh-p5-002',
      hh_code: 'HH-10502',
      purok_id: 5,
      purok_name: 'Purok 5',
      house_no_street: 'Fisherman Village',
      status: 'approved',
      reg_date: '2026-09-09',
      members: [
        { id: 'm-p5-002a', is_head: true, fname: 'Corazon', lname: 'Dizon', age: 72, age_group: 'senior', sex: 'Female', relationship: 'Head', contact: '09999990011', email: null, sectors: '["senior"]' },
        { id: 'm-p5-002b', is_head: false, fname: 'Gabriel', lname: 'Dizon', age: 15, age_group: 'minor', sex: 'Male', relationship: 'Grandson', contact: null, email: null, sectors: '[]' },
      ],
    },
  ];

  for (const h of demoHouseholds) {
    await prisma.household.upsert({
      where: { id: h.id },
      update: {
        hh_code: h.hh_code,
        purok_id: h.purok_id,
        purok_name: h.purok_name,
        house_no_street: h.house_no_street,
        status: h.status,
        reg_date: h.reg_date,
      },
      create: {
        id: h.id,
        hh_code: h.hh_code,
        purok_id: h.purok_id,
        purok_name: h.purok_name,
        house_no_street: h.house_no_street,
        status: h.status,
        reg_date: h.reg_date,
      },
    });

    for (const m of h.members) {
      await prisma.member.upsert({
        where: { id: m.id },
        update: {
          is_head: m.is_head,
          fname: m.fname,
          lname: m.lname,
          age: m.age,
          age_group: m.age_group,
          sex: m.sex,
          relationship: m.relationship,
          contact: m.contact,
          email: m.email,
          sectors: m.sectors,
        },
        create: {
          id: m.id,
          household_id: h.id,
          is_head: m.is_head,
          fname: m.fname,
          lname: m.lname,
          age: m.age,
          age_group: m.age_group,
          sex: m.sex,
          relationship: m.relationship,
          contact: m.contact,
          email: m.email,
          sectors: m.sectors,
        },
      });
    }
  }
  console.log('✅ Realistic households and family members seeded across Puroks 1 to 5.');

  // 7. Relief Cycles
  // Cycle 1: Active Household Disaster Response (Current operations)
  const cycleActive = {
    id: 'cyc-typhoon-kristine-2026',
    name: 'Typhoon Kristine Emergency Food Relief 2026',
    type: 'household',
    description: 'Emergency food pack distribution for disaster-affected families across all Puroks in Barangay Puerto.',
    coverage_details: 'Covered: All Registered Households in Purok 1 to 5',
    target_purok_ids: '[1,2,3,4,5]',
    distribution_date: '2026-09-29',
    distribution_time: '8:00 AM - 5:00 PM',
    claim_address: 'Barangay Puerto Evacuation & Disaster Response Center',
    contact_person: 'Relief Operations Desk (09281000001)',
    is_active: true,
  };
  await prisma.cycle.upsert({
    where: { id: cycleActive.id },
    update: cycleActive,
    create: cycleActive,
  });

  // Cycle 2: Concluded Past Operation (Perfect for Reports testing with 100% historical accuracy)
  const cycleConcluded = {
    id: 'cyc-monsoon-enteng-2026',
    name: 'Southwest Monsoon (Habagat) Disaster Relief Assistance',
    type: 'household',
    description: 'Flash flood and heavy monsoon response distribution.',
    coverage_details: 'Covered: Flood-prone households across Puroks 1 to 5',
    target_purok_ids: '[1,2,3,4,5]',
    distribution_date: '2026-09-12',
    distribution_time: '8:00 AM - 4:00 PM',
    claim_address: 'Barangay Puerto Multi-Purpose Covered Court',
    contact_person: 'Kagawad on Disaster Preparedness',
    is_active: false,
  };
  await prisma.cycle.upsert({
    where: { id: cycleConcluded.id },
    update: cycleConcluded,
    create: cycleConcluded,
  });

  // Cycle 3: Active Senior/PWD Sector Support
  const cycleSenior = {
    id: 'cyc-senior-pwd-q3-2026',
    name: 'Senior Citizens & PWD Health & Nutrition Care Cycle',
    type: 'senior',
    description: 'Specialized health and nutritional assistance for elderly and disabled residents.',
    coverage_details: 'Covered: Senior Citizen and PWD sector members',
    target_purok_ids: '[1,2,3,4,5]',
    distribution_date: '2026-09-28',
    distribution_time: '9:00 AM - 3:00 PM',
    claim_address: 'Barangay Health Center Grounds',
    contact_person: 'Senior Citizen Affairs Office (OSCA) Rep',
    is_active: true,
  };
  await prisma.cycle.upsert({
    where: { id: cycleSenior.id },
    update: cycleSenior,
    create: cycleSenior,
  });
  console.log('✅ Active and concluded disaster relief cycles initialized.');

  // 8. Generate QR Codes & Seed Claimed vs Unclaimed for Active Cycle
  // All households list:
  const allHouseholds = await prisma.household.findMany({ include: { members: true } });

  // For Cycle 1 (Active Typhoon Kristine):
  // Set some as claimed and some as unclaimed so user can test immediate distribution!
  const claimedHhCodes = ['HH-10101', 'HH-10201', 'HH-10302', 'HH-10401']; // 4 claimed, rest unclaimed

  for (const hh of allHouseholds) {
    const isClaimed = claimedHhCodes.includes(hh.hh_code);
    const qrToken = `qr-kristine-${hh.hh_code.toLowerCase()}`;
    const head = hh.members?.find((m) => m.is_head) || hh.members?.[0];

    await prisma.qRCode.upsert({
      where: { qr_token: qrToken },
      update: {
        cycle_id: cycleActive.id,
        cycle_name: cycleActive.name,
        cycle_type: cycleActive.type,
        household_id: hh.id,
        is_claimed: isClaimed,
        claimed_at: isClaimed ? '2026-09-29T08:30:00.000Z' : null,
      },
      create: {
        id: `qr-${hh.id}-kristine`,
        qr_token: qrToken,
        cycle_id: cycleActive.id,
        cycle_name: cycleActive.name,
        cycle_type: cycleActive.type,
        household_id: hh.id,
        member_id: head?.id || null,
        type: 'household',
        is_claimed: isClaimed,
        claimed_at: isClaimed ? '2026-09-29T08:30:00.000Z' : null,
      },
    });

    // If claimed, create a realistic Distribution transaction record
    if (isClaimed) {
      const distCode = `DIST-20260929-${hh.hh_code.replace('HH-', '')}`;
      const packageItems = [
        { item_id: 5, item_name: 'Rice', quantity: 25, unit: 'kg' },
        { item_id: 1, item_name: 'Canned Sardines', quantity: 5, unit: 'cans' },
        { item_id: 6, item_name: 'Canned Corned Beef', quantity: 3, unit: 'cans' },
        { item_id: 3, item_name: 'Instant Noodles', quantity: 5, unit: 'packs' },
        { item_id: 4, item_name: 'Bottled Water 1L', quantity: 2, unit: 'bottles' },
      ];

      await prisma.distribution.upsert({
        where: { dist_code: distCode },
        update: {
          cycle_id: cycleActive.id,
          cycle_name: cycleActive.name,
          cycle_type: cycleActive.type,
          household_id: hh.id,
          hh_code: hh.hh_code,
          purok_id: hh.purok_id,
          purok_name: hh.purok_name,
          head_fname: head?.fname || 'Beneficiary',
          head_lname: head?.lname || 'Head',
          member_id: head?.id || null,
          dist_date: '2026-09-29',
          type: 'standard',
          items: JSON.stringify(packageItems),
          recorded_by: 'Staff User One',
        },
        create: {
          id: `dist-kristine-${hh.id}`,
          dist_code: distCode,
          cycle_id: cycleActive.id,
          cycle_name: cycleActive.name,
          cycle_type: cycleActive.type,
          household_id: hh.id,
          hh_code: hh.hh_code,
          purok_id: hh.purok_id,
          purok_name: hh.purok_name,
          head_fname: head?.fname || 'Beneficiary',
          head_lname: head?.lname || 'Head',
          member_id: head?.id || null,
          dist_date: '2026-09-29',
          type: 'standard',
          items: JSON.stringify(packageItems),
          officials: '["Kagawad on Disaster Response", "Relief Distribution Desk"]',
          recorded_by: 'Staff User One',
        },
      });
    }
  }

  // 9. Concluded Cycle QRs & Historical Distributions (for rich Reports analytics)
  const concludedClaimedHhCodes = ['HH-10101', 'HH-10102', 'HH-10201', 'HH-10202', 'HH-10302', 'HH-10401', 'HH-10501', 'HH-397610']; // 8 claimed, 2 unclaimed
  for (const hh of allHouseholds) {
    const isClaimed = concludedClaimedHhCodes.includes(hh.hh_code);
    const qrToken = `qr-enteng-${hh.hh_code.toLowerCase()}`;
    const head = hh.members?.find((m) => m.is_head) || hh.members?.[0];

    await prisma.qRCode.upsert({
      where: { qr_token: qrToken },
      update: {
        cycle_id: cycleConcluded.id,
        cycle_name: cycleConcluded.name,
        cycle_type: cycleConcluded.type,
        household_id: hh.id,
        is_claimed: isClaimed,
        claimed_at: isClaimed ? '2026-09-12T10:15:00.000Z' : null,
      },
      create: {
        id: `qr-${hh.id}-enteng`,
        qr_token: qrToken,
        cycle_id: cycleConcluded.id,
        cycle_name: cycleConcluded.name,
        cycle_type: cycleConcluded.type,
        household_id: hh.id,
        member_id: head?.id || null,
        type: 'household',
        is_claimed: isClaimed,
        claimed_at: isClaimed ? '2026-09-12T10:15:00.000Z' : null,
      },
    });

    if (isClaimed) {
      const distCode = `DIST-20260912-${hh.hh_code.replace('HH-', '')}`;
      const packageItems = [
        { item_id: 5, item_name: 'Rice', quantity: 20, unit: 'kg' },
        { item_id: 1, item_name: 'Canned Sardines', quantity: 4, unit: 'cans' },
        { item_id: 3, item_name: 'Instant Noodles', quantity: 4, unit: 'packs' },
        { item_id: 7, item_name: 'Hygiene Kit', quantity: 1, unit: 'pcs' },
      ];

      await prisma.distribution.upsert({
        where: { dist_code: distCode },
        update: {
          cycle_id: cycleConcluded.id,
          cycle_name: cycleConcluded.name,
          cycle_type: cycleConcluded.type,
          household_id: hh.id,
          hh_code: hh.hh_code,
          purok_id: hh.purok_id,
          purok_name: hh.purok_name,
          head_fname: head?.fname || 'Beneficiary',
          head_lname: head?.lname || 'Head',
          member_id: head?.id || null,
          dist_date: '2026-09-12',
          type: 'standard',
          items: JSON.stringify(packageItems),
          recorded_by: 'Staff User One',
        },
        create: {
          id: `dist-enteng-${hh.id}`,
          dist_code: distCode,
          cycle_id: cycleConcluded.id,
          cycle_name: cycleConcluded.name,
          cycle_type: cycleConcluded.type,
          household_id: hh.id,
          hh_code: hh.hh_code,
          purok_id: hh.purok_id,
          purok_name: hh.purok_name,
          head_fname: head?.fname || 'Beneficiary',
          head_lname: head?.lname || 'Head',
          member_id: head?.id || null,
          dist_date: '2026-09-12',
          type: 'standard',
          items: JSON.stringify(packageItems),
          officials: '["Disaster Response Officer"]',
          recorded_by: 'Staff User One',
        },
      });
    }
  }
  console.log('✅ QRCodes and Distribution history seeded for both active and concluded operations.');

  // 10. Clean and Complete Donors & Suppliers
  const cleanDonors = [
    { id: 'dn-001', donor_code: 'DNR-001', name: 'Philippine Red Cross - CDO Chapter', donor_type: 'NGO / Charity', contact_person: 'Maria Santos', contact_number: '09171234567', email: 'cdo@redcross.org.ph', donation_date: '2026-09-28' },
    { id: 'dn-002', donor_code: 'DNR-002', name: 'DSWD Field Office Region X', donor_type: 'Government Agency', contact_person: 'Director Grace Reyes', contact_number: '09189876543', email: 'region10@dswd.gov.ph', donation_date: '2026-09-28' },
    { id: 'dn-003', donor_code: 'DNR-003', name: 'CDRRMD - Cagayan de Oro City', donor_type: 'Government Agency', contact_person: 'Officer Nick Jabagat', contact_number: '09223334444', email: 'cdrrmd@cagayandeoro.gov.ph', donation_date: '2026-09-24' },
    { id: 'dn-004', donor_code: 'DNR-004', name: 'GMA Kapuso Foundation', donor_type: 'NGO / Charity', contact_person: 'Theresa Alcantara', contact_number: '09195556677', email: 'kapuso@gmanetwork.com', donation_date: '2026-09-25' },
    { id: 'dn-005', donor_code: 'DNR-005', name: 'San Miguel Foods Corporation', donor_type: 'Supplier / Partner', contact_person: 'Arthur Lim', contact_number: '09204445555', email: 'community@sanmiguel.com.ph', donation_date: '2026-09-26' },
    { id: 'dn-006', donor_code: 'DNR-006', name: 'Puerto Catholic Parish Caritas', donor_type: 'Religious / Church', contact_person: 'Fr. Antonio Morales', contact_number: '09178889999', email: 'caritas.puerto@gmail.com', donation_date: '2026-09-27' },
    { id: 'dn-007', donor_code: 'DNR-007', name: 'Engr. Roberto Tan & Family', donor_type: 'Private Donor / Individual', contact_person: 'Engr. Roberto Tan', contact_number: '09673821907', email: 'roberto.tan@outlook.com', donation_date: '2026-09-28' },
    { id: 'dn-008', donor_code: 'DNR-008', name: 'Aboitiz Foundation Inc.', donor_type: 'Organization / Corporate', contact_person: 'Cecilia Bernardo', contact_number: '09175551234', email: 'aboitizfoundation@aboitiz.com', donation_date: '2026-09-29' },
  ];

  for (const d of cleanDonors) {
    const existing = await prisma.donor.findUnique({ where: { donor_code: d.donor_code } });
    if (existing) {
      await prisma.donor.update({
        where: { id: existing.id },
        data: {
          name: d.name,
          donor_type: d.donor_type,
          contact_person: d.contact_person,
          contact_number: d.contact_number,
          email: d.email,
          donation_date: d.donation_date,
        },
      });
    } else {
      await prisma.donor.create({ data: d });
    }
  }
  console.log('✅ Suppliers & Donors directory updated with 8 authentic partner institutions.');

  console.log('🎉 Comprehensive testing seed data generation finished successfully!');
}

seedDemoData()
  .catch((e) => {
    console.error('❌ Error during demo data seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
