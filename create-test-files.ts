/**
 * Script to create test Excel files
 */

import * as XLSX from 'xlsx';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const testDir = join(process.cwd(), 'test-data');

// Ensure directory exists
try {
  mkdirSync(testDir, { recursive: true });
} catch (e) {
  // Directory already exists
}

// Create inventory.xlsx
const inventoryData = [
  ['ProductID', 'ProductName', 'Category', 'Quantity', 'Price', 'Supplier', 'LastUpdated'],
  ['INV001', 'Laptop Pro 15', 'Electronics', 25, 1299.99, 'TechCorp', '2024-01-15'],
  ['INV002', 'Wireless Mouse', 'Accessories', 150, 29.99, 'PeripheralsCo', '2024-01-16'],
  ['INV003', 'USB-C Hub', 'Accessories', 89, 49.99, 'TechCorp', '2024-01-17'],
  ['INV004', '27" Monitor', 'Electronics', 45, 399.99, 'DisplayTech', '2024-01-18'],
  ['INV005', 'Mechanical Keyboard', 'Accessories', 78, 129.99, 'PeripheralsCo', '2024-01-19'],
  ['INV006', 'HD Webcam', 'Electronics', 120, 79.99, 'TechCorp', '2024-01-20'],
  ['INV007', 'Laptop Stand', 'Accessories', 95, 34.99, 'OfficePro', '2024-01-21'],
  ['INV008', 'Wireless Headphones', 'Electronics', 60, 199.99, 'AudioTech', '2024-01-22'],
];

const wb1 = XLSX.utils.book_new();
const ws1 = XLSX.utils.aoa_to_sheet(inventoryData);
XLSX.utils.book_append_sheet(wb1, ws1, 'Inventory');
writeFileSync(join(testDir, 'inventory.xlsx'), XLSX.write(wb1, { type: 'buffer', bookType: 'xlsx' }));
console.log('✅ Created inventory.xlsx');

// Create financial_report.xls (legacy format)
const financialData = [
  ['Month', 'Revenue', 'Expenses', 'Profit', 'GrowthRate'],
  ['January', 125000, 85000, 40000, '8.5%'],
  ['February', 138000, 89000, 49000, '10.4%'],
  ['March', 152000, 95000, 57000, '10.1%'],
  ['April', 145000, 92000, 53000, '-4.6%'],
  ['May', 168000, 98000, 70000, '15.9%'],
  ['June', 185000, 105000, 80000, '10.1%'],
  ['July', 172000, 102000, 70000, '-7.0%'],
  ['August', 195000, 110000, 85000, '13.4%'],
];

const wb2 = XLSX.utils.book_new();
const ws2 = XLSX.utils.aoa_to_sheet(financialData);
XLSX.utils.book_append_sheet(wb2, ws2, 'Financial Data');
writeFileSync(join(testDir, 'financial_report.xls'), XLSX.write(wb2, { type: 'buffer', bookType: 'xls' }));
console.log('✅ Created financial_report.xls');

console.log('\n✅ All test files created successfully!');
