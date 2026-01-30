/**
 * Converts an array of objects into a CSV string.
 * @param {Array<object>} data The data array to convert.
 * @returns {string} The CSV data as a string.
 */
function convertToCSV(data) {
  if (!data || data.length === 0) {
    return '';
  }

  const headers = Object.keys(data[0]);
  const csvRows = [];

  // Add header row
  csvRows.push(headers.join(','));

  // Add data rows
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      
      // Handle values that might contain commas
      if (typeof value === 'string' && value.includes(',')) {
        return `"${value}"`;
      }
      return value;
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}

/**
 * Triggers a browser download for a CSV string.
 * @param {string} csv The CSV data string.
 * @param {string} filename The desired name for the downloaded file.
 */
function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.setAttribute('href', url);
  a.setAttribute('download', filename);
  a.style.display = 'none';
  
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  
  window.URL.revokeObjectURL(url);
}

/**
 * Public function to export an array of data to a CSV file.
 * @param {Array<object>} data The data to export.
 * @param {string} filename The desired filename (e.g., "summary-2025-10.csv").
 */
export function exportToCSV(data, filename) {
  const csv = convertToCSV(data);
  downloadCSV(csv, filename);
}
