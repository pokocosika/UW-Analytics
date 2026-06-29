let policyCache = null;

function getRowValue(row, aliases) {
  const normalized = Object.keys(row).reduce((accumulator, key) => {
    accumulator[key.toLowerCase()] = row[key];
    return accumulator;
  }, {});

  for (const alias of aliases) {
    const candidate = normalized[String(alias).toLowerCase()];
    if (candidate !== undefined && candidate !== null && String(candidate).trim() !== '') {
      return String(candidate).trim();
    }
  }

  return '';
}

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
    appNo: normalizeAppNo(getRowValue(row, ['appNo', 'application no', 'policy no', 'p1apno'])),
    customerName: getRowValue(row, ['customerName', 'customer name', 'name', 'p1fnam', 'p1snam', 'ชื่อ - นามสกุล ผอป.']),
    idCard: getRowValue(row, ['idCard', 'id card', 'citizen id', 'cid']),
    plan: getRowValue(row, ['plan', 'p1plan']),
    submissionDate: getRowValue(row, ['submissionDate', 'submission date', 'p1smdt']),
    workType: getRowValue(row, ['workType', 'work type']),
    weight: getRowValue(row, ['weight', 'weight', 'p1fyp']) || 0,
    assignedUW: getRowValue(row, ['assignedUW', 'assigned uw']),
    batch: getRowValue(row, ['batch', 'batch']),
    status: getRowValue(row, ['status', 'p1stat']) || 'pending',
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
