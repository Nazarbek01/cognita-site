// Market analytics: official wage statistics of Kazakhstan.
//
// Every number here is copied from an official publication. Each one has its source and period.
// The statistics give average wages by SECTOR (type of economic activity), not by job title.
// So a career shows the average wage of the sector it belongs to, and the site says so.
// The link between a career and a sector is the Cognita team's estimate (see FIELD_SECTOR, CAREER_SECTOR).
// Worldwide data is planned ("soon"); nothing is shown until we have sources for it.

export const KZ_SOURCE = {
  publisher: 'Bureau of National Statistics of the Republic of Kazakhstan',
  title: 'Number and wages of employees in the Republic of Kazakhstan (II quarter of 2026)',
  period: 'II quarter 2026',
  released: '2026-09-02',
  url: 'https://stat.gov.kz/en/industries/labor-and-income/stat-wags/publications/514654/',
  note: 'Average monthly nominal wage of employees, before tax. Small businesses are not included.',
};

export const KZ_MEDIAN_SOURCE = {
  publisher: 'Bureau of National Statistics of the Republic of Kazakhstan',
  title: 'Differentiation of wages of workers in the Republic of Kazakhstan (2026)',
  period: 'II quarter 2026 (survey of April 2026)',
  released: '2026-10-23',
  url: 'https://stat.gov.kz/en/industries/labor-and-income/stat-wags/publications/519860/',
};

export const KZ_NATIONAL = { average: 486388, median: 348415 };   // tenge per month

// Average monthly nominal wage by sector, tenge, II quarter 2026 (KZ_SOURCE).
export const KZ_SECTORS = [
  { id: 'finance',       name: 'Finance and insurance',                       wage: 1107576 },
  { id: 'mining',        name: 'Mining and quarrying (incl. oil and gas)',    wage: 980334 },
  { id: 'ict',           name: 'Information and communication',               wage: 851076 },
  { id: 'professional',  name: 'Professional, scientific and technical',      wage: 655277 },
  { id: 'transport',     name: 'Transport and storage',                       wage: 639411 },
  { id: 'manufacturing', name: 'Manufacturing',                               wage: 584171 },
  { id: 'construction',  name: 'Construction',                                wage: 573110 },
  { id: 'energy',        name: 'Electricity, gas and steam supply',           wage: 504412 },
  { id: 'trade',         name: 'Wholesale and retail trade; car repair',      wage: 451524 },
  { id: 'other',         name: 'Other services',                              wage: 405947 },
  { id: 'admin',         name: 'Administrative and support services',         wage: 393502 },
  { id: 'public',        name: 'Public administration and defence',           wage: 392220 },
  { id: 'education',     name: 'Education',                                   wage: 385725 },
  { id: 'hospitality',   name: 'Accommodation and food services',             wage: 373433 },
  { id: 'realestate',    name: 'Real estate',                                 wage: 371109 },
  { id: 'agriculture',   name: 'Agriculture, forestry and fishing',           wage: 365262 },
  { id: 'health',        name: 'Health care and social services',             wage: 360296 },
  { id: 'water',         name: 'Water supply and waste management',           wage: 357851 },
  { id: 'arts',          name: 'Arts, entertainment and recreation',          wage: 312136 },
];
export const KZ_SECTOR_BY_ID = Object.fromEntries(KZ_SECTORS.map(s => [s.id, s]));

// The closest sector for each Cognita field (team's estimate).
export const FIELD_SECTOR = {
  it: 'ict', data: 'ict', media: 'ict',
  design: 'professional', business: 'professional', marketing: 'professional', science: 'professional',
  arts: 'arts', sports: 'arts',
  finance: 'finance', health: 'health', engineering: 'manufacturing', construction: 'construction',
  education: 'education', law: 'public', safety: 'public', transport: 'transport',
  hospitality: 'hospitality', agriculture: 'agriculture', trades: 'construction', beauty: 'other',
};

// Careers whose usual sector differs from their field (team's estimate, based on the official sector names).
export const CAREER_SECTOR = {
  'petroleum-engineer': 'mining', 'mining-engineer': 'mining', 'geologist': 'mining',
  'electrical-engineer': 'energy', 'environmental-engineer': 'water',
  'lawyer': 'professional', 'accountant': 'professional', 'auditor': 'professional',
  'translator': 'professional', 'photographer': 'professional', 'pr-specialist': 'professional',
  'architect': 'professional', 'urban-planner': 'professional', 'surveyor': 'professional', 'veterinarian': 'professional',
  'sales-manager': 'trade', 'auto-mechanic': 'trade',
  'social-worker': 'health', 'tour-guide': 'admin', 'event-manager': 'admin',
};

/**
 * Market facts for one career, all computed from the official numbers above.
 * @param {object} career  an item of CAREERS
 */
export function marketFor(career) {
  const sector = KZ_SECTOR_BY_ID[CAREER_SECTOR[career.id] || FIELD_SECTOR[career.field]];
  const rank = KZ_SECTORS.indexOf(sector) + 1;
  const vsAverage = Math.round((sector.wage / KZ_NATIONAL.average - 1) * 100);   // percent above (+) or below (-)
  return { sector, rank, of: KZ_SECTORS.length, vsAverage };
}

export const tenge = n => n.toLocaleString('en-US').replace(/,/g, ' ') + ' ₸';
