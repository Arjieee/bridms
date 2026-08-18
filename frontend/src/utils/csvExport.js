import toast from 'react-hot-toast';

/**
 * Universal CSV Exporter for Barangay Puerto Relief System
 * Features:
 * - UTF-8 BOM encoding for seamless Microsoft Excel & Google Sheets compatibility
 * - Full string escaping for commas, quotes, and newlines
 * - Automatic timestamped file naming
 * - Smooth native browser download
 */
export function exportToCsv(filenamePrefix, headers, rows) {
  try {
    if (!rows || rows.length === 0) {
      toast.error('No data available to export.');
      return false;
    }

    // Format single cell
    const formatCell = (val) => {
      if (val === null || val === undefined) return '""';
      let str = String(val);
      // Escape double quotes by doubling them
      str = str.replace(/"/g, '""');
      return `"${str}"`;
    };

    // Build CSV string
    const headerLine = headers.map(h => formatCell(h.label || h)).join(',');
    const dataLines = rows.map(row => {
      if (Array.isArray(row)) {
        return row.map(cell => formatCell(cell)).join(',');
      }
      return headers.map(h => formatCell(row[h.key])).join(',');
    });

    const csvContent = '\uFEFF' + [headerLine, ...dataLines].join('\r\n');

    // Create Blob with text/csv
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    // Format filename with date
    const dateStr = new Date().toISOString().split('T')[0];
    const finalFilename = `BrgyPuerto_${filenamePrefix}_${dateStr}.csv`;

    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', finalFilename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${rows.length} rows to ${finalFilename}!`, {
      icon: '📥',
      id: 'csv-export-success',
    });
    return true;
  } catch (err) {
    console.error('CSV Export Error:', err);
    toast.error('Failed to export CSV file.');
    return false;
  }
}
