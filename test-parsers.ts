/**
 * Test script for file parsers
 * 
 * Run with: node --loader tsx test-parsers.ts
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { parseCSV } from './lib/jupyter/parsers/csv-parser';
import { parseExcel } from './lib/jupyter/parsers/excel-parser';

async function testParsers() {
  console.log('🧪 Testing File Parsers\n');

  const testDir = join(process.cwd(), 'test-data');

  // Test CSV Parser
  console.log('📄 Testing CSV Parser...');
  try {
    const csvBuffer = readFileSync(join(testDir, 'employee_data.csv'));
    const csvResult = await parseCSV(csvBuffer);
    
    console.log('✅ CSV Parse Result:');
    console.log('  Headers:', csvResult.headers);
    console.log('  Row Count:', csvResult.rowCount);
    console.log('  Encoding:', csvResult.encoding);
    console.log('  Delimiter:', csvResult.delimiter);
    console.log('  Success:', csvResult.success);
    console.log();
  } catch (error) {
    console.error('❌ CSV parsing failed:', error);
  }

  // Test CSV Parser (Sales Data)
  console.log('📄 Testing CSV Parser (Sales Data)...');
  try {
    const csvBuffer = readFileSync(join(testDir, 'sales_data.csv'));
    const csvResult = await parseCSV(csvBuffer);
    
    console.log('✅ CSV Parse Result:');
    console.log('  Headers:', csvResult.headers);
    console.log('  Row Count:', csvResult.rowCount);
    console.log('  Encoding:', csvResult.encoding);
    console.log('  Success:', csvResult.success);
    console.log();
  } catch (error) {
    console.error('❌ CSV parsing failed:', error);
  }

  // Test Excel Parser (.xlsx)
  console.log('📊 Testing Excel Parser (.xlsx)...');
  try {
    const xlsxBuffer = readFileSync(join(testDir, 'inventory.xlsx'));
    const xlsxResult = await parseExcel(xlsxBuffer);
    
    console.log('✅ Excel Parse Result:');
    console.log('  Headers:', xlsxResult.headers);
    console.log('  Row Count:', xlsxResult.rowCount);
    console.log('  Sheet Names:', xlsxResult.sheetNames);
    console.log('  Active Sheet:', xlsxResult.activeSheet);
    console.log('  Success:', xlsxResult.success);
    console.log();
  } catch (error) {
    console.error('❌ Excel (.xlsx) parsing failed:', error);
  }

  // Test Excel Parser (.xls)
  console.log('📊 Testing Excel Parser (.xls)...');
  try {
    const xlsBuffer = readFileSync(join(testDir, 'financial_report.xls'));
    const xlsResult = await parseExcel(xlsBuffer);
    
    console.log('✅ Excel Parse Result:');
    console.log('  Headers:', xlsResult.headers);
    console.log('  Row Count:', xlsResult.rowCount);
    console.log('  Sheet Names:', xlsResult.sheetNames);
    console.log('  Active Sheet:', xlsResult.activeSheet);
    console.log('  Success:', xlsResult.success);
    console.log();
  } catch (error) {
    console.error('❌ Excel (.xls) parsing failed:', error);
  }

  console.log('✅ All parser tests completed!');
}

testParsers().catch(console.error);
