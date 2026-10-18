// United States data pack: country settings and game parameters
// Statistics come from stats.js (BLS OEWS May 2025, Employment Projections 2025, CPS 2025).
// Values here are institutional settings and game estimates. See docs/research.md.

window.COUNTRY = {
  code: 'us', lang: 'en', name: 'United States',
  startYear: 2026, aiYear: 2031,
  // Money is in thousands of dollars. Constants in the engine are written in Japanese 万円 and scaled by money.scale
  // (US median pay ~$51k vs Japan ~450万円 → 0.113).
  money: {
    scale: 0.113, unit: '$k', ticks: [50, 100, 150, 200, 300],
    fmt: v => v >= 1000 ? `$${(v / 1000).toFixed(2)}M` : `$${Math.round(v).toLocaleString('en-US')}k`,
  },
  fmtPeople: n => n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${Math.round(n / 1000).toLocaleString('en-US')}k` : `${(Math.round(n / 10) * 10).toLocaleString('en-US')}`,
  names: {
    family: 'Smith Johnson Williams Brown Jones Garcia Miller Davis Rodriguez Martinez Hernandez Lopez Gonzalez Wilson Anderson Thomas Taylor Moore Jackson Martin Lee Perez Thompson White Harris Sanchez Clark Ramirez Lewis Robinson Walker Young Allen King Wright Scott Torres Nguyen Hill Flores'.split(' '),
    given: {
      m: 'Liam Noah Oliver James Elijah Mateo Theodore Henry Lucas William Benjamin Levi Sebastian Jack Ezra Michael Daniel Leo Owen Samuel'.split(' '),
      f: 'Olivia Emma Charlotte Amelia Sophia Mia Isabella Ava Evelyn Luna Harper Sofia Camila Eleanor Elizabeth Violet Scarlett Emily Hazel Lily'.split(' '),
    },
    full: (sex, family, given) => `${given} ${family}`,
  },
  // Most management jobs are reached by promotion; managers become "General and Operations Managers", executives "Chief Executives"
  managerMajor: '11-0000',
  promo: { manager: '11-1021', publicManager: '11-1021', exec: '11-1011' },
  isPublic: j => ['25-2000', '33-2000', '33-3000'].includes(j.mid) || ['43-5051', '43-5052', '43-5053'].includes(j.code),
  publicSize: { key: 'gov', name: 'a government agency', mult: 1.0, retire: 0 },
  seniorSize: { key: 'm', name: 'a local employer', mult: 1, retire: 0 },
  ageLimitMids: {},
  itMids: ['15-1200'], farmMids: [],
  // Physicians, dentists, lawyers etc. need a doctoral or professional degree
  longSchool: { match: j => j.route === 'school' && j.edu >= 3, edu: { lv: 3, name: 'professional school', age: 26, wage: 1.15 } },
  familyBiz: { job: '11-9013', rate: 0.02, name: 'family farm' },
  retireAge: null, // no mandatory retirement age
  seniorAge: 65,   // Medicare eligibility
  // Labor force participation: ~33% at 65–69, ~19% at 70–74, ~8% at 75+ (BLS)
  seniorKeep: age => age <= 65 ? 0.4 : age <= 70 ? 0.5 : age <= 75 ? 0.35 : 0.15,
  irrDefault: { m: 0.12, f: 0.23 }, // part-time share of employed (CPS, approx.)
  // Overtime by ISCO group is a rough estimate; US full-time workers average ~42.5 h/week, so it is scaled down
  otScale: 0.6,
  // Pay gap within the same occupation. CPS: women's median weekly earnings are ~83% of men's overall;
  // the gap inside an occupation is smaller (game estimate)
  sexWage: { m: 1.04, f: 0.9 },
  sickPay: 0.3, parentalPay: 0.15,   // no federal paid sick or parental leave; partial coverage via states/employers (game estimate)
  classLabel: j => j.code,
  icons: {
    major: {
      '11-0000': '🏛️', '13-0000': '📊', '15-0000': '💻', '17-0000': '📐', '19-0000': '🔬', '21-0000': '🤝', '23-0000': '⚖️',
      '25-0000': '📚', '27-0000': '🎨', '29-0000': '🩺', '31-0000': '💉', '33-0000': '🛡️', '35-0000': '🍳', '37-0000': '🧹',
      '39-0000': '✂️', '41-0000': '🛍️', '43-0000': '🗂️', '45-0000': '🌾', '47-0000': '🏗️', '49-0000': '🔧', '51-0000': '🏭', '53-0000': '🚚',
    },
    mid: { '53-2000': '✈️', '33-3000': '🚓', '33-2000': '🚒', '29-1000': '🩺', '41-2000': '🛒' },
  },
  majorLabel: name => name.replace(/ Occupations$/, ''),
  text: {
    'brand': '1 in 170 million',
    'brandHtml': '<span class="accent">1</span> in 170M',
    'home.title': '<span class="accent">1</span> in<br>170 million',
    'home.topline': 'v0.2 POC · career edition · 830 SOC occupations · based on official statistics',
    'home.lead': 'The US economy has about 170 million jobs. Take one of them and live a single working life to the end. You do not get to choose your first job — just as you didn\'t.',
    'home.distNote': 'BLS Employment Projections 2025 · 170 million jobs by major group',
    'home.distFoot': 'Top executive and most management jobs are reached only by promotion.',
    'home.c3': 'Real data: job counts, pay percentiles and education by occupation (BLS OEWS and Employment Projections), and women\'s share by occupation (CPS). Company-size pay gaps, promotion odds, license pass rates, burnout and business survival are game estimates informed by published research. Details in the <a href="docs/research.html" target="_blank">research notes</a> (in Japanese).',
    'c.rare': 'In 2025 there were about <b>{people}</b> jobs in this occupation in the US — roughly <b>1 in {n}</b> of all jobs.',
    'z.desc': 'The full Standard Occupational Classification (SOC 2018): 22 major groups, 94 minor groups and 830 detailed occupations. Highlighted jobs are ones you have held. The code to the right of each minor group is its ISCO-08 equivalent.',
    'z.src': 'Job counts from <a href=\"https://www.bls.gov/emp/tables.htm\" target=\"_blank\" rel=\"noopener\">BLS Employment Projections</a> (2025, including self-employment; a person with two jobs counts twice). Pay from <a href=\"https://www.bls.gov/oes/tables.htm\" target=\"_blank\" rel=\"noopener\">OEWS May 2025</a>: because OEWS has no breakdown by age, \"prime-age pay\" is the median × 1.15 (the CPS ratio of median weekly earnings at ages 45–54 to all ages). Women\'s share from <a href=\"https://www.bls.gov/cps/cpsaat11.htm\" target=\"_blank\" rel=\"noopener\">CPS 2025</a>, matched by occupation title (otherwise the minor-group average) and scaled so the total matches the CPS figure of 47.1%. Overtime and AI exposure are game estimates by ISCO group. Tags under an occupation are common job titles; their pay multipliers are game estimates.',
    'z.search': 'Search occupations (e.g. lawyer, nurse, driver)',
    'ev.senior': 'You are {age}. Medicare starts now, and the full Social Security retirement age is 67. About a third of Americans aged 65 to 69 are still in the labor force.',
    'ev.seniorCheck': 'You are {age}. Health: {health}. About one in five Americans aged 70 to 74 is still in the labor force; past 75, fewer than one in ten.',
    'ev.burnM': 'Sleep no longer restores you, and mornings are hard. You do not have to carry this alone — in the US you can call or text 988 at any time.',
    'log.promo.toMgr': 'Your occupation is now classified as Management.',
    'ev.birth': 'How will you handle work? The US has no federal paid parental leave; FMLA guarantees eligible workers 12 weeks of unpaid, job-protected leave. Some states and employers offer paid leave.',
    'ev.care': '{who} is {age}. Family caregivers in the US provide care for about 4.5 years on average. How will you handle it?',
    'care.leave.s': 'FMLA allows up to 12 weeks of unpaid leave',
    'pass.pdf.note': 'This work history is a simulation based on BLS statistics (OEWS, Employment Projections, CPS). It does not describe a real person.',
    'pass.card.foot': 'A career simulation based on BLS statistics',
  },
}

// SOC minor group → ISCO-08 sub-major group (closest match at minor-group level; detailed overrides in JOB_OVERRIDES)
window.ISCO_MAP = {
  '11-1000': '11', '11-2000': '12', '11-3000': '12', '11-9000': '13',
  '13-1000': '24', '13-2000': '24', '15-1200': '25', '15-2000': '21',
  '17-1000': '21', '17-2000': '21', '17-3000': '31',
  '19-1000': '21', '19-2000': '21', '19-3000': '26', '19-4000': '31', '19-5000': '32',
  '21-1000': '26', '21-2000': '26', '23-1000': '26', '23-2000': '34',
  '25-1000': '23', '25-2000': '23', '25-3000': '23', '25-4000': '26', '25-9000': '53',
  '27-1000': '26', '27-2000': '26', '27-3000': '26', '27-4000': '35',
  '29-1000': '22', '29-2000': '32', '29-9000': '32',
  '31-1100': '53', '31-2000': '32', '31-9000': '53',
  '33-1000': '54', '33-2000': '54', '33-3000': '54', '33-9000': '54',
  '35-1000': '51', '35-2000': '51', '35-3000': '51', '35-9000': '94',
  '37-1000': '51', '37-2000': '91', '37-3000': '92',
  '39-1000': '51', '39-2000': '51', '39-3000': '51', '39-4000': '51', '39-5000': '51', '39-6000': '96', '39-7000': '51', '39-9000': '53',
  '41-1000': '52', '41-2000': '52', '41-3000': '33', '41-4000': '33', '41-9000': '52',
  '43-1000': '33', '43-2000': '42', '43-3000': '43', '43-4000': '42', '43-5000': '43', '43-6000': '41', '43-9000': '41',
  '45-1000': '61', '45-2000': '92', '45-4000': '62',
  '47-1000': '31', '47-2000': '71', '47-3000': '93', '47-4000': '71', '47-5000': '81',
  '49-1000': '31', '49-2000': '74', '49-3000': '72', '49-9000': '72',
  '51-1000': '31', '51-2000': '82', '51-3000': '75', '51-4000': '72', '51-5100': '73', '51-6000': '75', '51-7000': '75', '51-8000': '31', '51-9000': '81',
  '53-1000': '31', '53-2000': '31', '53-3000': '83', '53-4000': '83', '53-5000': '83', '53-6000': '96', '53-7000': '93',
}

// Minor-group parameters (phys/st/ai/ot come from ISCO_PARAMS through ISCO_MAP)
// gate: 'rank' → reached only by promotion
window.MID_PARAMS = {
  '11-1000': { gate: 'rank' }, '11-2000': { gate: 'rank' }, '11-3000': { gate: 'rank' },
}

// Detailed-occupation overrides: licenses and training routes
window.LICENSES = {
  cpa:        { name: 'CPA', kind: 'study', hours: 400, pass: 0.5, desc: 'Four sections; roughly half of section attempts pass' },
  realestate: { name: 'Real estate license', kind: 'study', hours: 90, pass: 0.55, desc: 'Pre-licensing course plus a state exam' },
  series7:    { name: 'FINRA Series 7', kind: 'study', hours: 100, pass: 0.65, desc: 'Needed to sell securities' },
  cdl:        { name: 'Commercial driver\'s license (CDL-A)', kind: 'study', hours: 160, pass: 0.8, desc: 'Entry to long-haul trucking' },
  pmp:        { name: 'PMP certification', kind: 'study', hours: 150, pass: 0.7, desc: 'Project management credential' },
  aws:        { name: 'AWS Solutions Architect certification', kind: 'study', hours: 120, pass: 0.7, desc: 'Cloud architecture credential' },
  cna:        { name: 'CNA certification', kind: 'study', hours: 120, pass: 0.8, desc: 'Entry to nursing assistant work' },
  police:     { name: 'Police academy', kind: 'study', hours: 800, pass: 0.75, desc: 'Physical tests and background checks', maxAge: 37, minHealth: 50 },
  fire:       { name: 'Firefighter exam', kind: 'study', hours: 600, pass: 0.5, desc: 'Highly competitive hiring', maxAge: 35, minHealth: 55 },
  md:         { name: 'Medical school + USMLE', kind: 'school', hours: 0, pass: 0.95, desc: 'Requires medical school and residency' },
  dds:        { name: 'Dental school + boards', kind: 'school', hours: 0, pass: 0.9, desc: 'Requires dental school' },
  dvm:        { name: 'Veterinary school + NAVLE', kind: 'school', hours: 0, pass: 0.9, desc: 'Requires veterinary school' },
  pharmd:     { name: 'PharmD + NAPLEX', kind: 'school', hours: 0, pass: 0.8, desc: 'Requires pharmacy school' },
  bar:        { name: 'Law school + bar exam', kind: 'school', hours: 0, pass: 0.7, desc: 'Requires a JD' },
  rn:         { name: 'Nursing degree + NCLEX-RN', kind: 'school', hours: 0, pass: 0.88, desc: 'Requires a nursing program' },
  teaching:   { name: 'Teaching certificate', kind: 'school', hours: 0, pass: 1, desc: 'Requires a teacher preparation program' },
  electrician:{ name: 'Electrical apprenticeship + license', kind: 'school', hours: 0, pass: 0.8, desc: 'Four-year apprenticeship' },
  cosmetology:{ name: 'Cosmetology license', kind: 'school', hours: 0, pass: 0.8, desc: 'Requires cosmetology school' },
  pilot:      { name: 'ATP certificate', kind: 'school', hours: 0, pass: 0.9, desc: '1,500 flight hours' },
}
window.JOB_OVERRIDES = (() => {
  const o = {
    '11-9013': { isco: '61' }, '13-2011': {}, '41-9022': { lic: 'realestate' }, '41-9021': { lic: 'realestate' },
    '41-3031': { lic: 'series7' }, '53-3032': { lic: 'cdl' }, '31-1131': { lic: 'cna' },
    '33-3051': { lic: 'police' }, '33-2011': { lic: 'fire' },
    '29-1141': { lic: 'rn', route: 'school' }, '29-1021': { lic: 'dds', route: 'school' }, '29-1131': { lic: 'dvm', route: 'school' },
    '29-1051': { lic: 'pharmd', route: 'school' }, '23-1011': { lic: 'bar', route: 'school' }, '23-1023': { gate: 'rank' },
    '47-2111': { lic: 'electrician', route: 'school' }, '39-5012': { lic: 'cosmetology', route: 'school' }, '53-2011': { lic: 'pilot', route: 'school' },
  }
  for (const m of Object.values(window.OCC.mids)) for (const j of m.jobs) {
    if (/^29-12[1-4]/.test(j.code)) o[j.code] = { lic: 'md', route: 'school' } // physicians and surgeons
    if (/^25-20/.test(j.code)) o[j.code] = { lic: 'teaching', route: 'school' } // K-12 teachers
  }
  return o
})()

// Levels (employees only). Manager and director premiums are game estimates.
window.RANKS = [
  { name: 'Staff', mult: 1.0 }, { name: 'Senior', mult: 1.05 }, { name: 'Lead', mult: 1.12 },
  { name: 'Manager', mult: 1.35 }, { name: 'Director', mult: 1.6 }, { name: 'Executive', mult: 2.2 },
]

// Firm size: share of private-sector employment (Census SUSB, approx.) and a size pay premium (game estimate)
window.COMPANY_SIZES = [
  { key: 'xl', name: 'a firm with 500+ employees', w: 52, mult: 1.08, retire: 0 },
  { key: 'l',  name: 'a firm with 100–499 employees', w: 14, mult: 0.98, retire: 0 },
  { key: 'm',  name: 'a firm with 20–99 employees', w: 17, mult: 0.92, retire: 0 },
  { key: 's',  name: 'a small business (under 20)', w: 17, mult: 0.82, retire: 0 },
]

// Education. Each occupation has its own attainment mix (BLS Table 5.3); w is used only when it does not.
// wage: pay difference by education within the same occupation (game estimate)
window.EDUCATION = [
  { lv: 0, name: 'high school', age: 18, w: 30, wage: 0.88 },
  { lv: 1, name: 'some college', age: 20, w: 27, wage: 0.95 },
  { lv: 2, name: 'college', age: 22, w: 27, wage: 1.05 },
  { lv: 3, name: 'graduate school', age: 24, w: 16, wage: 1.12 },
]

window.LIFE_PARAMS = {
  places: [
    { name: 'California', w: 11.7 }, { name: 'Texas', w: 9.2 }, { name: 'Florida', w: 6.8 }, { name: 'New York', w: 5.8 },
    { name: 'Pennsylvania', w: 3.8 }, { name: 'Illinois', w: 3.7 }, { name: 'Ohio', w: 3.5 }, { name: 'Georgia', w: 3.3 },
    { name: 'North Carolina', w: 3.2 }, { name: 'Michigan', w: 3.0 }, { name: 'New Jersey', w: 2.8 }, { name: 'Virginia', w: 2.6 },
    { name: 'Washington', w: 2.3 }, { name: 'Arizona', w: 2.2 }, { name: 'Tennessee', w: 2.1 }, { name: 'Massachusetts', w: 2.1 },
    { name: 'Colorado', w: 1.8 }, { name: 'Minnesota', w: 1.7 }, { name: 'Oregon', w: 1.3 }, { name: 'Utah', w: 1.0 },
  ],
  marriageRate: [
    { to: 24, p: 0.05 }, { to: 29, p: 0.1 }, { to: 34, p: 0.08 }, { to: 39, p: 0.05 },
    { to: 49, p: 0.025 }, { to: 64, p: 0.008 },
  ],
  birthRate: [0.36, 0.3, 0.12, 0.03],
  transferRate: 0.02,
  quitAfterBirth: 0.2,
  // Without paid leave, most parents take a few weeks (game estimate)
  autoBirth: (sex, r) => sex === 'f' ? (r < 0.6 ? 'short' : r < 0.75 ? 'none' : r < 0.9 ? 'long' : 'long_short') : (r < 0.45 ? 'short' : 'none'),
  careModes: {
    self:     { load: 1.0, mental: 7, health: 3, cost: 15 },
    leave:    { load: 0.55, mental: 3.5, health: 1.5, cost: 30 },
    facility: { load: 0.2, mental: 2, health: 0.5, cost: 150 },
    quit:     { load: 1.2, mental: 5, health: 3, cost: 10 },
  },
}

window.SENIOR_JOBS = [
  { code: '33-9032', w: 14, note: 'Security at sites and buildings' },
  { code: '53-6021', w: 6, note: 'Parking lots and garages' },
  { code: '37-2011', w: 14, note: 'Cleaning offices and schools' },
  { code: '53-7081', w: 4, note: 'Trash and recycling collection' },
  { code: '41-2031', w: 12, note: 'Retail floor' },
  { code: '53-3053', w: 6, note: 'Shuttle and driving services' },
  { code: '43-4171', w: 5, note: 'Front desk' },
  { code: '35-3023', w: 5, note: 'Counter service' },
  { code: '25-3031', w: 4, note: 'Substitute teaching', edu: 2 },
  { code: '39-9011', w: 3, note: 'Childcare' },
  { code: '37-3011', w: 5, note: 'Landscaping' },
  { code: '11-9013', w: 30, note: 'Take over the family farm', need: 'familyBiz' },
]

// Common job titles inside an occupation (pay multipliers and AI exposure are game estimates)
window.JOB_VARIANTS = {
  '15-1252': [
    { name: 'Backend engineer', w: 14, mult: 1.0, ai: 0.55 },
    { name: 'Full-stack engineer', w: 8, mult: 1.02, ai: 0.45 },
    { name: 'Mobile engineer', w: 5, mult: 1.0, ai: 0.55 },
    { name: 'Embedded engineer', w: 5, mult: 0.98, ai: 0.45 },
    { name: 'Game programmer', w: 2, mult: 0.9, ai: 0.5 },
    { name: 'Enterprise software developer', w: 12, mult: 0.95, ai: 0.65 },
    { name: 'Machine learning engineer', w: 4, mult: 1.2, ai: 0.2, meta: true },
    { name: 'AI transformation (AX) engineer', w: 3, mult: 1.2, ai: 0.05, meta: true, note: 'Builds generative AI into products and workflows' },
    { name: 'Forward deployed engineer', w: 3, mult: 1.25, ai: 0.1, meta: true, note: 'Embeds with customers to ship AI/software into production' },
  ],
  '15-1254': [{ name: 'Frontend engineer', w: 5, mult: 1.0, ai: 0.6 }, { name: 'Web developer', w: 5, mult: 0.95, ai: 0.65 }],
  '15-1211': [
    { name: 'IT consultant', w: 5, mult: 1.0, ai: 0.4 }, { name: 'Business systems analyst', w: 6, mult: 0.95, ai: 0.55 },
    { name: 'AI transformation (AX) consultant', w: 2, mult: 1.1, ai: 0.1, meta: true },
  ],
  '15-1244': [
    { name: 'Systems administrator', w: 8, mult: 0.95, ai: 0.55 }, { name: 'Infrastructure engineer', w: 5, mult: 1.0, ai: 0.45 },
    { name: 'Cloud engineer', w: 5, mult: 1.1, ai: 0.35 }, { name: 'Site reliability engineer (SRE)', w: 2, mult: 1.15, ai: 0.3 },
  ],
  '15-1242': [{ name: 'Database administrator', w: 5, mult: 1.0, ai: 0.5 }, { name: 'Database engineer', w: 3, mult: 1.05, ai: 0.45 }],
  '15-1299': [
    { name: 'Product manager', w: 4, mult: 1.15, ai: 0.15, meta: true, note: 'Decides what to build' },
    { name: 'Solutions engineer', w: 3, mult: 1.05, ai: 0.3 }, { name: 'Developer advocate', w: 1, mult: 1.05, ai: 0.3 },
    { name: 'IT support specialist', w: 4, mult: 0.8, ai: 0.8 },
  ],
  '13-1082': [{ name: 'Project manager (PM)', w: 6, mult: 1.0, ai: 0.2 }, { name: 'PMO analyst', w: 2, mult: 0.9, ai: 0.45 }, { name: 'Scrum master', w: 1, mult: 0.95, ai: 0.3 }],
  '15-1255': [{ name: 'UI/UX designer', w: 4, mult: 1.0, ai: 0.4 }, { name: 'Product designer', w: 2, mult: 1.05, ai: 0.35 }, { name: 'Web designer', w: 3, mult: 0.9, ai: 0.7 }],
}
