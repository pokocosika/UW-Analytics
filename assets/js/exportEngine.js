import { getAssignments } from './assignmentService.js';

const PENDING_HEADER = ['Application No', 'Policy No', 'Requirement', 'Input Date'];
const TRACKING_HEADER = ['Policy No', 'ชื่อ - นามสกุล ผอป.', 'ชื่อ - นามสกุล ตัวแทน', 'รหัสตัวแทน', 'Zone', 'วันที่ติดตามสำเนา', 'Receipt Date', 'ค้าง (วัน)', 'ESD Unit Name', 'หมายเหตุเอกสารสำเนา'];

function getXlsxLib() {
  if (typeof window !== 'undefined' && window.XLSX) {
    return window.XLSX;
  }

  throw new Error('SheetJS is not available in this browser session.');
}

function toCellValue(value) {
  return value === undefined || value === null ? '' : String(value);
}

function buildPendingRows(assignments) {
  const rows = [PENDING_HEADER];
  assignments.forEach((assignment) => {
    rows.push([
      toCellValue(assignment.appNo),
      toCellValue(assignment.appNo),
      toCellValue(assignment.workType || assignment.status || 'Pending'),
      toCellValue(assignment.submissionDate),
    ]);
  });
  return rows;
}

function buildTrackingRows(assignments) {
  const rows = [TRACKING_HEADER];
  assignments.forEach((assignment) => {
    rows.push([
      toCellValue(assignment.appNo),
      toCellValue(assignment.customerName),
      toCellValue(assignment.assignedUW || assignment.batch || ''),
      toCellValue(assignment.idCard),
      toCellValue(assignment.batch || ''),
      toCellValue(assignment.submissionDate),
      toCellValue(''),
      toCellValue(''),
      toCellValue('ESD-1'),
      toCellValue(assignment.status || 'Pending'),
    ]);
  });
  return rows;
}

function downloadWorkbook(workbook, fileName) {
  const xlsx = getXlsxLib();
  if (typeof xlsx.writeFile === 'function') {
    xlsx.writeFile(workbook, fileName);
    return;
  }

  const workbookData = xlsx.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([workbookData], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export async function exportAssignmentWorkbooks() {
  const assignments = await getAssignments();
  if (!assignments.length) {
    throw new Error('No assignments available to export.');
  }

  const xlsx = getXlsxLib();
  const pendingWorkbook = xlsx.utils.book_new();
  const trackingWorkbook = xlsx.utils.book_new();
  const pendingSheet = xlsx.utils.aoa_to_sheet(buildPendingRows(assignments));
  const trackingSheet = xlsx.utils.aoa_to_sheet(buildTrackingRows(assignments));

  xlsx.utils.book_append_sheet(pendingWorkbook, pendingSheet, 'Pending Assignment');
  xlsx.utils.book_append_sheet(trackingWorkbook, trackingSheet, 'Tracking Input');

  downloadWorkbook(pendingWorkbook, 'Pending Assignment.xlsx');
  downloadWorkbook(trackingWorkbook, 'Tracking Input.xlsx');

  return {
    pendingFileName: 'Pending Assignment.xlsx',
    trackingFileName: 'Tracking Input.xlsx',
    assignmentsCount: assignments.length,
  };
}
