let policyCache = null;

function normalizeAppNo(rawValue) {
  const value = String(rawValue || '').trim();
  if (!value) return '';
  return value.replace(/[^0-9]/g, '').padStart(8, '0');
}

function parseCsv(content) {
  const rows = [];
  const lines = content.split(/\r?\n/).filter((line) => line.trim() !== '');

  if (!lines.length) return rows;

  const headers = lines[0].split(',').map((cell) => cell.trim().replace(/^"|"$/g, ''));
  lines.slice(1).forEach((line) => {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
        continue;
      }
      current += char;
    }

    values.push(current.trim());
    const row = {};
    headers.forEach((header, headerIndex) => {
      row[header] = values[headerIndex] || '';
    });
    rows.push(row);
  });

  return rows;
}

export async function loadPolicies(source = './file-policy.csv') {
  if (policyCache) {
    return policyCache;
  }

  const response = await fetch(source, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Unable to load policy data from ${source}`);
  }

  const text = await response.text();
  const rows = parseCsv(text);
  const normalizedPolicies = rows.map((row) => ({
    appNo: normalizeAppNo(row.appNo || row['Application No'] || row['Policy No'] || ''),
    customerName: row.customerName || row['Customer Name'] || row['ชื่อ - นามสกุล ผอป.'] || '',
    plan: row.plan || row['Plan'] || '',
    submissionDate: row.submissionDate || row['Submission Date'] || '',
    workType: row.workType || row['Work Type'] || '',
    weight: row.weight || row['Weight'] || 0,
    assignedUW: row.assignedUW || row['Assigned UW'] || '',
    batch: row.batch || row['Batch'] || '',
    status: row.status || row['Status'] || 'pending',
  }));

  policyCache = normalizedPolicies;
  return policyCache;
}

export async function searchPolicy(appNo) {
  const policies = await loadPolicies();
  const normalizedTarget = normalizeAppNo(appNo);
  return policies.find((policy) => normalizeAppNo(policy.appNo) === normalizedTarget) || null;
}

export { normalizeAppNo };
